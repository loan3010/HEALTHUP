const express = require('express');
const router  = express.Router();
const Product = require('../models/Product');

// ─────────────────────────────────────────────────────────────────
// QUAN TRỌNG: Các route cụ thể PHẢI đứng TRƯỚC /:id
// ─────────────────────────────────────────────────────────────────
const multer = require('multer');
const path   = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/images/products'));
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ─────────────────────────────────────────────────────────────────
// GET featured — random 4 sản phẩm đang hiện, không ẩn
// ─────────────────────────────────────────────────────────────────
router.get('/featured', async (req, res) => {
  try {
    const limit = Math.max(1, Number(req.query.limit) || 4);

    const products = await Product.aggregate([
      { $match: { isHidden: { $ne: true } } },
      { $sample: { size: limit } }
    ]);

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET category counts — chỉ đếm sản phẩm đang hiện
// ─────────────────────────────────────────────────────────────────
router.get('/category-counts', async (req, res) => {
  try {
    const result = await Product.aggregate([
      { $match: { isHidden: { $ne: true } } },
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
    .replace(/[đĐ]/g, d => (d === 'đ' ? 'd' : 'D'))
    .toLowerCase()
    .trim();
}

function normalizeVariantsInput(rawVariants) {
  if (!Array.isArray(rawVariants)) return [];
  const cleaned = rawVariants
    .map(v => ({
      label:    String(v?.label || '').trim(),
      price:    Number(v?.price || 0),
      stock:    Math.max(0, Number(v?.stock || 0)),
      oldPrice: Math.max(0, Number(v?.oldPrice || 0)),
      isActive: v?.isActive !== false
    }))
    .filter(v => v.label && Number.isFinite(v.price) && v.price >= 0);

  const seen = new Set();
  return cleaned.filter(v => {
    const key = v.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────
// GET /api/products   — browse + search + filter
// ─────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const {
      cat, minPrice, maxPrice, sort, badge, minRating,
      page = 1, limit = 9,
      search, isAdmin
    } = req.query;

    const adminMode = isAdmin === 'true';

    // ── SEARCH MODE ──
    if (search && search.trim() !== '') {
      const kwNorm   = normalizeVN(search.trim());
      const limitNum = Math.min(Number(limit) || 6, 20);

      if (!kwNorm) {
        return res.json({ products: [], total: 0, page: 1, totalPages: 0 });
      }

      const baseQuery   = adminMode ? {} : { isHidden: { $ne: true } };
      const allProducts = await Product.find(baseQuery).lean();

      const matched = allProducts.filter(p =>
        normalizeVN(p.name).includes(kwNorm)
      );

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

    if (!adminMode) {
      query.isHidden = { $ne: true };
    }

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
      case 'price-asc':   sortObj = { price: 1 };      break;
      case 'price-desc':  sortObj = { price: -1 };     break;
      case 'newest':      sortObj = { createdAt: -1 }; break;
      case 'oldest':      sortObj = { createdAt: 1 };  break;
      case 'updated':     sortObj = { updatedAt: -1 }; break;
      case 'updated-asc': sortObj = { updatedAt: 1 };  break;
      case 'rating':      sortObj = { rating: -1 };    break;
      case 'rating-asc':  sortObj = { rating: 1 };     break;
      default:            sortObj = { sold: -1 };
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

// POST upload image
router.post('/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const imageUrl = '/images/products/' + req.file.filename;
  res.json({ url: imageUrl });
});

// ─────────────────────────────────────────────────────────────────
// PATCH /:id/toggle-hidden
// ─────────────────────────────────────────────────────────────────
router.patch('/:id/toggle-hidden', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    product.isHidden = !product.isHidden;
    await product.save();
    res.json({
      isHidden: product.isHidden,
      message: product.isHidden ? 'Đã ẩn sản phẩm' : 'Đã hiện sản phẩm'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH toggle-outofstock
router.patch('/:id/toggle-outofstock', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    product.isOutOfStock = !product.isOutOfStock;
    await product.save();
    res.json({
      isOutOfStock: product.isOutOfStock,
      message: product.isOutOfStock ? 'Đã bật Tạm hết hàng' : 'Đã tắt Tạm hết hàng'
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

    const adminMode = req.query.isAdmin === 'true';
    if (!adminMode && product.isHidden) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET related products — FIX: random bằng $sample
// Ưu tiên cùng danh mục, nếu không đủ thì bổ sung từ danh mục khác
// ─────────────────────────────────────────────────────────────────
router.get('/:id/related', async (req, res) => {
  try {
    const limit = Math.max(1, Number(req.query.limit) || 4);

    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ error: 'Not found' });

    // Lấy random trong cùng danh mục trước
    const sameCat = await Product.aggregate([
      {
        $match: {
          cat:      product.cat,
          _id:      { $ne: product._id },
          isHidden: { $ne: true },
        }
      },
      { $sample: { size: limit } }
    ]);

    // Nếu chưa đủ số lượng → bổ sung từ danh mục khác (cũng random)
    if (sameCat.length < limit) {
      const excludeIds = [product._id, ...sameCat.map(p => p._id)];
      const remaining  = limit - sameCat.length;

      const otherCat = await Product.aggregate([
        {
          $match: {
            _id:      { $nin: excludeIds },
            isHidden: { $ne: true },
          }
        },
        { $sample: { size: remaining } }
      ]);

      return res.json([...sameCat, ...otherCat]);
    }

    res.json(sameCat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create product
router.post('/', async (req, res) => {
  try {
    if (!req.body.sku || String(req.body.sku).trim() === '') {
      const skuDocs = await Product.find(
        { sku: { $regex: '^SKU\\d{4}$' } },
        { sku: 1 }
      ).lean();

      let maxNum = 0;
      for (const d of skuDocs) {
        const raw = String(d.sku || '');
        const num = parseInt(raw.replace(/^SKU/, ''), 10);
        if (Number.isFinite(num) && num > maxNum) maxNum = num;
      }

      const nextNum = maxNum + 1;
      req.body.sku = 'SKU' + String(nextNum).padStart(4, '0');
    }

    const variants = normalizeVariantsInput(req.body.variants);
    if (variants.length > 0) {
      req.body.variants = variants;
      req.body.price    = variants[0].price;
      req.body.oldPrice = variants[0].oldPrice || req.body.oldPrice || 0;
      req.body.stock    = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    }

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
    const variants = normalizeVariantsInput(req.body.variants);
    if (Array.isArray(req.body.variants)) {
      req.body.variants = variants;
      if (variants.length > 0) {
        req.body.price    = variants[0].price;
        req.body.oldPrice = variants[0].oldPrice || req.body.oldPrice || 0;
        req.body.stock    = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
      }
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id, req.body, { new: true, runValidators: true }
    ).lean();
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;