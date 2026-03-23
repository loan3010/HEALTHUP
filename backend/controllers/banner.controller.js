const Banner = require('../models/Banner');
const fs = require('fs');
const path = require('path');

// 1. Lấy TẤT CẢ danh sách (Dành cho trang Admin quản lý)
exports.getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ order: 1, createdAt: -1 });
    res.json(banners);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách banner', error: err.message });
  }
};

// 2. Lấy danh sách ĐANG HIỆN (Dành cho trang chủ Client)
exports.getActiveBanners = async (req, res) => {
  try {
    const activeBanners = await Banner.find({ isActive: true }).sort({ order: 1 });
    res.json(activeBanners);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi tải banner trang chủ', error: err.message });
  }
};

// 3. Thêm Banner mới (Admin upload ảnh)
exports.createBanner = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng tải lên một hình ảnh' });
    }

    const newBanner = new Banner({
      title: req.body.title,
      linkUrl: req.body.linkUrl,
      // Lưu đường dẫn ảnh từ Multer (bỏ phần 'public' nếu có trong đường dẫn tĩnh)
      imageUrl: `/images/banners/${req.file.filename}`,
      order: req.body.order || 0
    });

    await newBanner.save();
    res.status(201).json(newBanner);
  } catch (err) {
    res.status(400).json({ message: 'Không thể thêm banner', error: err.message });
  }
};

// 4. Cập nhật Banner (Admin đổi tiêu đề, thứ tự hoặc Ẩn/Hiện)
exports.updateBanner = async (req, res) => {
  try {
    const updatedBanner = await Banner.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true } // Trả về dữ liệu sau khi đã cập nhật
    );

    if (!updatedBanner) {
      return res.status(404).json({ message: 'Không tìm thấy banner này' });
    }

    res.json(updatedBanner);
  } catch (err) {
    res.status(400).json({ message: 'Lỗi cập nhật banner', error: err.message });
  }
};

// 5. Xóa Banner (Xóa luôn file ảnh trên đĩa cứng cho sạch)
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ message: 'Banner không tồn tại' });
    }

    // Xóa file ảnh vật lý trong folder public
    const imagePath = path.join(__dirname, '..', 'public', banner.imageUrl);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    await Banner.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa banner vĩnh viễn thành công!' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi xóa banner', error: err.message });
  }
};