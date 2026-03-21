const express   = require('express');
const router    = express.Router();
const mongoose  = require('mongoose');
const promoCtrl = require('../controllers/Promotion.controller');
const Promotion = require('../models/Promotion');

// 1. Lấy danh sách: GET /api/promotions
router.get('/', promoCtrl.getAllPromotions);

// 2. Tạo mới: POST /api/promotions
router.post('/', promoCtrl.createPromotion);

// ── Apply voucher ────────────────────────────────────────────────
// POST /api/promotions/apply
// Body: { code, subTotal, shippingFee }
// Response: { valid, type, discountType, discountValue, discountOnType, discountAmount, message }
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

    // ── Tính tiền giảm dựa trên promo.type (chuẩn phân loại) ──
    let discountAmount = 0;
    // 'shipping' = giảm phí vận chuyển | 'order' = giảm tiền hàng
    const discountOnType = (promo.type === 'shipping') ? 'shipping' : 'items';

    if (promo.type === 'shipping') {
      // Mã giảm phí vận chuyển
      if (promo.discountType === 'percent') {
        discountAmount = Math.round(Number(shippingFee) * promo.discountValue / 100);
        if (promo.maxDiscount > 0 && discountAmount > promo.maxDiscount) {
          discountAmount = promo.maxDiscount;
        }
      } else if (promo.discountType === 'fixed') {
        // Không giảm nhiều hơn phí ship thực tế
        discountAmount = Math.min(promo.discountValue, Number(shippingFee));
      } else {
        // discountType === 'freeship' → giảm toàn bộ phí ship
        discountAmount = Number(shippingFee);
      }
    } else {
      // Mã giảm tiền hàng (promo.type === 'order')
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
      type:           promo.type,           // 'order' | 'shipping'
      discountType:   promo.discountType,   // 'percent' | 'fixed' | 'freeship'
      discountValue:  promo.discountValue,
      discountOnType,                       // 'items' | 'shipping'
      discountAmount,
      message:        '✓ Áp dụng thành công!',
    });

  } catch (err) {
    console.error('Apply voucher error:', err);
    res.status(500).json({ valid: false, message: 'Lỗi server khi kiểm tra voucher' });
  }
});

// ── Lấy danh sách voucher đang hoạt động (cho user xem) ─────────
// GET /api/promotions/available
router.get('/available', async (req, res) => {
  try {
    const now = new Date();

    const all = await Promotion.find({
      status: 'ongoing',
      $or: [
        { totalLimit: 0 },
        { $expr: { $lt: ['$usedCount', '$totalLimit'] } }
      ]
    })
    // Thêm 'type' vào select để frontend phân loại đúng
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

// 3. Gom nhóm hàng loạt (phải trước :id)
router.put('/bulk-group', promoCtrl.bulkGroupPromotions);

// 4. Cập nhật lẻ: PUT /api/promotions/:id
router.put('/:id', promoCtrl.updatePromotion);

// 5. Xóa: DELETE /api/promotions/:id
router.delete('/:id', promoCtrl.deletePromotion);

module.exports = router;