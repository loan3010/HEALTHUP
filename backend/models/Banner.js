const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema({
  // Tiêu đề banner (để bà dễ phân biệt các chiến dịch)
  title: { 
    type: String, 
    default: 'Banner mới' 
  },

  // Đường dẫn file ảnh (Ví dụ: /images/banners/1700000.jpg)
  imageUrl: { 
    type: String, 
    required: true 
  },

  // Link liên kết khi khách bấm vào ảnh (Không bắt buộc)
  linkUrl: { 
    type: String, 
    default: '' 
  },

  // Trạng thái hiển thị: Bật là hiện bên Client, Tắt là ẩn
  isActive: { 
    type: Boolean, 
    default: true 
  },

  // Thứ tự hiển thị (Số nhỏ hiện trước)
  order: { 
    type: Number, 
    default: 0 
  }

}, { 
  timestamps: true // Tự động tạo createdAt và updatedAt
});

module.exports = mongoose.model('Banner', BannerSchema);