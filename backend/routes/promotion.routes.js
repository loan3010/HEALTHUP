const express   = require('express');
const router    = express.Router();
const mongoose  = require('mongoose');
const promoCtrl = require('../controllers/Promotion.controller');
const Promotion = require('../models/Promotion');

// 1. Lấy danh sách: GET /api/promotions (Dành cho Admin xem tất cả)
router.get('/', promoCtrl.getAllPromotions);

// 2. Tạo mới: POST /api/promotions
router.post('/', promoCtrl.createPromotion);

// ── Apply voucher ────────────────────────────────────────────────
// POST /api/promotions/apply
router.post('/apply', async (req, res) => {
  try {
    const { code, subTotal = 0, shippingFee = 0 } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ valid: false, message: 'Vui lòng nhập mã voucher' });
    }

    const promo = await Promotion.findOne({ code: code.trim().toUpperCase() });

    if (!promo) {
      return res.status(404).json({ valid: false, message: 'Mã voucher không tồn tại' });
    }

    // --- KIỂM TRA QUYỀN HIỂN THỊ (Mới thêm) ---
    if (promo.isActive === false) {
      return res.status(400).json({ valid: false, message: 'Voucher này hiện đang tạm ngưng sử dụng' });
    }

    // Kiểm tra trạng thái expired
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
      valid:          true,
      code:           promo.code,
      name:           promo.name,
      description:    promo.description || '',
      type:           promo.type,
      discountType:   promo.discountType,
      discountValue:  promo.discountValue,
      discountOnType,
      discountAmount,
      message:        '✓ Áp dụng thành công!',
    });

  } catch (err) {
    console.error('Apply voucher error:', err);
    res.status(500).json({ valid: false, message: 'Lỗi server khi kiểm tra voucher' });
  }
});

// ── Lấy danh sách voucher cho User xem (Chỉ lấy mã isActive = true) ──
// GET /api/promotions/available
router.get('/available', async (req, res) => {
  try {
    const now = new Date();

    const all = await Promotion.find({
      isActive: true, // <--- QUAN TRỌNG: Chỉ lấy voucher đang công khai
      status: 'ongoing',
      $or: [
        { totalLimit: 0 },
        { $expr: { $lt: ['$usedCount', '$totalLimit'] } }
      ]
    })
    .select('code name description type discountType discountValue minOrder maxDiscount startDate endDate')
    .lean();

    const list = all.filter(p => {
      const start   = p.startDate ? new Date(p.startDate) : null;
      const end     = p.endDate   ? new Date(p.endDate)   : null;
      const startOk = !start || start <= now;
      const endOk   = !end   || end   >= now;
      return startOk && endOk;
    }).map(({ startDate, endDate, ...rest }) => rest);

    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi lấy danh sách voucher' });
  }
});

// 3. Gom nhóm hàng loạt (Phải để trước :id để tránh bị nhầm là param)
router.put('/bulk-group', promoCtrl.bulkGroupPromotions);

// 4. Cập nhật lẻ: PUT /api/promotions/:id
router.put('/:id', promoCtrl.updatePromotion);

// 5. Xóa: DELETE /api/promotions/:id
router.delete('/:id', promoCtrl.deletePromotion);

module.exports = router;