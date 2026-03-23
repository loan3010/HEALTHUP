/**
 * Quản lý danh mục (admin) — /api/admin/categories
 * User site chỉ dùng GET /api/categories (chỉ isActive: true).
 */
const express = require('express');
const mongoose = require('mongoose');
const Category = require('../models/Categories');
const Product = require('../models/Product');

const router = express.Router();

/** Slug ASCII từ tên tiếng Việt (đơn giản, đủ dùng cho URL). */
function slugifyName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (d) => (d === 'đ' ? 'd' : 'D'))
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'danh-muc';
}

/** Đếm SP theo đúng chuỗi `Product.cat` (khớp tên danh mục). */
async function productCountsByCatName() {
  const rows = await Product.aggregate([
    { $group: { _id: '$cat', n: { $sum: 1 } } },
  ]);
  const map = new Map();
  for (const r of rows) {
    const k = String(r._id || '').trim();
    if (k) map.set(k, Number(r.n || 0));
  }
  return map;
}

/**
 * GET / — tất cả danh mục + productCount (đếm thực tế từ Product.cat).
 */
router.get('/', async (req, res) => {
  try {
    const list = await Category.find({}).sort({ order: 1, name: 1 }).lean();
    const counts = await productCountsByCatName();
    const data = list.map((c) => ({
      ...c,
      productCount: counts.get(String(c.name || '').trim()) || 0,
    }));
    res.json(data);
  } catch (err) {
    console.error('GET /api/admin/categories', err);
    res.status(500).json({ message: err.message || 'Lỗi server' });
  }
});

/**
 * POST / — thêm danh mục (name bắt buộc; slug tự sinh nếu thiếu).
 */
router.post('/', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (name.length < 2) {
      return res.status(400).json({ message: 'Tên danh mục tối thiểu 2 ký tự' });
    }
    let slug = String(req.body?.slug || '').trim().toLowerCase();
    if (!slug) slug = slugifyName(name);

    const existsSlug = await Category.findOne({ slug }).lean();
    if (existsSlug) {
      return res.status(409).json({ message: 'Slug đã tồn tại — đổi tên hoặc gửi slug khác' });
    }
    const existsName = await Category.findOne({ name }).lean();
    if (existsName) {
      return res.status(409).json({ message: 'Tên danh mục đã tồn tại' });
    }

    const order = Number(req.body?.order);
    const doc = await Category.create({
      name,
      slug,
      description: String(req.body?.description || '').trim(),
      order: Number.isFinite(order) ? order : 0,
      isActive: true,
      deactivatedAt: null,
    });
    res.status(201).json(doc.toObject());
  } catch (err) {
    console.error('POST /api/admin/categories', err);
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Trùng tên hoặc slug (unique index)' });
    }
    res.status(500).json({ message: err.message || 'Lỗi server' });
  }
});

/**
 * PATCH /:id/deactivate — vô hiệu hóa (user site không list).
 */
router.patch('/:id/deactivate', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }
    const doc = await Category.findByIdAndUpdate(
      id,
      { $set: { isActive: false, deactivatedAt: new Date() } },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ message: 'Không tìm thấy danh mục' });
    res.json(doc);
  } catch (err) {
    console.error('PATCH deactivate', err);
    res.status(500).json({ message: err.message || 'Lỗi server' });
  }
});

/**
 * PATCH /:id/restore — khôi phục hiển thị.
 */
router.patch('/:id/restore', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }
    const doc = await Category.findByIdAndUpdate(
      id,
      { $set: { isActive: true, deactivatedAt: null } },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ message: 'Không tìm thấy danh mục' });
    res.json(doc);
  } catch (err) {
    console.error('PATCH restore', err);
    res.status(500).json({ message: err.message || 'Lỗi server' });
  }
});

/**
 * DELETE /:id — xóa vĩnh viễn chỉ khi không có sản phẩm gắn `cat` = tên danh mục.
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }
    const cat = await Category.findById(id).lean();
    if (!cat) return res.status(404).json({ message: 'Không tìm thấy danh mục' });

    const name = String(cat.name || '').trim();
    const n = await Product.countDocuments({ cat: name });
    if (n > 0) {
      return res.status(409).json({
        message: `Không thể xóa: còn ${n} sản phẩm thuộc danh mục này. Hãy vô hiệu hóa hoặc chuyển SP sang danh mục khác.`,
        productCount: n,
      });
    }

    await Category.deleteOne({ _id: id });
    res.json({ message: 'Đã xóa danh mục', id });
  } catch (err) {
    console.error('DELETE /api/admin/categories/:id', err);
    res.status(500).json({ message: err.message || 'Lỗi server' });
  }
});

module.exports = router;
