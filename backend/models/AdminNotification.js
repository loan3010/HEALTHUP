const mongoose = require('mongoose');

/**
 * Thông báo riêng cho admin (không dùng chung collection với Notification của user).
 * TTL 7 ngày: MongoDB tự xóa bản ghi sau expireAfterSeconds kể từ createdAt.
 */
const AdminNotificationSchema = new mongoose.Schema(
  {
    /** order_new | order_cancelled | return_requested | review_new | consulting_pending */
    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    productId: { type: String, default: '' },
    reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Review', default: null },
    /** Câu hỏi tư vấn (tab Tư vấn) — tùy chọn, để mở rộng sau. */
    consultingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consulting', default: null },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// 7 * 24 * 60 * 60 — sau 7 ngày MongoDB TTL monitor xóa document.
AdminNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.model('AdminNotification', AdminNotificationSchema);
