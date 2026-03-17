// backend/models/Address.js

const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Vui lòng nhập tên'],
    trim: true,
    minlength: [2, 'Tên phải có ít nhất 2 ký tự']
  },
  phone: {
    type: String,
    required: [true, 'Vui lòng nhập số điện thoại'],
    trim: true,
    match: [/^[0-9]{9,11}$/, 'Số điện thoại không hợp lệ (9-11 chữ số)']
  },
  address: {
    type: String,
    required: [true, 'Vui lòng nhập địa chỉ'],
    trim: true,
    minlength: [10, 'Địa chỉ phải có ít nhất 10 ký tự']
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true // Tự động tạo createdAt và updatedAt
});

// Index để tìm kiếm nhanh theo userId
addressSchema.index({ userId: 1 });

// Middleware: Trước khi lưu địa chỉ mặc định, bỏ default của các địa chỉ khác
addressSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await mongoose.model('Address').updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

module.exports = mongoose.model('Address', addressSchema);