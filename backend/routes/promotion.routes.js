const express = require('express');
const router  = express.Router();
const mongoose = require('mongoose');
const promoCtrl = require('../controllers/Promotion.controller');
const Promotion = require('../models/Promotion');

// 1. Lấy danh sách: GET /api/promotions
router.get('/', promoCtrl.getAllPromotions);

// 2. Tạo mới: POST /api/promotions
router.post('/', promoCtrl.createPromotion);

// ── MỚI: Apply voucher ──────────────────────────────────────────
// POST /api/promotions/apply
// Body: { code, subTotal, shippingFee }
// Response: { valid, discountType, discountValue, discountAmount, message }
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
    const now = new Date();
    if (now < promo.startDate) {
      return res.status(400).json({ valid: false, message: 'Voucher chưa đến thời gian sử dụng' });
    }
    if (now > promo.endDate) {
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

    // Tính tiền giảm theo discountType
    let discountAmount = 0;
    let discountOnType = 'items'; // 'items' | 'shipping'

    if (promo.discountType === 'freeship') {
      discountAmount = Number(shippingFee);
      discountOnType = 'shipping';
    } else if (promo.discountType === 'percent') {
      discountAmount = Math.round(Number(subTotal) * promo.discountValue / 100);
      // Giới hạn maxDiscount nếu có
      if (promo.maxDiscount > 0 && discountAmount > promo.maxDiscount) {
        discountAmount = promo.maxDiscount;
      }
      discountOnType = 'items';
    } else if (promo.discountType === 'fixed') {
      discountAmount = promo.discountValue;
      discountOnType = 'items';
    }

    return res.json({
      valid:          true,
      code:           promo.code,
      name:           promo.name,
      description:    promo.description || '',
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

// ── MỚI: Lấy danh sách voucher đang hoạt động (cho user xem) ───
// GET /api/promotions/available
router.get('/available', async (req, res) => {
  try {
    const now = new Date();
    const list = await Promotion.find({
      status: 'ongoing',
      startDate: { $lte: now },
      endDate:   { $gte: now },
      $or: [
        { totalLimit: 0 },
        { $expr: { $lt: ['$usedCount', '$totalLimit'] } }
      ]
    }).select('code name description discountType discountValue minOrder maxDiscount').lean();

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