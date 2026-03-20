// models/Cart.js
const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  variantLabel: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 1 }
}, { _id: false });

const CartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: { type: [CartItemSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Cart', CartSchema);