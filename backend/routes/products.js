const express = require('express');
const router  = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');

/** Badge “new”: sản phẩm tạo trong N ngày gần đây (admin không chỉnh tay). */
const NEW_BADGE_MS = (Number(process.env.NEW_BADGE_DAYS) || 14) * 86400000;
/** Badge “hot”: tổng số lượng bán (items.quantity) trong window ngày ≥ ngưỡng. */
const HOT_BADGE_DAYS = Number(process.env.HOT_BADGE_DAYS) || 7;
const HOT_BADGE_MIN_ORDERS = Number(process.env.HOT_BADGE_MIN_ORDERS) || 50;

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

    res.json(await attachBadgesToProducts(products));
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

/**
 * Tách label "A | B | C | D" → tối đa 4 phần (khi client chưa gửi attr đủ).
 */
function splitLabelToAttrs(label) {
  const raw = String(label || '').trim();
  const empty = { a1: '', a2: '', a3: '', a4: '' };
  if (!raw) return empty;
  const parts = raw.split('|').map((x) => x.trim()).filter(Boolean);
  return {
    a1: parts[0] || '',
    a2: parts[1] || '',
    a3: parts[2] || '',
    a4: parts[3] || ''
  };
}

/** Ghép label từ attr1–4 (bỏ phần rỗng cuối). */
function joinAttrsToLabel(a1, a2, a3, a4) {
  const parts = [a1, a2, a3, a4].map((x) => String(x || '').trim()).filter(Boolean);
  return parts.join(' | ');
}

function normalizeVariantAttrName(v, fallback) {
  const t = String(v ?? '').trim();
  const max = 80;
  return (t.length > max ? t.slice(0, max) : t) || fallback;
}

function normalizeVariantsInput(rawVariants) {
  if (!Array.isArray(rawVariants)) return [];
  const cleaned = rawVariants
    .map((v) => {
      let attr1 = String(v?.attr1Value ?? '').trim();
      let attr2 = String(v?.attr2Value ?? '').trim();
      let attr3 = String(v?.attr3Value ?? '').trim();
      let attr4 = String(v?.attr4Value ?? '').trim();
      let label = String(v?.label || '').trim();
      const needFromLabel = !attr1 || !attr2 || !attr3 || !attr4;
      if (needFromLabel && label) {
        const p = splitLabelToAttrs(label);
        if (!attr1) attr1 = p.a1;
        if (!attr2) attr2 = p.a2;
        if (!attr3) attr3 = p.a3;
        if (!attr4) attr4 = p.a4;
      }
      label = joinAttrsToLabel(attr1, attr2, attr3, attr4) || label;

      return {
        label,
        attr1Value: attr1,
        attr2Value: attr2,
        attr3Value: attr3,
        attr4Value: attr4,
        image: String(v?.image || '').trim(),
        price: Number(v?.price || 0),
        stock: Math.max(0, Number(v?.stock || 0)),
        oldPrice: Math.max(0, Number(v?.oldPrice || 0)),
        isActive: v?.isActive !== false
      };
    })
    .filter((v) => v.label && Number.isFinite(v.price) && v.price >= 0);

  const seen = new Set();
  return cleaned.filter((v) => {
    const key = v.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Chuẩn hóa kiểu định lượng từ body (POST/PUT). */
function normalizeVariantQuantityKind(raw) {
  const k = String(raw || '').toLowerCase().trim();
  if (k === 'mass' || k === 'volume') return k;
  return 'none';
}

/**
 * Phát hiện gợi ý thể tích (ml, l, lít) trong nhãn biến thể — heuristic đơn giản.
 * Dùng để bắt trộn mass+volume trên cùng sản phẩm khi admin chọn một kiểu cố định.
 */
function textHasVolumeQuantityHint(text) {
  const s = String(text || '').toLowerCase();
  if (/\d[\d.,]*\s*(ml|mℓ)\b/.test(s)) return true;
  if (/\d[\d.,]*\s*l\b/.test(s)) return true;
  if (/\b(lít|liter|litre)\b/.test(s)) return true;
  return false;
}

/** Gợi ý khối lượng (g, gr, gram, kg). */
function textHasMassQuantityHint(text) {
  const s = String(text || '').toLowerCase();
  if (/\d[\d.,]*\s*(g|gr|gram|grams)\b/.test(s)) return true;
  if (/\d[\d.,]*\s*kg\b/.test(s)) return true;
  if (/\bkg\b/.test(s)) return true;
  return false;
}

/** Ghép toàn bộ chữ cần kiểm tra cho một biến thể. */
function variantQuantityProbe(v) {
  return [v.label, v.attr1Value, v.attr2Value, v.attr3Value, v.attr4Value]
    .map((x) => String(x || '').trim())
    .join(' ');
}

/** Chuẩn hóa mảng cấu hình nhóm phân loại (tối đa 4 preset). */
function normalizeVariantClassificationsPayload(raw) {
  if (!Array.isArray(raw)) return { ok: [] };
  const rows = raw
    .slice(0, 4)
    .map((row) => {
      const role = String(row?.role || 'free').toLowerCase();
      const r = role === 'mass' || role === 'volume' ? role : 'free';
      const name = String(row?.name || '').trim().slice(0, 80);
      const values = (Array.isArray(row?.values) ? row.values : [])
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .filter((x, i, a) => a.indexOf(x) === i);
      return { role: r, name, values };
    });

  let massN = 0;
  let volN = 0;
  rows.forEach((row) => {
    if (row.role === 'mass') massN++;
    if (row.role === 'volume') volN++;
  });
  if (massN > 1) return { error: 'Chỉ được tối đa một nhóm Khối lượng (g, kg).' };
  if (volN > 1) return { error: 'Chỉ được tối đa một nhóm Thể tích (ml, l).' };
  if (massN && volN) {
    return { error: 'Không được vừa có nhóm Khối lượng vừa có nhóm Thể tích trên cùng sản phẩm.' };
  }
  return { ok: rows };
}

/** Gán variantQuantityKind từ cấu hình nhóm (mass / volume / none). */
function deriveVariantQuantityKindFromClassifications(classifications) {
  const arr = Array.isArray(classifications) ? classifications : [];
  if (arr.some((c) => c.role === 'mass')) return 'mass';
  if (arr.some((c) => c.role === 'volume')) return 'volume';
  return 'none';
}

/** Chip trong nhóm mass/volume phải khớp đơn vị (heuristic). */
function validateClassificationChipValues(classifications) {
  const arr = Array.isArray(classifications) ? classifications : [];
  for (const c of arr) {
    for (const val of c.values || []) {
      const t = String(val || '');
      if (c.role === 'mass' && textHasVolumeQuantityHint(t)) {
        return `Nhóm Khối lượng: giá trị "${val}" có dấu hiệu thể tích (ml/l).`;
      }
      if (c.role === 'volume' && textHasMassQuantityHint(t)) {
        return `Nhóm Thể tích: giá trị "${val}" có dấu hiệu khối lượng (g/kg).`;
      }
    }
  }
  return null;
}

/** Chuẩn hóa + validate classifications trên body; gán variantQuantityKind. Trả { error } hoặc { ok }. */
function applyVariantClassificationsToBody(reqBody) {
  if (!Object.prototype.hasOwnProperty.call(reqBody, 'variantClassifications')) {
    return { ok: true };
  }
  const norm = normalizeVariantClassificationsPayload(reqBody.variantClassifications);
  if (norm.error) return { error: norm.error };
  reqBody.variantClassifications = norm.ok;
  const chipErr = validateClassificationChipValues(norm.ok);
  if (chipErr) return { error: chipErr };
  reqBody.variantQuantityKind = deriveVariantQuantityKindFromClassifications(norm.ok);
  return { ok: true };
}

/**
 * Tổng số lượng đã bán (theo dòng đơn) trong window HOT_BADGE_DAYS — dùng cho badge "hot".
 */
async function hotOrderQtyByProductIds(productIds) {
  if (!productIds || !productIds.length) return new Map();
  const since = new Date(Date.now() - HOT_BADGE_DAYS * 86400000);
  const rows = await Order.aggregate([
    { $match: { createdAt: { $gte: since }, status: { $ne: 'cancelled' } } },
    { $unwind: '$items' },
    { $match: { 'items.productId': { $in: productIds } } },
    { $group: { _id: '$items.productId', n: { $sum: '$items.quantity' } } }
  ]);
  const m = new Map();
  rows.forEach((r) => m.set(String(r._id), r.n));
  return m;
}

/** Badge hiển thị: hot ưu tiên hơn new — không lấy từ body admin. */
function computePublicBadge(productLean, hotMap) {
  const id = String(productLean._id);
  const soldN = hotMap.get(id) || 0;
  if (soldN >= HOT_BADGE_MIN_ORDERS) return 'hot';
  const t = productLean.createdAt ? new Date(productLean.createdAt).getTime() : 0;
  if (t && Date.now() - t <= NEW_BADGE_MS) return 'new';
  return null;
}

async function attachBadgesToProducts(list) {
  if (!Array.isArray(list) || !list.length) return list;
  const ids = list.map((p) => p._id);
  const hotMap = await hotOrderQtyByProductIds(ids);
  return list.map((p) => ({ ...p, badge: computePublicBadge(p, hotMap) }));
}

/**
 * Trả về thông báo lỗi tiếng Việt hoặc null nếu hợp lệ.
 * Chỉ gọi khi đã có ít nhất một biến thể.
 */
function validateVariantQuantityKind(kind, variants) {
  const k = normalizeVariantQuantityKind(kind);
  if (!Array.isArray(variants) || variants.length === 0) return null;

  for (let i = 0; i < variants.length; i++) {
    const probe = variantQuantityProbe(variants[i]);
    const hasV = textHasVolumeQuantityHint(probe);
    const hasM = textHasMassQuantityHint(probe);

    if (k === 'mass' && hasV) {
      return `Kiểu "khối lượng": biến thể "${variants[i].label}" có dấu hiệu thể tích (ml/l). Đổi kiểu hoặc sửa nhãn.`;
    }
    if (k === 'volume' && hasM) {
      return `Kiểu "thể tích": biến thể "${variants[i].label}" có dấu hiệu khối lượng (g/kg). Đổi kiểu hoặc sửa nhãn.`;
    }
    if (k === 'none' && hasM && hasV) {
      return `Kiểu "không dùng g/ml": biến thể "${variants[i].label}" vừa có g/kg vừa có ml/l. Tách SP hoặc chọn một kiểu định lượng.`;
    }
  }
  return null;
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

      const slice = matched.slice(0, limitNum);
      const withBadge = await attachBadgesToProducts(slice);

      return res.json({
        products:   withBadge,
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

    const withBadge = await attachBadgesToProducts(products);

    res.json({
      products: withBadge,
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
    // Badge do hệ thống tính (new/hot) — không cho admin gửi tay.
    delete req.body.badge;

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

    const clsCreate = applyVariantClassificationsToBody(req.body);
    if (clsCreate.error) return res.status(400).json({ message: clsCreate.error });
    if (!Object.prototype.hasOwnProperty.call(req.body, 'variantClassifications')) {
      req.body.variantQuantityKind = normalizeVariantQuantityKind(req.body.variantQuantityKind);
    }

    const variants = normalizeVariantsInput(req.body.variants);
    if (variants.length > 0) {
      req.body.variants = variants;
      req.body.price    = variants[0].price;
      req.body.oldPrice = variants[0].oldPrice || req.body.oldPrice || 0;
      req.body.stock    = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    }

    const qErrCreate = validateVariantQuantityKind(req.body.variantQuantityKind, variants);
    if (qErrCreate) return res.status(400).json({ message: qErrCreate });

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
    delete req.body.badge;

    const clsPut = applyVariantClassificationsToBody(req.body);
    if (clsPut.error) return res.status(400).json({ message: clsPut.error });
    if (!Object.prototype.hasOwnProperty.call(req.body, 'variantClassifications')) {
      if (Object.prototype.hasOwnProperty.call(req.body, 'variantQuantityKind')) {
        req.body.variantQuantityKind = normalizeVariantQuantityKind(req.body.variantQuantityKind);
      }
    }

    const variants = normalizeVariantsInput(req.body.variants);
    if (Array.isArray(req.body.variants)) {
      req.body.variants = variants;
      if (variants.length > 0) {
        req.body.price    = variants[0].price;
        req.body.oldPrice = variants[0].oldPrice || req.body.oldPrice || 0;
        req.body.stock    = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
        req.body.variantAttr1Name = normalizeVariantAttrName(req.body.variantAttr1Name, 'Phân loại 1');
        req.body.variantAttr2Name = normalizeVariantAttrName(req.body.variantAttr2Name, 'Phân loại 2');
        req.body.variantAttr3Name = normalizeVariantAttrName(req.body.variantAttr3Name, 'Phân loại 3');
        req.body.variantAttr4Name = normalizeVariantAttrName(req.body.variantAttr4Name, 'Phân loại 4');
      }
    }

    // Kiểm tra XOR: dùng kiểu trong body nếu có, không thì đọc bản ghi cũ.
    if (Array.isArray(req.body.variants)) {
      let kindPut = req.body.variantQuantityKind;
      if (kindPut === undefined) {
        const exK = await Product.findById(req.params.id).select('variantQuantityKind').lean();
        kindPut = exK?.variantQuantityKind;
      }
      const qErrPut = validateVariantQuantityKind(kindPut, variants);
      if (qErrPut) return res.status(400).json({ message: qErrPut });
    } else if (Object.prototype.hasOwnProperty.call(req.body, 'variantQuantityKind')) {
      const ex = await Product.findById(req.params.id).select('variants').lean();
      const vOld = normalizeVariantsInput(ex?.variants);
      const qErrOnlyKind = validateVariantQuantityKind(req.body.variantQuantityKind, vOld);
      if (qErrOnlyKind) return res.status(400).json({ message: qErrOnlyKind });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id, req.body, { new: true, runValidators: true }
    ).lean();
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /:id — xóa vĩnh viễn bản ghi (admin; khác toggle ẩn)
// ─────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Đã xóa sản phẩm vĩnh viễn' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;