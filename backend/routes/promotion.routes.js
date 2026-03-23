const express   = require('express');
const router    = express.Router();
const mongoose  = require('mongoose');
const promoCtrl = require('../controllers/Promotion.controller');
const Promotion = require('../models/Promotion');
const User      = require('../models/User');
const { optionalAuth } = require('../middleware/auth');

// 1. Lấy danh sách: GET /api/promotions
router.get('/', promoCtrl.getAllPromotions);

// 2. Tạo mới: POST /api/promotions
router.post('/', promoCtrl.createPromotion);

// ── Apply voucher ────────────────────────────────────────────────
// POST /api/promotions/apply
router.post('/apply', optionalAuth, async (req, res) => {
  try {
    const { code, subTotal = 0, shippingFee = 0 } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ valid: false, message: 'Vui lòng nhập mã voucher' });
    }

    // Lấy hạng user nếu đã đăng nhập
    let userRank = null;
    if (req.user?.userId) {
      const u = await User.findById(req.user.userId).select('memberRank').lean();
      userRank = u?.memberRank || 'member';
    }

    const promo = await Promotion.findOne({ code: code.trim().toUpperCase() });

    if (!promo) {
      return res.status(404).json({ valid: false, message: 'Mã voucher không tồn tại' });
    }

    // Kiểm tra trạng thái
    if (promo.status === 'expired') {
      return res.status(400).json({ valid: false, message: 'Voucher đã hết hạn' });
    }

    // Kiểm tra thời gian
    const now   = new Date();
    const start = promo.startDate ? new Date(promo.startDate) : null;
    const end   = promo.endDate   ? new Date(promo.endDate)   : null;
    if (start && now < start) {
      return res.status(400).json({ valid: false, message: 'Voucher chưa đến thời gian sử dụng' });
    }
    if (end && now > end) {
      return res.status(400).json({ valid: false, message: 'Voucher đã hết hạn' });
    }

    // Kiểm tra lượt sử dụng
    if (promo.totalLimit > 0 && promo.usedCount >= promo.totalLimit) {
      return res.status(400).json({ valid: false, message: 'Voucher đã hết lượt sử dụng' });
    }

    // Kiểm tra đơn tối thiểu
    if (subTotal < promo.minOrder) {
      return res.status(400).json({
        valid: false,
        message: `Đơn hàng tối thiểu ${promo.minOrder.toLocaleString('vi-VN')}₫ để dùng mã này`
      });
    }

    // Kiểm tra hạng thành viên
    if (promo.allowedMemberRanks && promo.allowedMemberRanks.length > 0) {
      if (!userRank || !promo.allowedMemberRanks.includes(userRank)) {
        const rankLabel = { member: 'Thành viên', vip: 'VIP' };
        const required  = promo.allowedMemberRanks.map(r => rankLabel[r] || r).join(', ');
        return res.status(400).json({
          valid: false,
          message: `Mã này chỉ dành cho hạng: ${required}`
        });
      }
    }

    // Tính tiền giảm
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
        discountAmount = Math.round(Number(subTotal) * promo.discountValue / 100);
        if (promo.maxDiscount > 0 && discountAmount > promo.maxDiscount) {
          discountAmount = promo.maxDiscount;
        }
      } else if (promo.discountType === 'fixed') {
        discountAmount = promo.discountValue;
      }
    }

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

// ── Lấy danh sách voucher đang hoạt động (cho modal checkout) ───
// GET /api/promotions/available
router.get('/available', optionalAuth, async (req, res) => {
  try {
    const now = new Date();

    // Lấy hạng user nếu đã đăng nhập
    let userRank = null;
    if (req.user?.userId) {
      const u = await User.findById(req.user.userId).select('memberRank').lean();
      userRank = u?.memberRank || 'member';
    }

    const all = await Promotion.find({
      status: 'ongoing',
      $or: [
        { totalLimit: 0 },
        { $expr: { $lt: ['$usedCount', '$totalLimit'] } }
      ]
    })
    .select('code name description type discountType discountValue minOrder maxDiscount startDate endDate allowedMemberRanks')
    .lean();

    const list = all
      .filter(p => {
        // Lọc theo thời gian
        const start   = p.startDate ? new Date(p.startDate) : null;
        const end     = p.endDate   ? new Date(p.endDate)   : null;
        const startOk = !start || start <= now;
        const endOk   = !end   || end   >= now;
        if (!startOk || !endOk) return false;

        // Lọc theo hạng thành viên
        if (p.allowedMemberRanks && p.allowedMemberRanks.length > 0) {
          if (!userRank || !p.allowedMemberRanks.includes(userRank)) return false;
        }

        return true;
      })
      .map(({ startDate, endDate, allowedMemberRanks, ...rest }) => rest);

    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi lấy danh sách voucher' });
  }
});

// 3. Gom nhóm hàng loạt (phải trước :id)
router.put('/bulk-group', promoCtrl.bulkGroupPromotions);

// 4. Cập nhật lẻ: PUT /api/promotions/:id
router.put('/:id', promoCtrl.updatePromotion);

// 5. Xóa: DELETE /api/promotions/:id
router.delete('/:id', promoCtrl.deletePromotion);

module.exports = router;