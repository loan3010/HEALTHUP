const express = require('express');
const router = express.Router();
const Category = require('../models/Categories'); // Đảm bảo đường dẫn này đúng tới file model

// API lấy danh sách danh mục
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ order: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: "Lỗi lấy danh mục: " + err.message });
  }
});

module.exports = router;