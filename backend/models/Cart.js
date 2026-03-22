// models/Cart.js
const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  variantLabel: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 1 }
}, { _id: false });

// Mỗi document có đúng một trong hai: userId (tài khoản) hoặc guestSessionId (khách chưa đăng nhập).
const CartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: undefined },
    guestSessionId: { type: String, default: undefined, trim: true },
    items: { type: [CartItemSchema], default: [] },
  },
  { timestamps: true }
);

CartSchema.index({ userId: 1 }, { unique: true, sparse: true });
CartSchema.index({ guestSessionId: 1 }, { unique: true, sparse: true });

/**
 * Chỉ chạy khi .save() — KHÔNG dùng pre('validate') vì findOneAndUpdate(..., runValidators)
 * với upsert có thể validate trước khi $setOnInsert gắn userId/guestSessionId → lỗi 500 khi thêm giỏ.
 */
CartSchema.pre('save', function preCartIdentity(next) {
  const hasUser = this.userId != null;
  const hasGuest =
    this.guestSessionId != null && String(this.guestSessionId).trim() !== '';
  if (hasUser === hasGuest) {
    next(new Error('Giỏ cần đúng một trong hai: userId hoặc guestSessionId'));
  } else {
    next();
  }
});

module.exports = mongoose.model('Cart', CartSchema);