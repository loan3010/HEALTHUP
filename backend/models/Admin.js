const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Ví dụ: ADM003
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  // ✅ 2 trường mới để phục vụ Quên mật khẩu
  otp: { type: String }, 
  otpExpire: { type: Date } 
}, { 
  collection: 'admins',
  timestamps: true // Thêm cái này để biết tài khoản tạo khi nào, rất tiện nha bà
});

module.exports = mongoose.model('Admin', AdminSchema);