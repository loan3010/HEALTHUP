const express = require('express');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const router = express.Router();

function getUserId(req) {
  return req.header('x-user-id');
}

// GET cart
router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ message: 'userId invalid' });

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    return res.json(cart || { userId, items: [] });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ADD item
router.post('/add', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { productId, quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ message: 'userId invalid' });
    if (!mongoose.Types.ObjectId.isValid(productId))
      return res.status(400).json({ message: 'productId invalid' });

    const qty = Math.max(1, Number(quantity || 1));

    const cart = await Cart.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId } },
      { upsert: true, new: true }
    );

    const idx = cart.items.findIndex(i => String(i.productId) === String(productId));
    if (idx >= 0) cart.items[idx].quantity += qty;
    else cart.items.push({ productId, quantity: qty });

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
    const { productId, quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ message: 'userId invalid' });
    if (!mongoose.Types.ObjectId.isValid(productId))
      return res.status(400).json({ message: 'productId invalid' });

    const qty = Math.max(1, Number(quantity || 1));

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ message: 'Cart not found' });

    const idx = cart.items.findIndex(i => String(i.productId) === String(productId));
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

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ message: 'userId invalid' });
    if (!mongoose.Types.ObjectId.isValid(productId))
      return res.status(400).json({ message: 'productId invalid' });

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ message: 'Cart not found' });

    cart.items = cart.items.filter(i => String(i.productId) !== String(productId));
    await cart.save();

    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;