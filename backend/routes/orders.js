const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Order = require('../models/Order');
const Product = require('../models/Product');


// ======================= HELPER =======================

function isValidPhoneVN(phone) {
  return /^0\d{9}$/.test(String(phone || '').trim());
}

function calcShipping(subTotal, shippingMethod) {
  if (shippingMethod === 'express') return 30000;
  return subTotal > 500000 ? 0 : 20000;
}

function calcDiscount(voucherCode, subTotal, shippingFee) {
  if (voucherCode === 'SALE10') return subTotal * 0.1;
  if (voucherCode === 'FREESHIP') return shippingFee;
  return 0;
}


// ======================= CREATE ORDER =======================

router.post('/', async (req, res) => {

  try {

    const { customer, items, shippingMethod, paymentMethod, voucherCode } = req.body;

    if (!customer?.fullName || !customer?.phone || !customer?.address) {
      return res.status(400).json({ message: 'Thiếu thông tin khách hàng' });
    }

    if (!isValidPhoneVN(customer.phone)) {
      return res.status(400).json({ message: 'Số điện thoại không hợp lệ' });
    }

    if (!customer?.province || !customer?.district || !customer?.ward) {
      return res.status(400).json({ message: 'Thiếu tỉnh/huyện/xã' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Giỏ hàng trống' });
    }

    const normalizedIn = items.map(i => ({
      productId: String(i.productId || '').trim(),
      variantId: String(i.variantId || '').trim(),
      variantLabel: String(i.variantLabel || '').trim(),
      quantity: Math.max(1, Number(i.quantity || 1))
    }));


    const invalidIds = normalizedIn
      .filter(i => !mongoose.Types.ObjectId.isValid(i.productId))
      .map(i => i.productId);

    if (invalidIds.length) {
      return res.status(400).json({
        message: 'productId không hợp lệ',
        invalidIds
      });
    }

    const invalidVariantIds = normalizedIn
      .filter(i => i.variantId && !mongoose.Types.ObjectId.isValid(i.variantId))
      .map(i => i.variantId);
    if (invalidVariantIds.length) {
      return res.status(400).json({
        message: 'variantId không hợp lệ',
        invalidVariantIds
      });
    }

    const ids = normalizedIn.map(i => new mongoose.Types.ObjectId(i.productId));

    const products = await Product.find({ _id: { $in: ids } }).lean();

    const map = new Map(products.map(p => [String(p._id), p]));

    const missing = normalizedIn
      .filter(i => !map.has(i.productId))
      .map(i => i.productId);

    if (missing.length) {
      return res.status(400).json({
        message: 'Có sản phẩm không tồn tại',
        missing
      });
    }


    // ================= BUILD ORDER ITEMS =================

    let subTotal = 0;
    const orderItems = [];

    for (const i of normalizedIn) {
      const p = map.get(i.productId);
      let variant = null;
      if (i.variantId && mongoose.Types.ObjectId.isValid(i.variantId)) {
        variant = (p.variants || []).find(v => String(v._id) === String(i.variantId));
        if (!variant) {
          return res.status(400).json({ message: `Biến thể không tồn tại cho sản phẩm ${p.name}` });
        }
      }

      const qty = i.quantity;
      const available = Number(variant?.stock ?? p.stock ?? 0);
      if (qty > available) {
        return res.status(400).json({
          message: `Sản phẩm "${p.name}" chỉ còn ${available} trong kho`
        });
      }

      const price = Number(variant?.price ?? p.price ?? 0);
      subTotal += price * qty;

      let image = null;
      if (p.images && p.images.length > 0) image = p.images[0];

      orderItems.push({
        productId: p._id,
        variantId: variant?._id || null,
        variantLabel: variant?.label || i.variantLabel || '',
        name: p.name || 'Product',
        price,
        quantity: qty,
        imageUrl: image
      });
    }


    const ship = calcShipping(subTotal, shippingMethod);
    const disc = calcDiscount(voucherCode, subTotal, ship);
    const total = Math.max(0, subTotal + ship - disc);

    const status = 'pending';


    const order = await Order.create({

      customer: {
        fullName: customer.fullName,
        phone: customer.phone,
        email: customer.email || '',
        address: customer.address,
        province: customer.province,
        district: customer.district,
        ward: customer.ward,
        note: customer.note || ''
      },

      items: orderItems,

      shippingMethod: shippingMethod || 'standard',
      paymentMethod: paymentMethod || 'cod',
      voucherCode: voucherCode || null,

      subTotal,
      shippingFee: ship,
      discount: disc,
      total,

      status

    });

    // Trừ kho sau khi tạo đơn thành công (phiên bản đơn giản, an toàn cho dữ liệu hiện tại).
    for (const item of orderItems) {
      const p = await Product.findById(item.productId);
      if (!p) continue;

      if (item.variantId) {
        const idx = (p.variants || []).findIndex(v => String(v._id) === String(item.variantId));
        if (idx >= 0) {
          p.variants[idx].stock = Math.max(0, Number(p.variants[idx].stock || 0) - Number(item.quantity || 0));
        }
      } else {
        p.stock = Math.max(0, Number(p.stock || 0) - Number(item.quantity || 0));
      }

      // Đồng bộ tồn tổng từ biến thể nếu sản phẩm đang dùng variants.
      if (Array.isArray(p.variants) && p.variants.length > 0) {
        p.stock = p.variants.reduce((sum, v) => sum + Number(v.stock || 0), 0);
      }
      await p.save();
    }


    return res.status(201).json({
      orderId: order._id
    });


  } catch (err) {

    console.error(err);

    if (err?.name === 'CastError') {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    return res.status(500).json({
      message: err?.message || 'Server error'
    });

  }

});


// ======================= GET ALL ORDERS =======================

router.get('/', async (req, res) => {

  try {

    const orders = await Order.find()
      .sort({ createdAt: -1 });

    res.json(orders);

  } catch (err) {

    res.status(500).json({
      message: 'Server error'
    });

  }

});


// ======================= GET ORDER BY ID =======================

router.get('/:id', async (req, res) => {

  try {

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const order = await Order.findById(req.params.id)
      .populate('items.productId');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    return res.json(order);

  } catch (err) {

    return res.status(500).json({
      message: 'Server error'
    });

  }

});


// ======================= UPDATE STATUS =======================

router.patch('/:id/status', async (req, res) => {

  try {

    const { status } = req.body;

    const allowedStatus = [
      'pending',
      'pending_payment',
      'paid',
      'cancelled'
    ];

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({
        message: 'Status không hợp lệ'
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        message: 'Order not found'
      });
    }

    res.json(order);

  } catch (err) {

    res.status(500).json({
      message: 'Server error'
    });

  }

});


// ======================= DELETE ORDER =======================

router.delete('/:id', async (req, res) => {

  try {

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const order = await Order.findByIdAndDelete(id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({
      message: 'Đã hủy đơn hàng',
      orderId: id
    });

  } catch (err) {

    res.status(500).json({
      message: 'Server error'
    });

  }

});

module.exports = router;