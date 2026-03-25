const mongoose = require('mongoose');

/**
 * OTP xác minh SĐT khi khách (không JWT member) đặt hàng.
 * Một bản ghi / số điện thoại; TTL xóa bản ghi khi expiresAt quá hạn (dự phòng).
 */
const GuestCheckoutOtpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true, trim: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    verifyAttempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

GuestCheckoutOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('GuestCheckoutOtp', GuestCheckoutOtpSchema);
