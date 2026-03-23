const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:    { type: String, default: 'order' },   // order, promo, system...
  title:   { type: String, required: true },
  message: { type: String, required: true },
  link:    { type: String, default: '' },         // đường dẫn khi click vào thông báo
  icon:    { type: String, default: '🔔' },       // emoji icon
  isRead:  { type: Boolean, default: false },

  // ✅ Thêm orderId để navigate sang order-detail
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },

  /** Sản phẩm (thông báo tư vấn — mở trang chi tiết SP). */
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },

}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);