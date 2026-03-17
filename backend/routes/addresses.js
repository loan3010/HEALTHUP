// backend/routes/addresses.js

const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const { authenticateToken } = require('../middleware/auth');

// Tất cả routes đều cần authentication
router.use(authenticateToken);

// GET /api/addresses - Lấy danh sách địa chỉ
router.get('/', addressController.getAddresses);

// POST /api/addresses - Thêm địa chỉ mới
router.post('/', addressController.createAddress);

// PUT /api/addresses/:id - Cập nhật địa chỉ
router.put('/:id', addressController.updateAddress);

// DELETE /api/addresses/:id - Xóa địa chỉ
router.delete('/:id', addressController.deleteAddress);

// PUT /api/addresses/:id/set-default - Đặt địa chỉ làm mặc định
router.put('/:id/set-default', addressController.setDefaultAddress);

module.exports = router;