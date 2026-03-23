const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  type: { 
    type: String, 
    default: 'order' 
  }, // Các loại: order, promo, system, consulting...
  title: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  link: { 
    type: String, 
    default: '' 
  }, // Đường dẫn điều hướng khi người dùng click vào thông báo
  icon: { 
    type: String, 
    default: '🔔' 
  }, // Biểu tượng emoji minh họa cho loại thông báo
  isRead: { 
    type: Boolean, 
    default: false 
  },

  // ✅ Tham chiếu đến đơn hàng (Dùng để điều hướng sang trang order-detail)
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order', 
    default: null 
  },

  /** 
   * ✅ Tham chiếu đến sản phẩm (Dùng cho thông báo tư vấn/bình luận 
   * — Hỗ trợ mở trang chi tiết sản phẩm ngay lập tức) 
   */
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    default: null 
  },

}, { 
  timestamps: true // Tự động tạo trường createdAt và updatedAt
});

module.exports = mongoose.model('Notification', NotificationSchema);