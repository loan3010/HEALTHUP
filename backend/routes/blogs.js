const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const Blog    = require('../models/Blog');

// ======================================================
// ============ CẤU HÌNH LƯU TRỮ ẢNH (MULTER) ===========
// ======================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'public/images/blogs/';
    // Tự động tạo thư mục nếu chưa có
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Lưu tên file: timestamp-tên-gốc.jpg
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // Giới hạn 10MB cho ảnh
});

// ======================================================
// ===================== CÁC ĐƯỜNG DẪN ==================
// ======================================================

// 1. LẤY TẤT CẢ BÀI VIẾT (Cập nhật hỗ trợ Sắp xếp & Nổi bật)
router.get('/', async (req, res) => {
  try {
    // Nhận thêm tham số sortBy từ Query
    const { limit = 0, tag, isAdmin = 'false', sortBy = 'newest' } = req.query;
    let query = {};

    // Logic Ẩn/Hiện: Nếu không phải Admin, chỉ lấy các bài không bị ẩn
    if (isAdmin !== 'true') {
      query.isHidden = { $ne: true };
    }

    // Lọc theo tag nếu có
    if (tag && tag !== 'Tất cả') query.tag = tag;

    // Định nghĩa logic sắp xếp linh hoạt
    let sortOptions = { createdAt: -1 }; // Mặc định là mới đăng nhất
    if (sortBy === 'most-viewed') {
      sortOptions = { views: -1 }; // Sắp xếp theo lượt xem giảm dần (Nổi bật nhất)
    } else if (sortBy === 'oldest') {
      sortOptions = { createdAt: 1 };
    }

    const blogs = await Blog.find(query)
      .sort(sortOptions) 
      .limit(Number(limit))
      .lean();

    res.json(blogs);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi hệ thống khi lấy danh sách bài viết' });
  }
});

// 2. LẤY CHI TIẾT MỘT BÀI VIẾT (Tự động tăng 1 lượt xem mỗi lần nhấn vào)
router.get('/:id', async (req, res) => {
  try {
    const blog = await Blog.findByIdAndUpdate(
      req.params.id, 
      { $inc: { views: 1 } }, // Tăng trường views thêm 1
      { new: true }           // Trả về dữ liệu mới nhất sau khi tăng
    ).lean();

    if (!blog) return res.status(404).json({ error: 'Không tìm thấy bài viết này' });
    res.json(blog);
  } catch (err) {
    res.status(500).json({ error: 'Mã bài viết không hợp lệ' });
  }
});

// 3. ĐĂNG BÀI VIẾT MỚI (Có xử lý tải ảnh bìa và trạng thái ẩn hiện)
router.post('/', upload.single('coverImage'), async (req, res) => {
  try {
    const { title, tag, excerpt, content, author, date, isHidden } = req.body;
    
    const coverImage = req.file ? `images/blogs/${req.file.filename}` : '';

    const newBlog = new Blog({
      title,
      tag,
      excerpt,
      content,
      author: author || 'Mỹ Đức(admin)',
      coverImage,
      isHidden: isHidden === 'true' || isHidden === true,
      date: date || new Date().toLocaleDateString('vi-VN')
    });

    const savedBlog = await newBlog.save();
    res.status(201).json(savedBlog);
  } catch (err) {
    console.error('LỖI ĐĂNG BÀI:', err);
    res.status(500).json({ error: 'Không thể đăng bài viết lúc này' });
  }
});

// 4. CHỈNH SỬA BÀI VIẾT
router.put('/:id', upload.single('coverImage'), async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    if (updateData.isHidden !== undefined) {
      updateData.isHidden = updateData.isHidden === 'true' || updateData.isHidden === true;
    }

    if (req.body.date) {
      updateData.date = req.body.date;
    }

    if (req.file) {
      updateData.coverImage = `images/blogs/${req.file.filename}`;
      
      const oldBlog = await Blog.findById(req.params.id);
      if (oldBlog && oldBlog.coverImage) {
        const oldPath = path.join(__dirname, '../public/', oldBlog.coverImage);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (e) {
            console.error('Không thể xóa ảnh cũ:', e);
          }
        }
      }
    }

    const updatedBlog = await Blog.findByIdAndUpdate(
      req.params.id, 
      { $set: updateData }, 
      { new: true }
    );

    if (!updatedBlog) return res.status(404).json({ error: 'Không tìm thấy bài viết để cập nhật' });
    res.json(updatedBlog);
  } catch (err) {
    console.error('LỖI CẬP NHẬT:', err);
    res.status(500).json({ error: 'Cập nhật thất bại' });
  }
});

// 5. XÓA BÀI VIẾT
router.delete('/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: 'Bài viết không tồn tại' });

    if (blog.coverImage) {
      const imagePath = path.join(__dirname, '../public/', blog.coverImage);
      if (fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
        } catch (e) {
          console.error('Lỗi khi xóa file ảnh:', e);
        }
      }
    }

    await Blog.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa bài viết thành công' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi xóa bài viết' });
  }
});

// 6. CỔNG NHẬN ẢNH CHÈN GIỮA NỘI DUNG BÀI VIẾT (INLINE IMAGE)
router.post('/upload-inline', upload.single('inlineImage'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Không nhận được ảnh' });
    }
    const imageUrl = `http://localhost:3000/images/blogs/${req.file.filename}`;
    res.json({ url: imageUrl });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server khi tải ảnh nội dung' });
  }
});

module.exports = router;