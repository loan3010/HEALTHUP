const express = require('express');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const router = express.Router();

function getUserId(req) {
  return req.header('x-user-id');
}

// GET cart — populate cả userId (để lấy username) và items.productId
router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ message: 'userId invalid' });

    const cart = await Cart.findOne({ userId })
      .populate('userId', 'username customerID email phone')  // ✅ lấy thêm thông tin user
      .populate('items.productId');

    return res.json(cart || { userId, items: [] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ADD item
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

// UPDATE quantity
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

// DELETE item
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
      const sameVariant = String(i.variantId || '') === String(variantId || '');
      if (!sameProduct) return true;
      if (!variantId) return false; // legacy: xóa toàn bộ theo productId
      return !sameVariant;
    });
    await cart.save();

    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;