const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  productId: { type: String, ref: 'Product', required: true },
  name: { type: String, required: true },
  initial: String,
  avatarColor: String,
  rating: { type: Number, required: true, min: 1, max: 5 },
  variant: String,
  tags: [String],
  text: { type: String, required: true },
  imgs: [String],
  adminReply: String,
  adminReplyDate: String,
  helpful: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  date: { type: String, default: () => new Date().toLocaleDateString('vi-VN') },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Review', ReviewSchema);