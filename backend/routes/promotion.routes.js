const express   = require('express');
const router    = express.Router();
const mongoose  = require('mongoose');
const promoCtrl = require('../controllers/Promotion.controller');
const Promotion = require('../models/Promotion');
const Product   = require('../models/Product');
const Order     = require('../models/Order');
const User      = require('../models/User');
const { optionalAuth } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: kiểm tra toàn bộ điều kiện của một promotion
// Trả về { ok: true } nếu hợp lệ, hoặc { ok: false, message } nếu không.
// Dùng chung cho cả /apply lẫn /available.
// ─────────────────────────────────────────────────────────────────────────────
async function validatePromotion(promo, { subTotal, shippingFee, userId, userRank, cartProductIds }) {
  const now = new Date();

  // 1. Trạng thái
  if (promo.status === 'expired') {
    return { ok: false, message: 'Voucher đã hết hạn' };
  }

  // 2. Thời gian
  const start = promo.startDate ? new Date(promo.startDate) : null;
  const end   = promo.endDate   ? new Date(promo.endDate)   : null;
  if (start && now < start) {
    return { ok: false, message: 'Voucher chưa đến thời gian sử dụng' };
  }
  if (end && now > end) {
    return { ok: false, message: 'Voucher đã hết hạn' };
  }

  // 3. Tổng lượt dùng toàn hệ thống
  if (promo.totalLimit > 0 && promo.usedCount >= promo.totalLimit) {
    return { ok: false, message: 'Voucher đã hết lượt sử dụng' };
  }

  // 4. Đơn tối thiểu
  if ((subTotal || 0) < promo.minOrder) {
    return {
      ok: false,
      message: `Đơn hàng tối thiểu ${promo.minOrder.toLocaleString('vi-VN')}₫ để dùng mã này`
    };
  }

  // 5. Hạng thành viên
  if (promo.allowedMemberRanks && promo.allowedMemberRanks.length > 0) {
    if (!userRank || !promo.allowedMemberRanks.includes(userRank)) {
      const rankLabel = { member: 'Thành viên', vip: 'VIP' };
      const required  = promo.allowedMemberRanks.map(r => rankLabel[r] || r).join(', ');
      return { ok: false, message: `Mã này chỉ dành cho hạng: ${required}` };
    }
  }

  // 6. Chỉ đơn đầu tiên (firstOrderOnly)
  if (promo.firstOrderOnly) {
    if (!userId) {
      // Khách vãng lai không được dùng voucher firstOrderOnly
      // (vì không xác định được lịch sử đặt hàng)
      return { ok: false, message: 'Mã này chỉ dành cho thành viên đặt đơn đầu tiên' };
    }
    const prevCount = await Order.countDocuments({
      userId: new mongoose.Types.ObjectId(String(userId)),
      status: { $ne: 'cancelled' }
    });
    if (prevCount > 0) {
      return { ok: false, message: 'Mã này chỉ áp dụng cho đơn hàng đầu tiên' };
    }
  }

  // 7. Giới hạn số lần dùng per-user (userLimit)
  if (promo.userLimit > 0 && userId) {
    const userUsedCount = await Order.countDocuments({
      userId: new mongoose.Types.ObjectId(String(userId)),
      status: { $ne: 'cancelled' },
      $or: [
        { voucherCode:     promo.code },
        { shipVoucherCode: promo.code }
      ]
    });
    if (userUsedCount >= promo.userLimit) {
      return {
        ok: false,
        message: `Bạn đã dùng mã này tối đa ${promo.userLimit} lần`
      };
    }
  }

  // 8. Phạm vi áp dụng (applyScope)
  // Product.cat là String (tên category), không phải ObjectId.
  // appliedCategoryIds trong Promotion lưu ObjectId của Category.
  // → Cần join qua bảng Category để lấy tên, rồi so với Product.cat.
  if (promo.applyScope === 'category' && promo.appliedCategoryIds?.length > 0) {
    if (!cartProductIds || cartProductIds.length === 0) {
      return { ok: false, message: 'Mã này chỉ áp dụng cho một số danh mục sản phẩm nhất định' };
    }

    // Lấy tên các category được phép
    const Category = require('../models/Categories');
    const cats = await Category.find({
      _id: { $in: promo.appliedCategoryIds }
    }).select('name').lean();
    const allowedCatNames = cats.map(c => c.name);

    if (allowedCatNames.length === 0) {
      return { ok: false, message: 'Mã này chỉ áp dụng cho một số danh mục sản phẩm nhất định' };
    }

    // Kiểm tra ít nhất 1 sản phẩm trong giỏ thuộc danh mục được phép
    const matchingProduct = await Product.findOne({
      _id: { $in: cartProductIds.map(id => {
        try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
      }).filter(Boolean) },
      cat: { $in: allowedCatNames }
    }).lean();

    if (!matchingProduct) {
      return {
        ok: false,
        message: `Mã này chỉ áp dụng cho: ${allowedCatNames.join(', ')}`
      };
    }
  }

  if (promo.applyScope === 'product' && promo.appliedProductIds?.length > 0) {
    if (!cartProductIds || cartProductIds.length === 0) {
      return { ok: false, message: 'Mã này chỉ áp dụng cho một số sản phẩm nhất định' };
    }

    const allowedSet = new Set(promo.appliedProductIds.map(id => String(id)));
    const hasMatch   = cartProductIds.some(id => allowedSet.has(String(id)));

    if (!hasMatch) {
      return { ok: false, message: 'Mã này chỉ áp dụng cho một số sản phẩm nhất định' };
    }
  }

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: tính tiền giảm
// ─────────────────────────────────────────────────────────────────────────────
function calcDiscount(promo, subTotal, shippingFee) {
  let discountAmount    = 0;
  const discountOnType  = (promo.type === 'shipping') ? 'shipping' : 'items';

  if (promo.type === 'shipping') {
    if (promo.discountType === 'percent') {
      discountAmount = Math.round(Number(shippingFee) * promo.discountValue / 100);
      if (promo.maxDiscount > 0 && discountAmount > promo.maxDiscount) {
        discountAmount = promo.maxDiscount;
      }
    } else if (promo.discountType === 'fixed') {
      discountAmount = Math.min(promo.discountValue, Number(shippingFee));
    } else {
      // freeship
      discountAmount = Math.min(Number(shippingFee), promo.maxDiscount > 0 ? promo.maxDiscount : Number(shippingFee));
    }
  } else {
    if (promo.discountType === 'percent') {
      discountAmount = Math.round(Number(subTotal) * promo.discountValue / 100);
      if (promo.maxDiscount > 0 && discountAmount > promo.maxDiscount) {
        discountAmount = promo.maxDiscount;
      }
    } else if (promo.discountType === 'fixed') {
      discountAmount = promo.discountValue;
    }
  }

  return { discountAmount, discountOnType };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: lấy userId + userRank từ request (optionalAuth đã decode token)
// ─────────────────────────────────────────────────────────────────────────────
async function resolveUser(req) {
  if (!req.user?.userId) return { userId: null, userRank: null };
  const u = await User.findById(req.user.userId).select('memberRank').lean();
  return {
    userId:   String(req.user.userId),
    userRank: u?.memberRank || 'member'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/promotions — danh sách đầy đủ (admin)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', promoCtrl.getAllPromotions);

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /api/promotions — tạo mới (admin)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', promoCtrl.createPromotion);

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/promotions/apply
//    Body: { code, subTotal, shippingFee, cartProductIds? }
//    cartProductIds: mảng productId trong giỏ hàng (cần để check applyScope)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/apply', optionalAuth, async (req, res) => {
  try {
    const {
      code,
      subTotal       = 0,
      shippingFee    = 0,
      cartProductIds = []           // frontend cần truyền thêm field này
    } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ valid: false, message: 'Vui lòng nhập mã voucher' });
    }

    const { userId, userRank } = await resolveUser(req);

    const promo = await Promotion.findOne({ code: code.trim().toUpperCase() });
    if (!promo) {
      return res.status(404).json({ valid: false, message: 'Mã voucher không tồn tại' });
    }

    const check = await validatePromotion(promo, {
      subTotal,
      shippingFee,
      userId,
      userRank,
      cartProductIds
    });

    if (!check.ok) {
      return res.status(400).json({ valid: false, message: check.message });
    }

    const { discountAmount, discountOnType } = calcDiscount(promo, subTotal, shippingFee);

    return res.json({
      valid:         true,
      code:          promo.code,
      name:          promo.name,
      description:   promo.description || '',
      type:          promo.type,
      discountType:  promo.discountType,
      discountValue: promo.discountValue,
      discountOnType,
      discountAmount,
      message:       '✓ Áp dụng thành công!',
    });

  } catch (err) {
    console.error('Apply voucher error:', err);
    res.status(500).json({ valid: false, message: 'Lỗi server khi kiểm tra voucher' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /api/promotions/available
//    Query: ?subTotal=&shippingFee=&cartProductIds=id1,id2,...
//    Trả về danh sách voucher hợp lệ với user hiện tại.
//    Voucher không đủ điều kiện (hạng, firstOrderOnly, userLimit, scope)
//    vẫn trả về nhưng kèm { eligible: false, ineligibleReason }.
//    Riêng voucher hết lượt toàn hệ thống / hết hạn → loại luôn.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/available', optionalAuth, async (req, res) => {
  try {
    const now          = new Date();
    const subTotal     = Number(req.query.subTotal    || 0);
    const shippingFee  = Number(req.query.shippingFee || 0);
    // Frontend truyền dạng ?cartProductIds=id1,id2,id3
    const cartProductIds = req.query.cartProductIds
      ? String(req.query.cartProductIds).split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const { userId, userRank } = await resolveUser(req);

    // Lấy tất cả voucher đang ongoing và chưa hết lượt toàn hệ thống
    const all = await Promotion.find({
      status:    'ongoing',
      startDate: { $lte: now },
      endDate:   { $gte: now },
      $or: [
        { totalLimit: 0 },
        { $expr: { $lt: ['$usedCount', '$totalLimit'] } }
      ]
    })
    .select('code name description type discountType discountValue minOrder maxDiscount startDate endDate allowedMemberRanks applyScope appliedCategoryIds appliedProductIds firstOrderOnly userLimit')
    .lean();

    // Kiểm tra từng voucher
    const results = await Promise.all(all.map(async (p) => {
      const check = await validatePromotion(p, {
        subTotal,
        shippingFee,
        userId,
        userRank,
        cartProductIds
      });

      const base = {
        code:         p.code,
        name:         p.name,
        description:  p.description || '',
        type:         p.type,
        discountType: p.discountType,
        discountValue: p.discountValue,
        minOrder:     p.minOrder,
        maxDiscount:  p.maxDiscount,
        // Hiển thị badge "Chỉ VIP" trên UI
        vipOnly:      (p.allowedMemberRanks || []).includes('vip') && !(p.allowedMemberRanks || []).includes('member'),
      };

      if (check.ok) {
        return { ...base, eligible: true };
      } else {
        return { ...base, eligible: false, ineligibleReason: check.message };
      }
    }));

    // Sắp xếp: eligible trước, ineligible sau; trong mỗi nhóm sort theo minOrder tăng dần
    results.sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return (a.minOrder || 0) - (b.minOrder || 0);
    });

    res.json(results);
  } catch (err) {
    console.error('Available voucher error:', err);
    res.status(500).json({ message: 'Lỗi lấy danh sách voucher' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. PUT /api/promotions/bulk-group (phải khai báo trước :id)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/bulk-group', promoCtrl.bulkGroupPromotions);

// ─────────────────────────────────────────────────────────────────────────────
// 6. PUT /api/promotions/:id
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', promoCtrl.updatePromotion);

// ─────────────────────────────────────────────────────────────────────────────
// 7. DELETE /api/promotions/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', promoCtrl.deletePromotion);

module.exports = router;