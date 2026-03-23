const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const bannerCtrl = require('../controllers/banner.controller');

// --- CẤU HÌNH LƯU TRỮ HÌNH ẢNH (MULTER) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Đảm bảo bà đã tạo folder: public/images/banners
    cb(null, 'public/images/banners'); 
  },
  filename: (req, file, cb) => {
    // Đặt tên file: Thời-gian-hiện-tại + tên-gốc-của-file
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Kiểm tra định dạng file (Chỉ cho phép ảnh)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ cho phép tải lên tệp hình ảnh!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// --- DANH SÁCH ĐƯỜNG DẪN (ROUTES) ---

// 1. Lấy tất cả banner (Dành cho Admin quản lý)
// GET: http://localhost:3000/api/banners
router.get('/', bannerCtrl.getAllBanners);

// 2. Lấy danh sách banner đang hoạt động (Dành cho Client/Trang chủ)
// GET: http://localhost:3000/api/banners/active
router.get('/active', bannerCtrl.getActiveBanners);

// 3. Thêm banner mới (Admin upload ảnh)
// POST: http://localhost:3000/api/banners
// Chú ý: Key gửi từ Frontend phải là 'image'
router.post('/', upload.single('image'), bannerCtrl.createBanner);

// 4. Cập nhật thông tin banner (Ẩn/Hiện, Tiêu đề, Link...)
// PUT: http://localhost:3000/api/banners/:id
router.put('/:id', bannerCtrl.updateBanner);

// 5. Xóa banner vĩnh viễn
// DELETE: http://localhost:3000/api/banners/:id
router.delete('/:id', bannerCtrl.deleteBanner);

module.exports = router;