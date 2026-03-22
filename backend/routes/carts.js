const express = require('express');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { parseCartRequest } = require('../helpers/cartIdentity');

const router = express.Router();

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
    if (variantId && !mongoose.Types.ObjectId.isValid(variantId))
      return res.status(400).json({ message: 'variantId invalid' });

    const qty = Math.max(1, Number(quantity || 1));

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
    if (product.isOutOfStock) return res.status(400).json({ message: 'Sản phẩm đã hết hàng' });

    if (variantId && product.variants?.length) {
      const variant = product.variants.find(v => String(v._id) === String(variantId));
      if (!variant) return res.status(400).json({ message: 'Phân loại không tồn tại' });
      if (Number(variant.stock || 0) <= 0) {
        return res.status(400).json({ message: `Phân loại "${variant.label}" đã hết hàng` });
      }
    } else if (!variantId && product.variants?.length === 0) {
      if (Number(product.stock || 0) <= 0) {
        return res.status(400).json({ message: 'Sản phẩm đã hết hàng' });
      }
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

    const idx = cart.items.findIndex(
      i =>
        String(i.productId) === String(productId) &&
        String(i.variantId || '') === String(variantId || '')
    );
    if (idx >= 0) cart.items[idx].quantity += qty;
    else {
      cart.items.push({
        productId,
        variantId: variantId || null,
        variantLabel: String(variantLabel || '').trim(),
        quantity: qty,
      });
    }

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

    const { productId, quantity, variantId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId))
      return res.status(400).json({ message: 'productId invalid' });
    if (variantId && !mongoose.Types.ObjectId.isValid(variantId))
      return res.status(400).json({ message: 'variantId invalid' });

    const qty = Math.max(1, Number(quantity || 1));

    const filter =
      id.mode === 'user' ? { userId: id.userId } : { guestSessionId: id.guestSessionId };
    const cart = await Cart.findOne(filter);
    if (!cart) return res.status(404).json({ message: 'Cart not found' });

    const idx = cart.items.findIndex(
      i =>
        String(i.productId) === String(productId) &&
        String(i.variantId || '') === String(variantId || '')
    );
    if (idx >= 0) {
      cart.items[idx].quantity = qty;
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

    if (!mongoose.Types.ObjectId.isValid(productId))
      return res.status(400).json({ message: 'productId invalid' });
    if (variantId && !mongoose.Types.ObjectId.isValid(variantId))
      return res.status(400).json({ message: 'variantId invalid' });

    const filter =
      id.mode === 'user' ? { userId: id.userId } : { guestSessionId: id.guestSessionId };
    const cart = await Cart.findOne(filter);
    if (!cart) return res.status(404).json({ message: 'Cart not found' });

    cart.items = cart.items.filter(i => {
      const sameProduct = String(i.productId) === String(productId);
      if (!sameProduct) return true;
      if (variantId) {
        const sameVariant = String(i.variantId || '') === String(variantId);
        return !sameVariant;
      }
      return false;
    });

    await cart.save();
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
