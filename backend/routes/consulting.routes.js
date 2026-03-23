const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const router = express.Router();
const Consulting = require('../models/Consulting');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const { notifyAdminConsultingPending } = require('../services/adminNotificationService');
const { emitNotificationRefresh } = require('../services/userAccountRealtime');

function jwtSecret() {
  return process.env.JWT_SECRET || 'secret_key';
}

/**
 * Khách đăng nhập gửi câu hỏi — gắn userId để khi admin trả lời có thể push thông báo.
 * Chấp nhận mọi token có userId trừ admin (token đăng nhập shop thường có role=user).
 */
function getUserIdFromBearer(req) {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), jwtSecret());
    if (!decoded?.userId) return null;
    if (decoded.role === 'admin') return null;
    return String(decoded.userId);
  } catch (_) {
    /* token sai hoặc hết hạn — vẫn cho gửi câu hỏi như khách */
  }
  return null;
}

// --- DÀNH CHO KHÁCH HÀNG ---

// 1. Gửi câu hỏi mới
router.post('/', async (req, res) => {
  try {
    const { productId, content, user } = req.body;
    const authUserId = getUserIdFromBearer(req);
    const newQuestion = new Consulting({
      productId,
      content,
      user: user || 'Khách hàng',
      ...(authUserId && mongoose.Types.ObjectId.isValid(authUserId)
        ? { userId: new mongoose.Types.ObjectId(authUserId) }
        : {}),
    });
    await newQuestion.save();

    // Chuông thông báo admin: có câu hỏi tư vấn chờ phản hồi (socket + lưu DB).
    try {
      const prod = await Product.findById(productId).select('name').lean();
      const productName = prod?.name || 'Sản phẩm';
      await notifyAdminConsultingPending(newQuestion, productName);
    } catch (notifyErr) {
      console.error('notifyAdminConsultingPending:', notifyErr?.message || notifyErr);
    }

    res.status(201).json(newQuestion);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2. Lấy danh sách câu hỏi theo Sản phẩm (có phân trang)
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 5, filter = 'all' } = req.query;

    let query = { productId };
    if (filter === 'answered') query.status = 'answered';
    if (filter === 'pending') query.status = 'pending';

    const questions = await Consulting.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Consulting.countDocuments(query);
    const stats = {
      total: await Consulting.countDocuments({ productId }),
      pending: await Consulting.countDocuments({ productId, status: 'pending' }),
      answered: await Consulting.countDocuments({ productId, status: 'answered' })
    };

    res.json({ questions, total, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ 2.5. KHÁCH HÀNG: Đánh giá câu trả lời (Like/Dislike)
router.put('/:id/vote', async (req, res) => {
  try {
    const { type } = req.body; // 'up' (like) hoặc 'down' (dislike)
    const { id } = req.params;
    
    // Kiểm tra đầu vào hợp lệ
    if (!['up', 'down'].includes(type)) {
      return res.status(400).json({ message: "Loại đánh giá không hợp lệ." });
    }

    // Xác định trường cần tăng giá trị
    const updateQuery = type === 'up' 
      ? { $inc: { helpfulCount: 1 } } 
      : { $inc: { unhelpfulCount: 1 } };

    // Cập nhật và trả về bản ghi mới nhất ({ new: true })
    const updated = await Consulting.findByIdAndUpdate(id, updateQuery, { new: true });
    
    if (!updated) {
      return res.status(404).json({ message: "Không tìm thấy câu hỏi để đánh giá." });
    }
    
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- DÀNH CHO ADMIN ---

// 3. Lấy tổng hợp thống kê theo từng sản phẩm
router.get('/admin/summary', async (req, res) => {
  try {
    const summary = await Consulting.aggregate([
      {
        $group: {
          _id: '$productId',
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          answered: { $sum: { $cond: [{ $eq: ['$status', 'answered'] }, 1, 0] } }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: '$productInfo' },
      {
        $project: {
          _id: 1,
          total: 1, 
          pending: 1, 
          answered: 1,
          name: '$productInfo.name',
          sku: '$productInfo.sku',
          cat: '$productInfo.cat' 
        }
      }
    ]);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. ADMIN: Phản hồi câu hỏi
router.put('/:id/reply', async (req, res) => {
  try {
    const { answer, answeredBy } = req.body;
    const prev = await Consulting.findById(req.params.id).lean();
    if (!prev) return res.status(404).json({ error: 'Không tìm thấy câu hỏi' });

    const updated = await Consulting.findByIdAndUpdate(
      req.params.id,
      {
        answer,
        answeredBy: answeredBy || 'Quản trị viên',
        status: 'answered',
        answerAt: new Date(),
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy câu hỏi' });

    // Chỉ lần đầu trả lời (pending → answered): tránh spam nếu admin sửa nội dung sau.
    const isFirstReply = prev.status === 'pending';

    // Thông báo cho khách đã đăng nhập lúc gửi câu hỏi (có userId) + real-time badge chuông.
    if (isFirstReply && updated.userId) {
      try {
        const prod = await Product.findById(updated.productId).select('name').lean();
        const pname = prod?.name ? String(prod.name) : 'sản phẩm';
        const preview = String(answer || '').trim().slice(0, 120);
        const msg =
          preview.length > 0
            ? `Cửa hàng đã trả lời câu hỏi của bạn về “${pname}”: ${preview}${String(answer || '').trim().length > 120 ? '…' : ''}`
            : `Cửa hàng đã trả lời câu hỏi của bạn về “${pname}”.`;
        const targetUserId = String(updated.userId);
        await Notification.create({
          userId: new mongoose.Types.ObjectId(targetUserId),
          type: 'consulting',
          title: 'Phản hồi tư vấn',
          message: msg,
          link: `/product-detail-page/${updated.productId}`,
          icon: '💬',
          productId: updated.productId,
        });
        emitNotificationRefresh(targetUserId);
      } catch (notiErr) {
        console.error('consulting reply notification:', notiErr?.message || notiErr);
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. ADMIN: Xóa vĩnh viễn
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Consulting.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Không tìm thấy dữ liệu." });
    res.json({ message: "Đã xóa vĩnh viễn.", id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;