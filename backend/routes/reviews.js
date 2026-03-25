const express   = require('express');
const router    = express.Router();
const mongoose  = require('mongoose');
const path      = require('path');
const multer    = require('multer');
const Review    = require('../models/Review');
const Product   = require('../models/Product');
const Order     = require('../models/Order');
const { notifyAdminReviewNew } = require('../services/adminNotificationService');


// ── Multer: lưu ảnh review vào public/images/reviews ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/images/reviews'));
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file ảnh'));
  }
});


// ── Helper: cập nhật rating + reviewCount trên Product ──
async function syncProductStats(productId) {
  try {
    const pid = new mongoose.Types.ObjectId(String(productId));
    const all = await Review.find({ productId: pid }).lean();
    const avg = all.length
      ? Number((all.reduce((s, r) => s + r.rating, 0) / all.length).toFixed(1))
      : 0;
    await Product.findByIdAndUpdate(productId, {
      rating:      avg,
      reviewCount: all.length,
    });
  } catch (e) { console.error('syncProductStats error:', e.message); }
}


// ─────────────────────────────────────────────────────────────────
// POST /api/reviews/upload-images — upload tối đa 5 ảnh
// ─────────────────────────────────────────────────────────────────
router.post('/upload-images', upload.array('images', 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Không có file nào được upload' });
    }
    const urls = req.files.map(f => '/images/reviews/' + f.filename);
    res.json({ urls });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────
// GET /api/reviews/product/:productId
// ─────────────────────────────────────────────────────────────────
router.get('/product/:productId', async (req, res) => {
  try {
    const { filter, sort = 'newest', page = 1, limit = 10 } = req.query;
    const productObjectId = new mongoose.Types.ObjectId(req.params.productId);

    let query = { productId: productObjectId };

    if (filter && filter !== 'all') {
      if (filter === 'photo') {
        query.imgs = { $exists: true, $ne: [] };
      } else {
        const ratingNum = Number(filter);
        if (!isNaN(ratingNum)) query.rating = ratingNum;
      }
    }

    let sortObj = {};
    switch (sort) {
      case 'highest': sortObj = { rating: -1 };  break;
      case 'lowest':  sortObj = { rating: 1 };   break;
      case 'helpful': sortObj = { helpful: -1 }; break;
      default:        sortObj = { createdAt: -1 };
    }

    const total = await Review.countDocuments({ productId: productObjectId });

    const reviews = await Review.find(query)
      .sort(sortObj)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const allReviews = await Review.find({ productId: productObjectId }).lean();

    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let totalRating = 0;
    allReviews.forEach(r => {
      if (counts[r.rating] !== undefined) counts[r.rating]++;
      totalRating += r.rating;
    });
    const average = allReviews.length
      ? Number((totalRating / allReviews.length).toFixed(1))
      : 0;

    const photoCount = allReviews.filter(r => r.imgs && r.imgs.length > 0).length;

    const tagMap = {};
    allReviews.forEach(r => {
      (r.tags || []).forEach(tag => {
        tagMap[tag] = (tagMap[tag] || 0) + 1;
      });
    });
    const praiseTags = Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

    const product = await Product.findById(req.params.productId)
      .select('name sold weights packagingTypes')
      .lean();

    res.json({
      reviews,
      total,
      page:       Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      stats:      { total, average, counts, praiseTags, photoCount },
      product: product ? {
        name:           product.name,
        sold:           product.sold,
        weights:        product.weights?.map(w => w.label) || [],
        packagingTypes: product.packagingTypes || [],
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────
// POST /api/reviews — tạo đánh giá mới
// ✅ Chỉ cho phép nếu userId có đơn hàng delivered chứa productId
// ─────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { userId, productId } = req.body;

    // ── Validate bắt buộc ──
    if (!productId) {
      return res.status(400).json({ error: 'Thiếu productId' });
    }

    // ── Kiểm tra userId hợp lệ ──
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(403).json({
        error: 'Bạn cần đăng nhập để đánh giá sản phẩm'
      });
    }

    // ── Kiểm tra có đơn delivered chứa sản phẩm này không ──
    const deliveredOrder = await Order.findOne({
      userId:  new mongoose.Types.ObjectId(String(userId)),
      status:  'delivered',
      'items.productId': new mongoose.Types.ObjectId(String(productId)),
    }).lean();

    if (!deliveredOrder) {
      return res.status(403).json({
        error: 'Bạn chỉ có thể đánh giá sản phẩm đã mua và đã giao thành công'
      });
    }

    // ✅ FIX: Set verified = true vì đã xác nhận có đơn delivered
    const review = new Review({ ...req.body, verified: true });
    await review.save();
    await syncProductStats(productId);

    // Thông báo admin (Socket.io + collection AdminNotification).
    try {
      const p = await Product.findById(productId).select('name').lean();
      await notifyAdminReviewNew(review, p?.name || '');
    } catch (e) {
      console.error('Admin notify review_new:', e);
    }

    res.status(201).json(review);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────
// PUT /api/reviews/:id — sửa đánh giá
// ─────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { rating, text, tags, variant, imgs } = req.body;

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { rating, text, tags, variant, imgs },
      { new: true, runValidators: true }
    ).lean();

    if (!review) return res.status(404).json({ error: 'Review not found' });

    await syncProductStats(review.productId);
    res.json(review);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────
// DELETE /api/reviews/:id — xóa đánh giá
// ─────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id).lean();
    if (!review) return res.status(404).json({ error: 'Review not found' });

    await syncProductStats(review.productId);
    res.json({ message: 'Đã xóa đánh giá', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────
// PATCH /api/reviews/:id/helpful — đánh dấu hữu ích
// ─────────────────────────────────────────────────────────────────
router.patch('/:id/helpful', async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $inc: { helpful: 1 } },
      { new: true }
    ).lean();
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json(review);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// ================================================================
// === ADMIN REVIEW MANAGEMENT APIs ===
// ================================================================

// ─────────────────────────────────────────────────────────────────
// PUT /api/reviews/:id/admin-reply — Admin trả lời đánh giá
// ─────────────────────────────────────────────────────────────────
router.put('/:id/admin-reply', async (req, res) => {
  try {
    const { replyText } = req.body;
    const reviewId = req.params.id;

    if (!replyText || replyText.trim() === '') {
      return res.status(400).json({ error: 'Nội dung phản hồi không được để trống' });
    }

    const review = await Review.findByIdAndUpdate(
      reviewId,
      {
        adminReply: replyText.trim(),
        adminReplyDate: new Date().toLocaleDateString('vi-VN')
      },
      { new: true, runValidators: true }
    ).lean();

    if (!review) {
      return res.status(404).json({ error: 'Không tìm thấy đánh giá' });
    }

    await syncProductStats(review.productId);

    res.json({ 
      success: true, 
      message: 'Đã phản hồi đánh giá thành công',
      review 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────
// GET /api/reviews/admin/all — Lấy tất cả đánh giá cho admin
// ─────────────────────────────────────────────────────────────────
router.get('/admin/all', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', hasReply = 'all' } = req.query;

    let query = {};

    // Xử lý tìm kiếm
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { text: { $regex: search, $options: 'i' } }
      ];
    }

    // Xử lý lọc theo trạng thái phản hồi
    if (hasReply === 'replied') {
      // Đã phản hồi: adminReply có nội dung (không null và không rỗng)
      query.adminReply = { $nin: [null, ''] };
    } else if (hasReply === 'unreplied') {
      // Chưa phản hồi: adminReply là null hoặc rỗng (bao gồm cả chuỗi rỗng)
      if (search && search.trim()) {
        query = {
          $and: [
            { adminReply: { $in: [null, ''] } },
            { $or: [
              { name: { $regex: search, $options: 'i' } },
              { text: { $regex: search, $options: 'i' } }
            ]}
          ]
        };
      } else {
        query.adminReply = { $in: [null, ''] };
      }
    }

    const total = await Review.countDocuments(query);

    const reviews = await Review.find(query)
      .populate('productId', 'name images')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    res.json({
      reviews,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────
// DELETE /api/reviews/:id/admin-delete — Admin xóa đánh giá
// ─────────────────────────────────────────────────────────────────
router.delete('/:id/admin-delete', async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id).lean();
    if (!review) {
      return res.status(404).json({ error: 'Không tìm thấy đánh giá' });
    }

    await syncProductStats(review.productId);
    res.json({ message: 'Đã xóa đánh giá thành công', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────
// DELETE /api/reviews/:id/admin-reply — Admin xóa phản hồi
// ─────────────────────────────────────────────────────────────────
router.delete('/:id/admin-reply', async (req, res) => {
  try {
    const reviewId = req.params.id;

    const review = await Review.findByIdAndUpdate(
      reviewId,
      {
        adminReply: null,
        adminReplyDate: null
      },
      { new: true, runValidators: true }
    ).lean();

    if (!review) {
      return res.status(404).json({ error: 'Không tìm thấy đánh giá' });
    }

    res.json({
      success: true,
      message: 'Đã xóa phản hồi thành công',
      review
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;