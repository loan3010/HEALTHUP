// routes/cart.js
const express = require('express');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const router = express.Router();

// demo: tạm lấy userId từ req.header (sau này thay bằng auth)
function getUserId(req) {
  return req.header('x-user-id');
}

// GET cart
router.get('/', async (req, res) => {
  const userId = getUserId(req);
  if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ message: 'userId invalid' });

  const cart = await Cart.findOne({ userId }).populate('items.productId');
  return res.json(cart || { userId, items: [] });
});

// ADD item
router.post('/add', async (req, res) => {
  const userId = getUserId(req);
  const { productId, quantity } = req.body;

  if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ message: 'userId invalid' });
  if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ message: 'productId invalid' });

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
});

module.exports = router;