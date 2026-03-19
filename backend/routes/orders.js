const express  = require('express');
const mongoose = require('mongoose');
const router   = express.Router();

const Order   = require('../models/Order');
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
  if (voucherCode === 'SALE10')   return subTotal * 0.1;
  if (voucherCode === 'FREESHIP') return shippingFee;
  return 0;
}

// ======================= CREATE ORDER =======================

router.post('/', async (req, res) => {
  try {
    const { customer, items, shippingMethod, paymentMethod, voucherCode, userId } = req.body;

    // Validate customer
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

    // Validate items
    const normalizedIn = items.map(i => ({
      productId: String(i.productId || '').trim(),
      quantity:  Math.max(1, Number(i.quantity || 1))
    }));

    const invalidIds = normalizedIn
      .filter(i => !mongoose.Types.ObjectId.isValid(i.productId))
      .map(i => i.productId);

    if (invalidIds.length) {
      return res.status(400).json({ message: 'productId không hợp lệ', invalidIds });
    }

    const ids      = normalizedIn.map(i => new mongoose.Types.ObjectId(i.productId));
    const products = await Product.find({ _id: { $in: ids } }).lean();
    const map      = new Map(products.map(p => [String(p._id), p]));

    const missing = normalizedIn
      .filter(i => !map.has(i.productId))
      .map(i => i.productId);

    if (missing.length) {
      return res.status(400).json({ message: 'Có sản phẩm không tồn tại', missing });
    }

    // Build order items
    let subTotal = 0;
    const orderItems = normalizedIn.map(i => {
      const p     = map.get(i.productId);
      const price = Number(p.price || 0);
      subTotal   += price * i.quantity;
      return {
        productId: p._id,
        name:      p.name || 'Product',
        price,
        quantity:  i.quantity,
        imageUrl:  p.images?.[0] ?? null,
      };
    });

    const ship  = calcShipping(subTotal, shippingMethod);
    const disc  = calcDiscount(voucherCode, subTotal, ship);
    const total = Math.max(0, subTotal + ship - disc);

    // Build order data — gắn userId nếu hợp lệ
    const orderData = {
      customer: {
        fullName: customer.fullName,
        phone:    customer.phone,
        email:    customer.email || '',
        address:  customer.address,
        province: customer.province,
        district: customer.district,
        ward:     customer.ward,
        note:     customer.note || '',
      },
      items:          orderItems,
      shippingMethod: shippingMethod || 'standard',
      paymentMethod:  paymentMethod  || 'cod',
      voucherCode:    voucherCode    || null,
      subTotal,
      shippingFee:    ship,
      discount:       disc,
      total,
      status:         'pending',
      userId:         null,
    };

    // Validate và gắn userId nếu đã đăng nhập
    if (userId && mongoose.Types.ObjectId.isValid(String(userId))) {
      orderData.userId = new mongoose.Types.ObjectId(String(userId));
    }

    const order = await Order.create(orderData);

    return res.status(201).json({ orderId: order._id });

  } catch (err) {
    console.error(err);
    if (err?.name === 'CastError') {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }
    return res.status(500).json({ message: err?.message || 'Server error' });
  }
});

// ======================= GET ALL / GET BY USER =======================

router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;

    // Nếu có userId thì lọc theo user, không thì lấy tất cả (cho admin)
    const filter = userId && mongoose.Types.ObjectId.isValid(userId)
      ? { userId: new mongoose.Types.ObjectId(userId) }
      : {};

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ======================= GET ORDERS BY USER =======================

router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'userId không hợp lệ' });
    }
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ======================= GET ORDER BY ID =======================

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }
    const order = await Order.findById(req.params.id).populate('items.productId');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    return res.json(order);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// ======================= UPDATE STATUS =======================

router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Status không hợp lệ' });
    }
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
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
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json({ message: 'Đã hủy đơn hàng', orderId: id });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;