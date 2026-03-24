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
    minlength: [5, 'Địa chỉ phải có ít nhất 5 ký tự']
  },
  // ✅ Thêm các field riêng
  street:       { type: String, trim: true, default: '' },
  wardName:     { type: String, trim: true, default: '' },
  wardCode:     { type: Number, default: null },
  districtName: { type: String, trim: true, default: '' },
  districtCode: { type: Number, default: null },
  provinceName: { type: String, trim: true, default: '' },
  provinceCode: { type: Number, default: null },
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

addressSchema.index({ userId: 1 });

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