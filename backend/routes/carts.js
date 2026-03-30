const express = require('express');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { parseCartRequest } = require('../helpers/cartIdentity');

const router = express.Router();

/** productId trên dòng giỏ (ObjectId hoặc populate). */
function productIdFromItem(item) {
  const p = item.productId;
  if (p && typeof p === 'object' && p._id) return String(p._id);
  return String(p || '');
}

/**
 * Chuẩn hóa biến thể để gộp đúng dòng: cùng SP + cùng phân loại dù gửi ObjectId hay chỉ label (mua lại từ đơn).
 */
function resolveCartVariant(product, variantId, variantLabel) {
  const label = String(variantLabel || '').trim();
  const raw = variantId != null && variantId !== '' ? String(variantId).trim() : '';

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) {
    return { variantId: null, variantLabel: '' };
  }
  if (raw && mongoose.Types.ObjectId.isValid(raw)) {
    const v = variants.find((x) => String(x._id) === raw);
    if (v) {
      return {
        variantId: new mongoose.Types.ObjectId(String(v._id)),
        variantLabel: String(v.label || label).trim(),
      };
    }
  }
  if (label) {
    const v = variants.find((x) => String(x.label || '').trim() === label);
    if (v) {
      return {
        variantId: new mongoose.Types.ObjectId(String(v._id)),
        variantLabel: label,
      };
    }
  }
  if (raw && !mongoose.Types.ObjectId.isValid(raw)) {
    const v = variants.find((x) => String(x.label || '').trim() === raw);
    if (v) {
      return {
        variantId: new mongoose.Types.ObjectId(String(v._id)),
        variantLabel: String(v.label || label).trim(),
      };
    }
  }

  return { variantId: null, variantLabel: label };
}

function sameCartLine(product, item, resolved) {
  if (productIdFromItem(item) !== String(product._id)) return false;
  const cur = resolveCartVariant(product, item.variantId, item.variantLabel);
  return String(cur.variantId || '') === String(resolved.variantId || '');
}

/** Gộp mọi dòng trùng (cùng SP + cùng phân loại sau chuẩn hóa) — sửa giỏ cũ bị tách nhiều thẻ. */
function dedupeCartItemsForProduct(product, cart, productIdStr) {
  const rest = cart.items.filter((i) => productIdFromItem(i) !== productIdStr);
  const merged = new Map();
  for (const it of cart.items) {
    if (productIdFromItem(it) !== productIdStr) continue;
    const res = resolveCartVariant(product, it.variantId, it.variantLabel);
    const key = `${String(res.variantId || '')}|${String(res.variantLabel || '').trim()}`;
    const prev = merged.get(key);
    const q = Math.max(1, Number(it.quantity || 1));
    if (!prev) {
      merged.set(key, {
        productId: new mongoose.Types.ObjectId(productIdStr),
        variantId: res.variantId,
        variantLabel: res.variantLabel,
        quantity: q,
      });
    } else {
      prev.quantity += q;
    }
  }
  cart.items = [...rest, ...merged.values()];
}

/** Thông báo khi thiếu cả userId hợp lệ và guest cart id. */
function cartAuthError(res) {
  return res.status(400).json({
    message:
      'Thiếu phiên giỏ hàng. Vui lòng tải lại trang hoặc đăng nhập. (guest: cần lưu mã giỏ trên trình duyệt)',
  });
}

// GET cart — populate userId + items.productId
router.get('/', async (req, res) => {
  try {
    const id = parseCartRequest(req);
    if (!id) return cartAuthError(res);

    const filter =
      id.mode === 'user' ? { userId: id.userId } : { guestSessionId: id.guestSessionId };

    const cart = await Cart.findOne(filter)
      .populate('userId', 'username customerID email phone')
      .populate('items.productId');

    if (id.mode === 'user') {
      return res.json(cart || { userId: id.userId, items: [] });
    }
    return res.json(cart || { guestSessionId: id.guestSessionId, items: [] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ADD item — kiểm tra stock variant
router.post('/add', async (req, res) => {
  try {
    const id = parseCartRequest(req);
    if (!id) return cartAuthError(res);

    const { productId, quantity, variantId, variantLabel } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId))
      return res.status(400).json({ message: 'productId invalid' });

    const qty = Math.max(1, Number(quantity || 1));

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
    if (product.isOutOfStock) return res.status(400).json({ message: 'Sản phẩm đã hết hàng' });

    const resolved = resolveCartVariant(product, variantId, variantLabel);

    if (product.variants?.length) {
      if (!resolved.variantId) {
        return res.status(400).json({ message: 'Phân loại không hợp lệ hoặc không tồn tại' });
      }
      const variant = product.variants.find(v => String(v._id) === String(resolved.variantId));
      if (!variant) return res.status(400).json({ message: 'Phân loại không tồn tại' });
      if (Number(variant.stock || 0) <= 0) {
        return res.status(400).json({ message: `Phân loại "${variant.label}" đã hết hàng` });
      }
    } else if (Number(product.stock || 0) <= 0) {
      return res.status(400).json({ message: 'Sản phẩm đã hết hàng' });
    }

    const filter =
      id.mode === 'user' ? { userId: id.userId } : { guestSessionId: id.guestSessionId };
    const setOnInsert =
      id.mode === 'user'
        ? { userId: new mongoose.Types.ObjectId(id.userId) }
        : { guestSessionId: id.guestSessionId };

    // Không bật runValidators ở đây: kết hợp upsert + $setOnInsert dễ kích hoạt validate sớm, lỗi 500.
    // Sau khi có document, cart.save() sẽ validate items + pre('save') kiểm tra userId XOR guestSessionId.
    const cart = await Cart.findOneAndUpdate(filter, { $setOnInsert: setOnInsert }, {
      upsert: true,
      new: true,
    });

    const idx = cart.items.findIndex((i) => sameCartLine(product, i, resolved));
    if (idx >= 0) {
      cart.items[idx].quantity += qty;
      cart.items[idx].variantId = resolved.variantId;
      cart.items[idx].variantLabel = resolved.variantLabel || '';
    } else {
      cart.items.push({
        productId: new mongoose.Types.ObjectId(productId),
        variantId: resolved.variantId,
        variantLabel: resolved.variantLabel || '',
        quantity: qty,
      });
    }

    dedupeCartItemsForProduct(product, cart, String(productId));

    await cart.save();
    res.json(cart);
  } catch (err) {
    if (err.code === 11000 && String(err.message || '').includes('userId')) {
      return res.status(500).json({
        message:
          'Cấu hình index giỏ hàng trên server cũ. Khởi động lại API (syncIndexes) hoặc chạy: node backend/scripts/sync-cart-indexes.js',
        error: err.message,
      });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// UPDATE quantity
router.put('/update', async (req, res) => {
  try {
    const id = parseCartRequest(req);
    if (!id) return cartAuthError(res);

    const { productId, quantity, variantId, variantLabel } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId))
      return res.status(400).json({ message: 'productId invalid' });

    const qty = Math.max(1, Number(quantity || 1));

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
    const resolved = resolveCartVariant(product, variantId, variantLabel);

    const filter =
      id.mode === 'user' ? { userId: id.userId } : { guestSessionId: id.guestSessionId };
    const cart = await Cart.findOne(filter);
    if (!cart) return res.status(404).json({ message: 'Cart not found' });

    const idx = cart.items.findIndex((i) => sameCartLine(product, i, resolved));
    if (idx >= 0) {
      cart.items[idx].quantity = qty;
      cart.items[idx].variantId = resolved.variantId;
      cart.items[idx].variantLabel = resolved.variantLabel || '';
      dedupeCartItemsForProduct(product, cart, String(productId));
      await cart.save();
    }

    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE item — theo productId + variantId
router.delete('/remove/:productId', async (req, res) => {
  try {
    const id = parseCartRequest(req);
    if (!id) return cartAuthError(res);

    const { productId } = req.params;
    const variantId = String(req.query.variantId || '').trim();
    const variantLabel = String(req.query.variantLabel || '').trim();

    if (!mongoose.Types.ObjectId.isValid(productId))
      return res.status(400).json({ message: 'productId invalid' });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
    const resolved = resolveCartVariant(product, variantId || undefined, variantLabel);

    const filter =
      id.mode === 'user' ? { userId: id.userId } : { guestSessionId: id.guestSessionId };
    const cart = await Cart.findOne(filter);
    if (!cart) return res.status(404).json({ message: 'Cart not found' });

    if (product.variants?.length && !resolved.variantId) {
      return res.status(400).json({ message: 'Cần phân loại (variantId hoặc variantLabel) để xóa' });
    }

    cart.items = cart.items.filter((i) => !sameCartLine(product, i, resolved));

    await cart.save();
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
