const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Order = require('../models/Order');
const Product = require('../models/Product');

// helper: validate phone VN dạng 0xxxxxxxxx (10 số)
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

    // 1) validate customer
    if (!customer?.fullName || !customer?.phone || !customer?.address) {
      return res.status(400).json({ message: 'Thiếu thông tin khách hàng' });
    }
    if (!isValidPhoneVN(customer.phone)) {
      return res.status(400).json({ message: 'Số điện thoại không hợp lệ' });
    }
    if (!customer?.province || !customer?.district || !customer?.ward) {
      return res.status(400).json({ message: 'Thiếu tỉnh/huyện/xã' });
    }

    // 2) validate items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Giỏ hàng trống' });
    }

    // items FE gửi: [{productId, quantity}]
    const normalizedIn = items.map(i => ({
      productId: String(i.productId || '').trim(),
      quantity: Math.max(1, Number(i.quantity || 1))
    }));

    // ✅ validate ObjectId trước khi query
    const invalidIds = normalizedIn
      .filter(i => !mongoose.Types.ObjectId.isValid(i.productId))
      .map(i => i.productId);

    if (invalidIds.length) {
      return res.status(400).json({
        message: 'productId không hợp lệ (không phải ObjectId)',
        invalidIds
      });
    }

    const ids = normalizedIn.map(i => new mongoose.Types.ObjectId(i.productId));

    // 3) lấy sản phẩm từ DB để lấy giá chuẩn
    const products = await Product.find({ _id: { $in: ids } }).lean();
    const map = new Map(products.map(p => [String(p._id), p]));

    // ✅ nếu thiếu sản phẩm thì trả 400 (đừng throw 500)
    const missing = normalizedIn
      .filter(i => !map.has(i.productId))
      .map(i => i.productId);

    if (missing.length) {
      return res.status(400).json({
        message: 'Có sản phẩm không tồn tại trong DB',
        missing
      });
    }

    // 4) build order items + tính subtotal
    let subTotal = 0;
    const orderItems = normalizedIn.map(i => {
      const p = map.get(i.productId);

      const price = Number(p.price || 0);
      const qty = i.quantity;

      subTotal += price * qty;

      return {
        productId: p._id,
        name: p.name || 'Product',
        price,
        quantity: qty,
        imageUrl: p.imageUrl || null
      };
    });

    // 5) shipping + discount + total
    const ship = calcShipping(subTotal, shippingMethod);
    const disc = calcDiscount(voucherCode, subTotal, ship);
    const total = Math.max(0, subTotal + ship - disc);

    // 6) status theo payment
    const status = paymentMethod === 'cod' ? 'pending' : 'pending_payment';

    // 7) create order
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

    return res.status(201).json({ orderId: order._id });
  } catch (err) {
    console.error(err);

    if (err?.name === 'CastError') {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    return res.status(500).json({ message: err?.message || 'Server error' });
  }
});

// ======================= GET ORDER =======================
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const order = await Order.findById(req.params.id).populate('items.productId');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    return res.json(order);
  } catch (err) {
    return res.status(404).json({ message: 'Order not found' });
  }
});

module.exports = router;