const mongoose = require('mongoose');

const ConsultingSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  user: { type: String, required: true }, // Tên người dùng hiển thị
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // ID người dùng nếu cần
  content: { type: String, required: true },
  answer: { type: String, default: '' },
  answeredBy: { type: String }, // Lưu tên Quản trị viên trả lời
  status: { type: String, enum: ['pending', 'answered'], default: 'pending' },
  
  // 2 trường để phục vụ tính năng Đánh giá câu trả lời (Like/Dislike)
  helpfulCount: { type: Number, default: 0 }, 
  unhelpfulCount: { type: Number, default: 0 }, 
  
  answerAt: { type: Date }
}, { 
  timestamps: true,
  collection: 'consultings' // ✅ Ép buộc Mongoose dùng đúng collection tên là 'consultings'
});

module.exports = mongoose.model('Consulting', ConsultingSchema);