
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// ─────────────────────────────────────────────────────────────────
// QUAN TRỌNG: Các route cụ thể PHẢI đứng TRƯỚC /:id
// ─────────────────────────────────────────────────────────────────

// GET featured/bestsellers
router.get('/featured', async (req, res) => {
  try {
    const products = await Product.find({}).sort({ sold: -1 }).limit(4).lean();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET category counts
router.get('/category-counts', async (req, res) => {
  try {
    const result = await Product.aggregate([
      { $group: { _id: '$cat', count: { $sum: 1 } } }
    ]);
    const counts = {};
    result.forEach(item => {
      if (item._id) counts[item._id] = item.count;
    });
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// Helper: normalize tiếng Việt → bỏ dấu, lowercase
// ─────────────────────────────────────────────────────────────────
function normalizeVN(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

// ─────────────────────────────────────────────────────────────────
// GET /api/products  –  browse + search
// ─────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const {
      cat, minPrice, maxPrice, sort, badge, minRating,
      page = 1, limit = 9,
      search
    } = req.query;

    // ── SEARCH MODE: chỉ tìm theo tên sản phẩm ──
    if (search && search.trim() !== '') {
      const kwNorm   = normalizeVN(search.trim());
      const limitNum = Math.min(Number(limit) || 6, 20);

      if (!kwNorm) {
        return res.json({ products: [], total: 0, page: 1, totalPages: 0 });
      }

      const allProducts = await Product.find({}).lean();

      const matched = allProducts.filter(p =>
        normalizeVN(p.name).includes(kwNorm)   // ✅ chỉ match theo tên
      );

      // Sắp xếp: tên bắt đầu bằng keyword lên đầu
      matched.sort((a, b) => {
        const aN = normalizeVN(a.name);
        const bN = normalizeVN(b.name);
        const aScore = aN.startsWith(kwNorm) ? 0 : aN.includes(' ' + kwNorm) ? 1 : 2;
        const bScore = bN.startsWith(kwNorm) ? 0 : bN.includes(' ' + kwNorm) ? 1 : 2;
        return aScore - bScore;
      });

      return res.json({
        products:   matched.slice(0, limitNum),
        total:      matched.length,
        page:       1,
        totalPages: Math.ceil(matched.length / limitNum),
      });
    }

    // ── BROWSE / FILTER MODE ──
    let query = {};

    if (cat) {
      query.cat = { $in: cat.split(',').map(c => c.trim()) };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) query.price.$gte = Number(minPrice);
      if (maxPrice !== undefined) query.price.$lte = Number(maxPrice);
    }

    if (badge) query.badge = badge;

    if (minRating !== undefined) {
      query.rating = { $gte: Number(minRating) };
    }

    let sortObj = {};
    switch (sort) {
      case 'price-asc':  sortObj = { price: 1 };      break;
      case 'price-desc': sortObj = { price: -1 };     break;
      case 'newest':     sortObj = { createdAt: -1 }; break;
      case 'rating':     sortObj = { rating: -1 };    break;
      default:           sortObj = { sold: -1 };
    }

    const pageNum  = Number(page);
    const limitNum = Number(limit);
    const total    = await Product.countDocuments(query);

    const products = await Product.find(query)
      .sort(sortObj)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    res.json({
      products,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET related products
router.get('/:id/related', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ error: 'Not found' });
    const related = await Product.find({
      cat: product.cat,
      _id: { $ne: product._id },
    }).limit(4).lean();
    res.json(related);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create product
router.post('/', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update product
router.put('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id, req.body, { new: true }
    ).lean();
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
