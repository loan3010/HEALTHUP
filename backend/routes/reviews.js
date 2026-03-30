const express   = require('express');
const router    = express.Router();
const mongoose  = require('mongoose');
const path      = require('path');
const multer    = require('multer');
const Review = require('../models/Review');
const Product   = require('../models/Product');
const Order     = require('../models/Order');
const Notification = require('../models/Notification');
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
    const pidStr = String(productId || '').trim();
    const all = await Review.find({ productId: pidStr }).lean();
    const avg = all.length
      ? Number((all.reduce((s, r) => s + r.rating, 0) / all.length).toFixed(1))
      : 0;
    await Product.findByIdAndUpdate(pidStr, {
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
    const rawPid = String(req.params.productId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(rawPid)) {
      return res.status(400).json({ error: 'productId không hợp lệ' });
    }
    /** Schema Review lưu productId kiểu String — khớp DB, tránh query ObjectId vs string. */
    const productIdStr = rawPid;
    let query = { productId: productIdStr };


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


    const total = await Review.countDocuments({ productId: productIdStr });


    const reviews = await Review.find(query)
      .sort(sortObj)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();


    const allReviews = await Review.find({ productId: productIdStr }).lean();


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


    const product = await Product.findById(productIdStr)
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


    if (!productId) {
      return res.status(400).json({ error: 'Thiếu productId' });
    }


    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(403).json({
        error: 'Bạn cần đăng nhập để đánh giá sản phẩm'
      });
    }


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


    const review = new Review({ ...req.body, verified: true });
    await review.save();
    await syncProductStats(productId);


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
// ✅ FIX: Gửi notification cho khách sau khi admin phản hồi
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


    // ✅ FIX: Gửi notification cho khách khi admin phản hồi đánh giá
    if (review.userId && mongoose.Types.ObjectId.isValid(String(review.userId))) {
      try {
        const product = await Product.findById(review.productId).select('name').lean();
        const productName = product?.name || 'sản phẩm';
        await Notification.create({
          userId:  review.userId,
          title:   'Shop đã phản hồi đánh giá của bạn 💬',
          message: `Đánh giá của bạn về "${productName}" vừa được shop phản hồi. Nhấn để xem chi tiết.`,
          type:    'order',
          isRead:  false,
        });
      } catch (e) {
        console.error('Tạo notification review reply thất bại:', e);
      }
    }


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
    const {
      page = 1,
      limit = 20,
      search = '',
      hasReply: hasReplyRaw = 'all',
      reviewId = '',
      productId: productIdFilter = '',
    } = req.query;

    const hasReply = Array.isArray(hasReplyRaw)
      ? String(hasReplyRaw[0] || 'all')
      : String(hasReplyRaw || 'all');

    const applyProductId = (q) => {
      const pid = String(productIdFilter || '').trim();
      if (!pid) return q;
      if (!q || Object.keys(q).length === 0) return { productId: pid };
      return { $and: [{ productId: pid }, q] };
    };

    /** Độ dài adminReply — tránh $in/$nin chứa null trên path String (Mongoose 8 CastError). */
    const replyLen = { $strLenCP: { $ifNull: ['$adminReply', ''] } };
    const repliedExpr = { $gt: [replyLen, 0] };
    const unrepliedExpr = { $lte: [replyLen, 0] };

    let query = {};
    const focusReview =
      reviewId && mongoose.Types.ObjectId.isValid(String(reviewId));

    if (focusReview) {
      query._id = new mongoose.Types.ObjectId(String(reviewId));
    } else {
      const searchTrim = String(search || '').trim();
      const hasSearch = !!searchTrim;

      const clauses = [];
      if (hasReply === 'replied') {
        clauses.push({ $expr: repliedExpr });
      } else if (hasReply === 'unreplied') {
        clauses.push({ $expr: unrepliedExpr });
      }
      if (hasSearch) {
        clauses.push({
          $or: [
            { name: { $regex: searchTrim, $options: 'i' } },
            { text: { $regex: searchTrim, $options: 'i' } },
          ],
        });
      }

      if (clauses.length === 1) query = clauses[0];
      else if (clauses.length > 1) query = { $and: clauses };
      else query = {};

      query = applyProductId(query);
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