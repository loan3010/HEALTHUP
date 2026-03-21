const mongoose = require('mongoose');

const BlogSchema = new mongoose.Schema({
  tag:         { type: String, required: true },
  title:       { type: String, required: true },
  excerpt:     { type: String, required: true },
  content:     { type: String, default: '' },
  coverImage:  { type: String, default: '' },
  author:      { type: String, default: 'HealthUp' },
  date:        { type: String }, // Ngày cập nhật (Định dạng: DD/MM/YYYY)
  
  // Trạng thái ẩn/hiện bài viết (Mặc định là false - Hiển thị)
  isHidden:    { type: Boolean, default: false }, 

  createdAt:   { type: Date, default: Date.now }, // Ngày đăng bài gốc
  views:       { type: Number, default: 0 }       // Tổng lượt xem bài viết
});

module.exports = mongoose.model('Blog', BlogSchema);