const express = require('express');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const router = express.Router();

function getUserId(req) {
  return req.header('x-user-id');
}

// GET cart — populate cả userId và items.productId (bao gồm variants để frontend đổi phân loại)
router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ message: 'userId invalid' });

    const cart = await Cart.findOne({ userId })
      .populate('userId', 'username customerID email phone')
      .populate('items.productId');  // populate đủ để lấy variants, images, price...

    return res.json(cart || { userId, items: [] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ADD item — FIX: Kiểm tra stock của variant trước khi thêm
router.post('/add', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { productId, quantity, variantId, variantLabel } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ message: 'userId invalid' });
    if (!mongoose.Types.ObjectId.isValid(productId))
      return res.status(400).json({ message: 'productId invalid' });
    if (variantId && !mongoose.Types.ObjectId.isValid(variantId))
      return res.status(400).json({ message: 'variantId invalid' });

    const qty = Math.max(1, Number(quantity || 1));

    // FIX: Lấy product để kiểm tra stock trước khi thêm vào giỏ
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
    if (product.isOutOfStock) return res.status(400).json({ message: 'Sản phẩm đã hết hàng' });

    // Kiểm tra stock theo variant (nếu có) hoặc stock tổng
    if (variantId && product.variants?.length) {
      const variant = product.variants.find(v => String(v._id) === String(variantId));
      if (!variant) return res.status(400).json({ message: 'Phân loại không tồn tại' });
      if (Number(variant.stock || 0) <= 0) {
        return res.status(400).json({ message: `Phân loại "${variant.label}" đã hết hàng` });
      }
    } else if (!variantId && product.variants?.length === 0) {
      // Sản phẩm không có variant → kiểm tra stock tổng
      if (Number(product.stock || 0) <= 0) {
        return res.status(400).json({ message: 'Sản phẩm đã hết hàng' });
      }
    }

    const cart = await Cart.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId } },
      { upsert: true, new: true }
    );

    const idx = cart.items.findIndex(i =>
      String(i.productId) === String(productId) &&
      String(i.variantId || '') === String(variantId || '')
    );
    if (idx >= 0) cart.items[idx].quantity += qty;
    else cart.items.push({
      productId,
      variantId: variantId || null,
      variantLabel: String(variantLabel || '').trim(),
      quantity: qty
    });

    await cart.save();
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// UPDATE quantity — FIX: truyền variantId để update đúng item
router.put('/update', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { productId, quantity, variantId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ message: 'userId invalid' });
    if (!mongoose.Types.ObjectId.isValid(productId))
      return res.status(400).json({ message: 'productId invalid' });
    if (variantId && !mongoose.Types.ObjectId.isValid(variantId))
      return res.status(400).json({ message: 'variantId invalid' });

    const qty = Math.max(1, Number(quantity || 1));

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ message: 'Cart not found' });

    const idx = cart.items.findIndex(i =>
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

// DELETE item — FIX: Xóa đúng theo productId + variantId
router.delete('/remove/:productId', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { productId } = req.params;
    const variantId = String(req.query.variantId || '').trim();

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ message: 'userId invalid' });
    if (!mongoose.Types.ObjectId.isValid(productId))
      return res.status(400).json({ message: 'productId invalid' });
    if (variantId && !mongoose.Types.ObjectId.isValid(variantId))
      return res.status(400).json({ message: 'variantId invalid' });

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ message: 'Cart not found' });

    cart.items = cart.items.filter(i => {
      const sameProduct = String(i.productId) === String(productId);
      if (!sameProduct) return true; // giữ lại item khác product

      if (variantId) {
        // FIX: Có variantId → chỉ xóa đúng variant đó
        const sameVariant = String(i.variantId || '') === String(variantId);
        return !sameVariant;
      } else {
        // Không có variantId → xóa toàn bộ item của product đó (legacy)
        return false;
      }
    });

    await cart.save();
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;