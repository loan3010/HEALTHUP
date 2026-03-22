const express  = require('express');
const mongoose = require('mongoose');
const path     = require('path');
const fs       = require('fs');
const jwt      = require('jsonwebtoken');
const router   = express.Router();
const multer   = require('multer');

const Order   = require('../models/Order');
const Product = require('../models/Product');
const Cart    = require('../models/Cart');
const User    = require('../models/User');
const Promotion = require('../models/Promotion');
const OrderAuditLog = require('../models/OrderAuditLog');
const Notification = require('../models/Notification');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { buildCustomerListStatsMaps, statsForUser } = require('../helpers/customerOrderStats');
const { findOrCreateGuestUser } = require('../helpers/guestUser');
const { isValidGuestCartSessionId } = require('../helpers/cartIdentity');

function jwtSecretOrders() {
  return process.env.JWT_SECRET || 'secret_key';
}

/** Bearer token từ checkout đã đăng nhập (dùng voucher). */
function extractBearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  return typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

// ======================= MULTER CONFIG =======================
// Lưu ảnh vào backend/public/uploads/returns/
const returnStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/images/returns');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `return_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file ảnh (jpg, png, webp, gif)'), false);
  }
};

const uploadReturnImages = multer({
  storage: returnStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB mỗi ảnh
}).array('images', 5); // tối đa 5 ảnh

// ======================= HELPER =======================

function isValidPhoneVN(phone) {
  return /^0\d{9}$/.test(String(phone || '').trim());
}

function calcShipping(subTotal, shippingMethod) {
  if (shippingMethod === 'express') return 30000;
  return subTotal > 500000 ? 0 : 20000;
}

async function calcDiscountFromDB(voucherCode, subTotal, shippingFee) {
  if (!voucherCode) return { discountAmount: 0, discountOnType: null };

  const now   = new Date();
  const promo = await Promotion.findOne({
    code:      voucherCode.trim().toUpperCase(),
    status:    'ongoing',
    startDate: { $lte: now },
    endDate:   { $gte: now },
  });

  if (!promo) return { discountAmount: 0, discountOnType: null };
  if (promo.totalLimit > 0 && promo.usedCount >= promo.totalLimit) {
    return { discountAmount: 0, discountOnType: null };
  }
  if (subTotal < promo.minOrder) return { discountAmount: 0, discountOnType: null };

  let discountAmount = 0;
  const discountOnType = (promo.type === 'shipping') ? 'shipping' : 'items';

  if (promo.type === 'shipping') {
    if (promo.discountType === 'percent') {
      discountAmount = Math.round(Number(shippingFee) * promo.discountValue / 100);
      if (promo.maxDiscount > 0 && discountAmount > promo.maxDiscount) {
        discountAmount = promo.maxDiscount;
      }
    } else if (promo.discountType === 'fixed') {
      discountAmount = Math.min(promo.discountValue, Number(shippingFee));
    } else {
      discountAmount = Number(shippingFee);
    }
  } else {
    if (promo.discountType === 'percent') {
      discountAmount = Math.round(subTotal * promo.discountValue / 100);
      if (promo.maxDiscount > 0 && discountAmount > promo.maxDiscount) {
        discountAmount = promo.maxDiscount;
      }
    } else if (promo.discountType === 'fixed') {
      discountAmount = promo.discountValue;
    }
  }

  return { discountAmount, discountOnType };
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

// ✅ Helper format tiền VND (từ nhánh THnew)
function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency', currency: 'VND'
  }).format(amount);
}

/**
 * Chuẩn hoá từng phần tỉnh/huyện/xã khi lưu đơn.
 * Trước đây dùng chữ "N/A" khi checkout không tách cấp hành chính → hiển thị rối; để rỗng thay vì N/A.
 * (từ nhánh main)
 */
function normalizeShippingPart(v) {
  const s = String(v ?? '').trim();
  if (!s || /^n\/a$/i.test(s)) return '';
  return s;
}

const ORDER_STATUS = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];
const RETURN_STATUS = ['none', 'requested', 'approved', 'rejected', 'completed'];

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

/**
 * Ghi yêu cầu đổi trả lên đơn (dùng chung user JWT + guest).
 */
async function persistOrderReturnRequest(order, { reason, note, parsedItems, files, auditWho }) {
  const imageUrls = (files || []).map((f) => `/images/returns/${f.filename}`);

  order.returnStatus      = 'requested';
  order.returnRequestedAt = new Date();
  order.returnReason      = String(reason || '');
  order.returnNote        = String(note || '');
  order.returnImages      = imageUrls;

  if (Array.isArray(parsedItems) && parsedItems.length > 0) {
    order.returnItems = parsedItems.map((i) => ({
      productId: i.productId,
      name:      i.name,
      imageUrl:  i.imageUrl || '',
      price:     Number(i.price || 0),
      quantity:  Number(i.quantity || 0),
      returnQty: Number(i.returnQty || 0),
    }));
  }

  await order.save();

  await OrderAuditLog.create({
    orderId:   order._id,
    adminId:   String(auditWho || 'user'),
    action:    'return_status_change',
    fromValue: 'none',
    toValue:   'requested',
    note:      `Yêu cầu: ${reason}${note ? ' — ' + note : ''}`,
  });
}

/**
 * Chuẩn bị payload đơn hàng từ body (checkout công khai + admin hotline + preview).
 * Dùng chung để tạm tính trên admin khớp 100% với lúc lưu DB.
 */
/**
 * @param {object} opts
 * @param {boolean} [opts.allowVouchers=true] — false = khách không đăng nhập (guest), bỏ mã KM
 * @param {string|mongoose.Types.ObjectId} [opts.lockedUserId] — gán userId đơn (JWT user hoặc guest)
 */
async function prepareOrderFromRequestBody(body, opts = {}) {
  const allowVouchers = opts.allowVouchers !== false;
  const lockedUserId  = opts.lockedUserId;

  const {
    customer,
    items,
    shippingMethod,
    paymentMethod,
    voucherCode: voucherCodeBody,
    shipVoucherCode: shipVoucherBody,
    userId
  } = body || {};

  const voucherCode = allowVouchers && voucherCodeBody
    ? String(voucherCodeBody).trim()
    : null;
  const shipVoucherCode = allowVouchers && shipVoucherBody
    ? String(shipVoucherBody).trim()
    : null;

  if (!customer?.fullName || !customer?.phone || !customer?.address) {
    return { ok: false, status: 400, payload: { message: 'Thiếu thông tin khách hàng' } };
  }
  if (!isValidPhoneVN(customer.phone)) {
    return { ok: false, status: 400, payload: { message: 'Số điện thoại không hợp lệ' } };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, status: 400, payload: { message: 'Giỏ hàng trống' } };
  }

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
    return { ok: false, status: 400, payload: { message: 'productId không hợp lệ', invalidIds } };
  }

  const invalidVariantIds = normalizedIn
    .filter(i => i.variantId && !mongoose.Types.ObjectId.isValid(i.variantId))
    .map(i => i.variantId);

  if (invalidVariantIds.length) {
    return { ok: false, status: 400, payload: { message: 'variantId không hợp lệ', invalidVariantIds } };
  }

  const ids      = normalizedIn.map(i => new mongoose.Types.ObjectId(i.productId));
  const products = await Product.find({ _id: { $in: ids } }).lean();
  const map      = new Map(products.map(p => [String(p._id), p]));

  const missing = normalizedIn
    .filter(i => !map.has(i.productId))
    .map(i => i.productId);

  if (missing.length) {
    return { ok: false, status: 400, payload: { message: 'Có sản phẩm không tồn tại', missing } };
  }

  let subTotal   = 0;
  const orderItems = [];

  for (const i of normalizedIn) {
    const p = map.get(i.productId);
    let variant = null;

    if (i.variantId && mongoose.Types.ObjectId.isValid(i.variantId)) {
      variant = (p.variants || []).find(v => String(v._id) === String(i.variantId));
      if (!variant) {
        return {
          ok: false,
          status: 400,
          payload: { message: `Biến thể không tồn tại cho sản phẩm ${p.name}` }
        };
      }
    }

    const qty       = i.quantity;
    const available = Number(variant?.stock ?? p.stock ?? 0);
    if (qty > available) {
      return {
        ok: false,
        status: 400,
        payload: { message: `Sản phẩm "${p.name}" chỉ còn ${available} trong kho` }
      };
    }

    const price = Number(variant?.price ?? p.price ?? 0);
    subTotal   += price * qty;

    orderItems.push({
      productId:    p._id,
      variantId:    variant?._id || null,
      variantLabel: variant?.label || i.variantLabel || '',
      name:         p.name || 'Product',
      price,
      quantity:     qty,
      imageUrl:     p.images?.[0] ?? null,
    });
  }

  const ship = calcShipping(subTotal, shippingMethod);

  const { discountAmount: discOrder } =
    await calcDiscountFromDB(voucherCode || '', subTotal, ship);

  const { discountAmount: discShip } =
    await calcDiscountFromDB(shipVoucherCode || '', subTotal, ship);

  const totalDiscount = discOrder + discShip;
  const total = Math.max(0, subTotal - discOrder + ship - discShip);

  const orderData = {
    customer: {
      fullName: customer.fullName,
      phone:    customer.phone,
      email:    customer.email || '',
      address:  customer.address,
      // Khách checkout một ô địa chỉ: có thể rỗng (schema Order — province/district/ward không bắt buộc).
      province: normalizeShippingPart(customer.province),
      district: normalizeShippingPart(customer.district),
      ward:     normalizeShippingPart(customer.ward),
      note:     customer.note     || '',
    },
    items:           orderItems,
    shippingMethod:  shippingMethod || 'standard',
    paymentMethod:   paymentMethod  || 'cod',
    voucherCode:     voucherCode || null,
    shipVoucherCode: shipVoucherCode || null,
    subTotal,
    shippingFee:     ship,
    discount:        totalDiscount,
    discountOnItems:    discOrder,
    discountOnShipping: discShip,
    total,
    status:  'pending',
    userId:  null,
  };

  if (lockedUserId && mongoose.Types.ObjectId.isValid(String(lockedUserId))) {
    orderData.userId = new mongoose.Types.ObjectId(String(lockedUserId));
  } else if (userId && mongoose.Types.ObjectId.isValid(String(userId))) {
    orderData.userId = new mongoose.Types.ObjectId(String(userId));
  }

  return {
    ok: true,
    orderData,
    orderItems,
    voucherCodeRaw: allowVouchers && voucherCode ? voucherCode : null,
    shipVoucherCodeRaw: allowVouchers && shipVoucherCode ? shipVoucherCode : null,
  };
}

/**
 * Lưu đơn sau khi prepareOrderFromRequestBody thành công (mã đơn, voucher, cart, kho).
 */
async function persistNewOrder(
  orderData,
  orderItems,
  voucherCodeRaw,
  shipVoucherCodeRaw,
  guestCartSessionId = null
) {
  let order = null;
  let lastErr = null;
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

  const voucherUpdates = [];
  if (voucherCodeRaw) {
    voucherUpdates.push(
      Promotion.updateOne(
        { code: String(voucherCodeRaw).trim().toUpperCase() },
        { $inc: { usedCount: 1 } }
      )
    );
  }
  if (shipVoucherCodeRaw) {
    voucherUpdates.push(
      Promotion.updateOne(
        { code: String(shipVoucherCodeRaw).trim().toUpperCase() },
        { $inc: { usedCount: 1 } }
      )
    );
  }
  if (voucherUpdates.length) await Promise.all(voucherUpdates);

  const boughtIds = orderItems.map(i => String(i.productId));
  const stripPurchasedFromCart = async filter => {
    try {
      const cart = await Cart.findOne(filter);
      if (!cart) return;
      cart.items = cart.items.filter(i => !boughtIds.includes(String(i.productId)));
      await cart.save();
    } catch (_e) { /* ignore */ }
  };

  // Giỏ theo tài khoản (user / guest user sau khi tạo đơn vẫn có order.userId).
  if (order.userId) {
    await stripPurchasedFromCart({ userId: order.userId });
  }
  // Giỏ API theo phiên khách (x-guest-cart-id) — khác với userId document User guest.
  if (guestCartSessionId && isValidGuestCartSessionId(guestCartSessionId)) {
    await stripPurchasedFromCart({
      guestSessionId: String(guestCartSessionId).trim(),
    });
  }

  for (const item of orderItems) {
    const p = await Product.findById(item.productId);
    if (!p) continue;

    if (item.variantId) {
      const idx = (p.variants || []).findIndex(
        v => String(v._id) === String(item.variantId)
      );
      if (idx >= 0) {
        p.variants[idx].stock = Math.max(
          0,
          Number(p.variants[idx].stock || 0) - Number(item.quantity || 0)
        );
      }
    } else {
      p.stock = Math.max(
        0,
        Number(p.stock || 0) - Number(item.quantity || 0)
      );
    }

    if (Array.isArray(p.variants) && p.variants.length > 0) {
      p.stock = p.variants.reduce((sum, v) => sum + Number(v.stock || 0), 0);
    }

    p.sold = Number(p.sold || 0) + Number(item.quantity || 0);

    await p.save();
  }

  return order;
}

// ======================= CREATE ORDER (checkout khách — công khai) =======================

router.post('/', async (req, res) => {
  try {
    let allowVouchers = false;
    let lockedUserId    = null;

    const token = extractBearer(req);
    if (token) {
      try {
        const decoded = jwt.verify(token, jwtSecretOrders());
        const u = await User.findById(decoded.userId).select('role').lean();
        if (u && u.role === 'user') {
          if (req.body?.userId && String(req.body.userId) !== String(decoded.userId)) {
            return res.status(403).json({
              message: 'Thông tin đăng nhập không khớp với tài khoản đặt hàng.',
            });
          }
          lockedUserId = decoded.userId;
          allowVouchers = true;
        }
      } catch (_e) {
        /* token hết hạn / sai → xử lý như khách */
      }
    }

    if (!lockedUserId) {
      const cust = req.body?.customer;
      if (!cust?.phone) {
        return res.status(400).json({ message: 'Thiếu thông tin khách hàng' });
      }
      const g = await findOrCreateGuestUser(cust.phone, cust.fullName, cust.email);
      if (!g.ok) return res.status(400).json({ message: g.message });
      lockedUserId = g.userId;
      allowVouchers = false;
    }

    const prep = await prepareOrderFromRequestBody(req.body, {
      allowVouchers,
      lockedUserId,
    });
    if (!prep.ok) {
      return res.status(prep.status).json(prep.payload);
    }

    const guestCartRaw = String(req.body?.guestCartSessionId || '').trim();
    const guestCartSessionId = isValidGuestCartSessionId(guestCartRaw)
      ? guestCartRaw
      : null;

    const order = await persistNewOrder(
      prep.orderData,
      prep.orderItems,
      prep.voucherCodeRaw,
      prep.shipVoucherCodeRaw,
      guestCartSessionId
    );

    // ✅ Tạo notification cho user sau khi đặt hàng thành công (từ nhánh THnew)
    if (order.userId) {
      try {
        const firstItem = prep.orderItems[0];
        const extraCount = prep.orderItems.length - 1;
        const productSummary = extraCount > 0
          ? `${firstItem.name} và ${extraCount} sản phẩm khác`
          : firstItem.name;

        await Notification.create({
          userId:  order.userId,
          title:   `Đặt hàng thành công 🎉`,
          message: `Đơn hàng ${order.orderCode}: ${productSummary} — Tổng tiền ${formatVND(order.total)}`,
          type:    'order',
          orderId: order._id,
          isRead:  false,
        });
      } catch (e) {
        console.error('Tạo notification thất bại:', e);
      }
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
    // Populate ảnh SP: nhiều đơn thiếu imageUrl trên dòng hàng — cần cho trang đổi trả.
    const orders = await Order.find(filter)
      .populate({ path: 'items.productId', select: 'images name' })
      .sort({ createdAt: -1 });
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
    const orders = await Order.find({ userId })
      .populate({ path: 'items.productId', select: 'images name' })
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ======================= ADMIN ORDER LIST =======================
router.get('/admin/list', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page  = Math.max(1, Number(req.query.page  || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    const skip  = (page - 1) * limit;
    const filter = buildAdminOrderFilter(req.query);
    const sort   = getAdminSort(req.query.sortBy, req.query.sortDir);

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
            returnApprovedCount: { $sum: { $cond: [{ $eq: ['$returnStatus', 'approved'] }, 1, 0] } },
            returnRejectedCount: { $sum: { $cond: [{ $eq: ['$returnStatus', 'rejected'] }, 1, 0] } },
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
      returnApprovedCount: 0,
      returnRejectedCount: 0,
      returnCompletedCount: 0
    };

    return res.json({ data, total, page, totalPages: Math.ceil(total / limit) || 1, summary });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Không thể tải danh sách đơn hàng' });
  }
});

// ======================= ADMIN HOTLINE: xem trước tiền (không ghi DB) =======================
router.post('/admin/hotline-preview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const prep = await prepareOrderFromRequestBody(req.body);
    if (!prep.ok) {
      return res.status(prep.status).json(prep.payload);
    }
    const { orderData, orderItems } = prep;
    return res.json({
      subTotal: orderData.subTotal,
      shippingFee: orderData.shippingFee,
      discount: orderData.discount,
      discountOnItems: orderData.discountOnItems,
      discountOnShipping: orderData.discountOnShipping,
      total: orderData.total,
      items: orderItems.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        variantLabel: i.variantLabel,
        lineTotal: i.price * i.quantity,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err?.message || 'Server error' });
  }
});

// ======================= ADMIN HOTLINE: tạo đơn (có JWT admin) =======================
router.post('/admin/hotline', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const prep = await prepareOrderFromRequestBody(req.body);
    if (!prep.ok) {
      return res.status(prep.status).json(prep.payload);
    }
    const order = await persistNewOrder(
      prep.orderData,
      prep.orderItems,
      prep.voucherCodeRaw,
      prep.shipVoucherCodeRaw
    );
    return res.status(201).json({ orderId: order._id, orderCode: order.orderCode });
  } catch (err) {
    console.error(err);
    if (err?.name === 'CastError') {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }
    return res.status(500).json({ message: err?.message || 'Server error' });
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
      const digits     = normalizePhone(order.customer.phone);
      const candidates = await User.find({ role: 'user' }).select('customerID username phone email').lean();
      user = candidates.find(u => normalizePhone(u.phone) === digits) || null;
    }

    const statsMaps = await buildCustomerListStatsMaps(Order);
    let stats;
    if (user) {
      stats = statsForUser(user, statsMaps);
    } else {
      const k = normalizePhone(order.customer?.phone);
      stats = k
        ? (statsMaps.byPhoneNorm.get(k) || { totalOrders: 0, totalSpent: 0, hasProvisionalSpend: false })
        : { totalOrders: 0, totalSpent: 0, hasProvisionalSpend: false };
    }

    const totalOrders = stats.totalOrders;
    const totalSpent = stats.totalSpent;

    return res.json({
      ...order,
      customerSummary: {
        customerID:     user?.customerID || '',
        membershipTier: getMembershipTier(totalSpent),
        totalOrders,
        totalSpent,
        hasProvisionalSpend: stats.hasProvisionalSpend,
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
      orderId:   order._id,
      adminId:   String(req.user?.userId || 'unknown-admin'),
      action:    'status_change',
      fromValue: current,
      toValue:   status,
      note:      String(note || '')
    });

    // ✅ Gửi notification khi admin cập nhật trạng thái đơn hàng (từ nhánh THnew)
    if (order.userId) {
      try {
        const statusLabel = {
          confirmed: 'đã được xác nhận ✅',
          shipping:  'đang được giao 🚚',
          delivered: 'đã giao thành công 🎉',
          cancelled: 'đã bị hủy ❌',
        }[status] || status;

        await Notification.create({
          userId:  order.userId,
          title:   `Cập nhật đơn hàng`,
          message: `Đơn hàng ${order.orderCode} ${statusLabel}`,
          type:    'order',
          orderId: order._id,
          isRead:  false,
        });
      } catch (e) {
        console.error('Tạo notification thất bại:', e);
      }
    }

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

    // Luồng admin (khớp nghiệp vụ): chỉ user gọi PATCH /:id/request-return mới tạo requested.
    // Admin: requested → approved | rejected; approved → completed (sau khi nhận hàng trả & hoàn tiền).
    const returnFlow = {
      none: [],
      requested: ['approved', 'rejected'],
      approved: ['completed'],
      rejected: [],
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
      order.returnRejectionReason = '';
    }
    if (returnStatus === 'approved') {
      order.returnRejectionReason = '';
    }
    if (returnStatus === 'rejected') {
      order.returnRejectionReason = String(
        req.body.returnRejectionReason ?? req.body.note ?? ''
      ).trim().slice(0, 2000);
    }
    if (returnStatus === 'completed') {
      order.returnCompletedAt = new Date();
    }
    await order.save();

    await OrderAuditLog.create({
      orderId:   order._id,
      adminId:   String(req.user?.userId || 'unknown-admin'),
      action:    'return_status_change',
      fromValue: current,
      toValue:   returnStatus,
      note:      String(note || '')
    });

    return res.json(order);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// ======================= GUEST: tra cứu đơn =======================
router.post('/guest-lookup', async (req, res) => {
  try {
    const phone = String(req.body?.phone || '').trim();
    const rawCode = String(req.body?.orderCode || '').replace(/\s/g, '').toUpperCase();
    if (!isValidPhoneVN(phone)) {
      return res.status(400).json({ message: 'Số điện thoại không hợp lệ' });
    }
    if (!/^ORD\d{11}$/.test(rawCode)) {
      return res.status(400).json({ message: 'Mã đơn không hợp lệ (VD: ORD00000000001)' });
    }

    const order = await Order.findOne({ orderCode: rawCode })
      .populate({ path: 'items.productId', select: 'images name' })
      .lean();

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }
    if (normalizePhone(order.customer?.phone) !== normalizePhone(phone)) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    return res.json({ order });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ======================= GUEST: đổi trả (xác minh SĐT + mã đơn) =======================
router.patch('/:id/guest-request-return', (req, res) => {
  uploadReturnImages(req, res, async (uploadErr) => {
    try {
      if (uploadErr) {
        return res.status(400).json({ message: uploadErr.message || 'Lỗi upload ảnh' });
      }

      const { reason, note, items, phone, orderCode } = req.body;

      if (!reason) {
        (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));
        return res.status(400).json({ message: 'Vui lòng chọn lý do đổi trả' });
      }

      const phoneVal = String(phone || '').trim();
      const rawCode  = String(orderCode || '').replace(/\s/g, '').toUpperCase();
      if (!isValidPhoneVN(phoneVal)) {
        (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));
        return res.status(400).json({ message: 'Số điện thoại không hợp lệ' });
      }
      if (!/^ORD\d{11}$/.test(rawCode)) {
        (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));
        return res.status(400).json({ message: 'Mã đơn không hợp lệ' });
      }

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));
        return res.status(400).json({ message: 'ID không hợp lệ' });
      }

      const order = await Order.findById(req.params.id);
      if (!order) {
        (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));
        return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
      }

      if (String(order.orderCode || '').toUpperCase() !== rawCode) {
        (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));
        return res.status(403).json({ message: 'Mã đơn không khớp' });
      }
      if (normalizePhone(order.customer?.phone) !== normalizePhone(phoneVal)) {
        (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));
        return res.status(403).json({ message: 'Số điện thoại không khớp đơn hàng' });
      }

      if (order.status !== 'delivered') {
        (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));
        return res.status(400).json({ message: 'Chỉ có thể yêu cầu đổi trả cho đơn đã giao' });
      }

      if (order.returnStatus && order.returnStatus !== 'none') {
        (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));
        return res.status(400).json({ message: 'Đơn hàng này đã có yêu cầu đổi trả rồi' });
      }

      let parsedItems = [];
      if (items) {
        try {
          parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
        } catch {
          parsedItems = [];
        }
      }

      await persistOrderReturnRequest(order, {
        reason,
        note,
        parsedItems,
        files: req.files || [],
        auditWho: 'guest-lookup',
      });

      return res.json({ message: 'Yêu cầu đổi trả đã được gửi', order });
    } catch (err) {
      (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));
      return res.status(500).json({ message: err?.message || 'Server error' });
    }
  });
});

// ======================= GET ORDER BY ID =======================

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let order;

    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id).populate('items.productId');
    }

    if (!order) {
      order = await Order.findOne({ orderCode: id }).populate('items.productId');
    }

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

    const order = await Order.findByIdAndUpdate(
      req.params.id, { status }, { new: true }
    );
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // ✅ Tạo notification khi user tự hủy đơn (từ nhánh THnew)
    if (status === 'cancelled' && order.userId) {
      try {
        await Notification.create({
          userId:  order.userId,
          title:   '❌ Đơn hàng đã bị hủy',
          message: `Đơn hàng ${order.orderCode} đã được hủy thành công`,
          type:    'order',
          orderId: order._id,
          isRead:  false,
        });
      } catch (e) {}
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ======================= USER REQUEST RETURN (có upload ảnh) =======================
// POST multipart/form-data với fields: reason, note, items (JSON string), images (files)

router.patch('/:id/request-return', authenticateToken, (req, res) => {
  uploadReturnImages(req, res, async (uploadErr) => {
    try {
      if (uploadErr) {
        return res.status(400).json({ message: uploadErr.message || 'Lỗi upload ảnh' });
      }

      const { reason, note, items } = req.body;

      if (!reason) {
        // Xóa ảnh vừa upload nếu validate fail
        (req.files || []).forEach(f => fs.unlink(f.path, () => {}));
        return res.status(400).json({ message: 'Vui lòng chọn lý do đổi trả' });
      }

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        (req.files || []).forEach(f => fs.unlink(f.path, () => {}));
        return res.status(400).json({ message: 'ID không hợp lệ' });
      }

      const order = await Order.findById(req.params.id);
      if (!order) {
        (req.files || []).forEach(f => fs.unlink(f.path, () => {}));
        return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
      }

      if (order.status !== 'delivered') {
        (req.files || []).forEach(f => fs.unlink(f.path, () => {}));
        return res.status(400).json({ message: 'Chỉ có thể yêu cầu đổi trả cho đơn đã giao' });
      }

      // Chỉ chủ đơn (user đăng nhập) được gửi yêu cầu — khớp flow, tránh lạm dụng ID đơn.
      const tokenUserId = req.user?.userId && String(req.user.userId);
      const orderUserId = order.userId && String(order.userId);
      if (!tokenUserId || !orderUserId || tokenUserId !== orderUserId) {
        (req.files || []).forEach(f => fs.unlink(f.path, () => {}));
        return res.status(403).json({
          message: 'Bạn chỉ có thể yêu cầu trả hàng cho đơn hàng của tài khoản mình',
        });
      }

      if (order.returnStatus && order.returnStatus !== 'none') {
        (req.files || []).forEach(f => fs.unlink(f.path, () => {}));
        return res.status(400).json({ message: 'Đơn hàng này đã có yêu cầu đổi trả rồi' });
      }

      let parsedItems = [];
      if (items) {
        try {
          parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
        } catch { parsedItems = []; }
      }

      await persistOrderReturnRequest(order, {
        reason,
        note,
        parsedItems,
        files: req.files || [],
        auditWho: req.user?.userId || 'user',
      });

      return res.json({ message: 'Yêu cầu đổi trả đã được gửi', order });
    } catch (err) {
      (req.files || []).forEach(f => fs.unlink(f.path, () => {}));
      return res.status(500).json({ message: err?.message || 'Server error' });
    }
  });
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