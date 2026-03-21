const express  = require('express');
const mongoose = require('mongoose');
const router   = express.Router();

const Order   = require('../models/Order');
const Product = require('../models/Product');
const Cart    = require('../models/Cart');
const User    = require('../models/User');
const OrderAuditLog = require('../models/OrderAuditLog');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

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

function getMembershipTier(totalSpent) {
  if (!totalSpent || totalSpent <= 0) return 'Đồng';
  if (totalSpent < 5_000_000) return 'Đồng';
  if (totalSpent < 10_000_000) return 'Bạc';
  if (totalSpent < 20_000_000) return 'Vàng';
  return 'Kim Cương';
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

const ORDER_STATUS = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];
const RETURN_STATUS = ['none', 'requested', 'completed'];

// Rule chuyển trạng thái đúng nghiệp vụ admin đã chốt.
const NEXT_STATUS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping'],
  shipping: ['delivered'],
  delivered: [],
  cancelled: []
};

function parseDateStart(d) {
  const dt = new Date(`${d}T00:00:00.000Z`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parseDateEnd(d) {
  const dt = new Date(`${d}T23:59:59.999Z`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function buildAdminOrderFilter(query) {
  const filter = {};
  const and = [];

  if (ORDER_STATUS.includes(String(query.status || ''))) {
    filter.status = String(query.status);
  }

  if (RETURN_STATUS.includes(String(query.returnStatus || ''))) {
    filter.returnStatus = String(query.returnStatus);
  }

  if (['cod', 'momo', 'vnpay'].includes(String(query.paymentMethod || ''))) {
    filter.paymentMethod = String(query.paymentMethod);
  }

  const from = String(query.from || '');
  const to = String(query.to || '');
  if (from) {
    const fromDate = parseDateStart(from);
    if (!fromDate) throw new Error('Ngày bắt đầu không hợp lệ');
    and.push({ createdAt: { $gte: fromDate } });
  }
  if (to) {
    const toDate = parseDateEnd(to);
    if (!toDate) throw new Error('Ngày kết thúc không hợp lệ');
    and.push({ createdAt: { $lte: toDate } });
  }

  const keyword = String(query.search || '').trim();
  if (keyword) {
    const rx = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    and.push({
      $or: [
        { orderCode: rx },
        { _id: mongoose.Types.ObjectId.isValid(keyword) ? new mongoose.Types.ObjectId(keyword) : null },
        { 'customer.fullName': rx },
        { 'customer.phone': rx },
        { 'customer.email': rx }
      ].filter(Boolean)
    });
  }

  if (and.length) filter.$and = and;
  return filter;
}

function getAdminSort(sortBy, sortDir) {
  const dir = String(sortDir || 'desc') === 'asc' ? 1 : -1;
  const allowed = ['createdAt', 'total', 'status', 'paymentMethod', 'orderCode'];
  const by = allowed.includes(String(sortBy || '')) ? String(sortBy) : 'createdAt';
  return { [by]: dir, _id: -1 };
}

async function generateNextOrderCode() {
  const latest = await Order.findOne({ orderCode: /^ORD\d{11}$/ })
    .sort({ orderCode: -1 })
    .select('orderCode')
    .lean();

  const current = Number(String(latest?.orderCode || '').replace(/^ORD/, '')) || 0;
  return `ORD${String(current + 1).padStart(11, '0')}`;
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
      productId:    String(i.productId || '').trim(),
      variantId:    String(i.variantId || '').trim(),
      variantLabel: String(i.variantLabel || '').trim(),
      quantity:     Math.max(1, Number(i.quantity || 1)),
    }));

    const invalidIds = normalizedIn
      .filter(i => !mongoose.Types.ObjectId.isValid(i.productId))
      .map(i => i.productId);

    if (invalidIds.length) {
      return res.status(400).json({ message: 'productId không hợp lệ', invalidIds });
    }

    const invalidVariantIds = normalizedIn
      .filter(i => i.variantId && !mongoose.Types.ObjectId.isValid(i.variantId))
      .map(i => i.variantId);

    if (invalidVariantIds.length) {
      return res.status(400).json({ message: 'variantId không hợp lệ', invalidVariantIds });
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
    let subTotal   = 0;
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

      const qty       = i.quantity;
      const available = Number(variant?.stock ?? p.stock ?? 0);
      if (qty > available) {
        return res.status(400).json({
          message: `Sản phẩm "${p.name}" chỉ còn ${available} trong kho`
        });
      }

      const price  = Number(variant?.price ?? p.price ?? 0);
      subTotal    += price * qty;

      const image = p.images?.[0] ?? null;

      orderItems.push({
        productId:    p._id,
        variantId:    variant?._id || null,
        variantLabel: variant?.label || i.variantLabel || '',
        name:         p.name || 'Product',
        price,
        quantity:     qty,
        imageUrl:     image,
      });
    }

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

    if (userId && mongoose.Types.ObjectId.isValid(String(userId))) {
      orderData.userId = new mongoose.Types.ObjectId(String(userId));
    }

    let order = null;
    let lastErr = null;
    // Retry để tránh đụng unique orderCode khi tạo đơn đồng thời.
    for (let i = 0; i < 4; i += 1) {
      try {
        orderData.orderCode = await generateNextOrderCode();
        order = await Order.create(orderData);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if (e?.code !== 11000) break;
      }
    }
    if (!order) throw lastErr || new Error('Không thể tạo mã đơn hàng');

    // ✅ Xóa các sản phẩm đã mua khỏi cart trên DB
    if (order.userId) {
      const boughtIds = orderItems.map(i => String(i.productId));
      try {
        const cart = await Cart.findOne({ userId: order.userId });
        if (cart) {
          cart.items = cart.items.filter(i => !boughtIds.includes(String(i.productId)));
          await cart.save();
        }
      } catch (e) { /* không chặn response nếu lỗi xóa cart */ }
    }

    // Trừ kho sau khi tạo đơn thành công
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

      // Đồng bộ tồn tổng từ biến thể nếu sản phẩm đang dùng variants
      if (Array.isArray(p.variants) && p.variants.length > 0) {
        p.stock = p.variants.reduce((sum, v) => sum + Number(v.stock || 0), 0);
      }
      await p.save();
    }

    return res.status(201).json({ orderId: order._id, orderCode: order.orderCode });

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

// ======================= ADMIN ORDER LIST =======================
router.get('/admin/list', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    const skip = (page - 1) * limit;
    const filter = buildAdminOrderFilter(req.query);
    const sort = getAdminSort(req.query.sortBy, req.query.sortDir);

    const [data, total, globalStats] = await Promise.all([
      Order.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            shippingCount: { $sum: { $cond: [{ $eq: ['$status', 'shipping'] }, 1, 0] } },
            returnRequestedCount: { $sum: { $cond: [{ $eq: ['$returnStatus', 'requested'] }, 1, 0] } },
            returnCompletedCount: { $sum: { $cond: [{ $eq: ['$returnStatus', 'completed'] }, 1, 0] } }
          }
        }
      ])
    ]);

    const summary = globalStats?.[0] || {
      totalOrders: 0,
      pendingCount: 0,
      shippingCount: 0,
      returnRequestedCount: 0,
      returnCompletedCount: 0
    };

    return res.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      summary
    });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Không thể tải danh sách đơn hàng' });
  }
});

// ======================= ADMIN ORDER DETAIL =======================
router.get('/admin/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const order = await Order.findById(req.params.id).populate('items.productId').lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });

    let user = null;
    if (order.userId && mongoose.Types.ObjectId.isValid(String(order.userId))) {
      user = await User.findById(order.userId).select('customerID username phone email').lean();
    } else if (order.customer?.phone) {
      const digits = normalizePhone(order.customer.phone);
      const candidates = await User.find({ role: 'user' })
        .select('customerID username phone email')
        .lean();
      user = candidates.find(u => normalizePhone(u.phone) === digits) || null;
    }

    const spendFilter = user?._id
      ? { userId: user._id, status: { $ne: 'cancelled' } }
      : { 'customer.phone': order.customer?.phone, status: { $ne: 'cancelled' } };

    const [stats] = await Order.aggregate([
      { $match: spendFilter },
      { $group: { _id: null, totalOrders: { $sum: 1 }, totalSpent: { $sum: '$total' } } }
    ]);

    const totalOrders = Number(stats?.totalOrders || 0);
    const totalSpent = Number(stats?.totalSpent || 0);

    return res.json({
      ...order,
      customerSummary: {
        customerID: user?.customerID || '',
        membershipTier: getMembershipTier(totalSpent),
        totalOrders,
        totalSpent
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// ======================= ADMIN UPDATE STATUS =======================
router.patch('/admin/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!ORDER_STATUS.includes(status)) {
      return res.status(400).json({ message: 'Status không hợp lệ' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const current = order.status;
    if (current === status) {
      return res.status(400).json({ message: 'Đơn hàng đã ở trạng thái này' });
    }

    const next = NEXT_STATUS[current] || [];
    if (!next.includes(status)) {
      return res.status(400).json({
        message: `Không thể chuyển từ "${current}" sang "${status}"`,
        allowedTransitions: next
      });
    }

    order.status = status;
    await order.save();

    await OrderAuditLog.create({
      orderId: order._id,
      adminId: String(req.user?.userId || 'unknown-admin'),
      action: 'status_change',
      fromValue: current,
      toValue: status,
      note: String(note || '')
    });

    return res.json(order);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// ======================= ADMIN UPDATE RETURN STATUS =======================
router.patch('/admin/:id/return-status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { returnStatus, note, returnReason } = req.body;
    if (!RETURN_STATUS.includes(returnStatus)) {
      return res.status(400).json({ message: 'Trạng thái trả hàng/hoàn tiền không hợp lệ' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.status !== 'delivered') {
      return res.status(400).json({ message: 'Chỉ đơn đã giao mới được xử lý trả hàng/hoàn tiền' });
    }

    const current = order.returnStatus || 'none';
    if (current === returnStatus) {
      return res.status(400).json({ message: 'Đơn đã ở trạng thái trả hàng/hoàn tiền này' });
    }

    const returnFlow = {
      none: ['requested'],
      requested: ['completed'],
      completed: []
    };
    if (!(returnFlow[current] || []).includes(returnStatus)) {
      return res.status(400).json({
        message: `Không thể chuyển returnStatus từ "${current}" sang "${returnStatus}"`,
        allowedTransitions: returnFlow[current] || []
      });
    }

    order.returnStatus = returnStatus;
    if (returnStatus === 'requested') {
      order.returnRequestedAt = new Date();
      order.returnReason = String(returnReason || '');
    }
    if (returnStatus === 'completed') {
      order.returnCompletedAt = new Date();
    }
    await order.save();

    await OrderAuditLog.create({
      orderId: order._id,
      adminId: String(req.user?.userId || 'unknown-admin'),
      action: 'return_status_change',
      fromValue: current,
      toValue: returnStatus,
      note: String(note || '')
    });

    return res.json(order);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
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