const mongoose = require('mongoose');

/**
 * Chatbot Schema - Lưu trữ kho tri thức và các liên kết sản phẩm gợi ý
 */
const ChatbotSchema = new mongoose.Schema({
  // Nội dung câu hỏi chính
  question: { 
    type: String, 
    required: true 
  },
  
  // Nội dung phản hồi chi tiết từ Bot
  answer: { 
    type: String, 
    required: true 
  },
  
  // Phân loại nhóm câu hỏi (Ví dụ: Granola, Trà thảo mộc, Chính sách...)
  category: { 
    type: String, 
    default: 'Chính sách chung' 
  },
  
  // Danh sách các cách diễn đạt khác nhau của cùng một ý hỏi
  variations: { 
    type: [String], 
    default: [] 
  },

  // DANH SÁCH SẢN PHẨM LIÊN QUAN (Mới cập nhật)
  // Lưu trữ mảng các mã định danh (ID) tham chiếu trực tiếp đến bộ sưu tập Sản phẩm
  relatedProducts: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product' 
  }],

  // Trạng thái hoạt động của câu hỏi trên hệ thống
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { 
  // Tự động tạo trường thời gian khởi tạo và cập nhật cuối cùng
  timestamps: true 
});

// Xuất mô hình 'Chatbot' để sử dụng tại các tầng xử lý logic (Controllers)
module.exports = mongoose.model('Chatbot', ChatbotSchema);