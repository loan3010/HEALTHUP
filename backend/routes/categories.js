const express = require('express');
const router = express.Router();
const Category = require('../models/Categories');

/**
 * GET /api/categories — chỉ danh mục đang hoạt động (user site + dropdown SP admin).
 * Quản trị đầy đủ: /api/admin/categories
 */
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi lấy danh mục: ' + err.message });
  }
});

module.exports = router;