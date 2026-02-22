const express = require('express');
const router  = express.Router();
const Blog    = require('../models/Blog');

// GET tất cả blog (có thể giới hạn limit và lọc theo tag)
router.get('/', async (req, res) => {
  try {
    const { limit = 0, tag } = req.query;
    let query = {};
    if (tag) query.tag = tag;

    const blogs = await Blog.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.json(blogs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET blog theo id
router.get('/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).lean();
    if (!blog) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    res.json(blog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;