const express = require('express');
const router = express.Router();
// Gọi cái Controller bà vừa đặt tên xong nè
const promoCtrl = require('../controllers/Promotion.controller');

// 1. Lấy danh sách: GET /api/promotions
router.get('/', promoCtrl.getAllPromotions);

// 2. Tạo mới: POST /api/promotions
router.post('/', promoCtrl.createPromotion);

// --- 3. QUAN TRỌNG: Gom nhóm hàng loạt (Phải đặt TRƯỚC các route :id) ---
router.put('/bulk-group', promoCtrl.bulkGroupPromotions);

// 4. Cập nhật lẻ: PUT /api/promotions/:id
router.put('/:id', promoCtrl.updatePromotion);

// 5. Xóa: DELETE /api/promotions/:id
router.delete('/:id', promoCtrl.deletePromotion);

module.exports = router;