const mongoose = require('mongoose');

const ChatbotSettingsSchema = new mongoose.Schema({
  // fuzzyThreshold: Độ nhạy của Fuse.js (0-1). 
  // 0.4 tương đương khách gõ đúng khoảng 60% là bot hiểu.
  fuzzyThreshold: { type: Number, default: 0.4 }, 
  
  // normalizationMap: Từ điển chuẩn hóa (Ví dụ: "ko" -> "không")
  normalizationMap: [{
    from: String,
    to: String
  }]
}, { timestamps: true });

// Export model 'ChatbotSettings' để Controller có thể dùng các hàm .find(), .findOne()...
module.exports = mongoose.model('ChatbotSettings', ChatbotSettingsSchema);