const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    customerID:   { type: String, unique: true },
    username:     { type: String, required: true, unique: true, trim: true },
    phone:        { type: String, required: true, unique: true, trim: true },
    email:        { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role:         { type: String, enum: ['user', 'admin'], default: 'user' },

    // Trạng thái hoạt động của tài khoản (dùng cho admin-customer)
    // Mặc định user mới tạo sẽ đang hoạt động
    isActive:     { type: Boolean, default: true },

    // Profile
    dob:     { type: String, default: '' },
    gender:  { type: String, enum: ['male', 'female', 'other'], default: 'male' },
    address: { type: String, default: '' },

    // Wishlist: mảng product ID
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

    // Addresses
    addresses: [{
      name:      { type: String, required: true, trim: true },
      phone:     { type: String, required: true, trim: true },
      address:   { type: String, required: true, trim: true },
      isDefault: { type: Boolean, default: false },
    }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);