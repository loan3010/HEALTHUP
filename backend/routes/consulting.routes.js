const express = require('express');
const router = express.Router();
const Consulting = require('../models/Consulting');
const Product = require('../models/Product');

// --- DÀNH CHO KHÁCH HÀNG ---

// 1. Gửi câu hỏi mới
router.post('/', async (req, res) => {
  try {
    const { productId, content, user } = req.body;
    const newQuestion = new Consulting({
      productId,
      content,
      user: user || 'Khách hàng'
    });
    await newQuestion.save();
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
    const updated = await Consulting.findByIdAndUpdate(
      req.params.id,
      { 
        answer, 
        answeredBy: answeredBy || 'Quản trị viên',
        status: 'answered',
        answerAt: new Date()
      },
      { new: true }
    );
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