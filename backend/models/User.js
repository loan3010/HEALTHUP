const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // sparse: nhiều guest chưa có customerID — unique không sparse khiến mọi "thiếu field" trùng khóa null → chỉ tạo được 1 guest.
    customerID:   { type: String, unique: true, sparse: true },
    username:     { type: String, required: true, unique: true, trim: true },
    phone:        { type: String, required: true, unique: true, trim: true },
    email:        { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    /** guest = tự tạo khi checkout không đăng nhập; không đăng nhập được, đăng ký sẽ nâng cấp lên user */
    role:         { type: String, enum: ['user', 'admin', 'guest'], default: 'user' },

    // Trạng thái hoạt động của tài khoản (dùng cho admin-customer)
    // Mặc định user mới tạo sẽ đang hoạt động
    isActive:     { type: Boolean, default: true },

    // Lý do vô hiệu hóa (admin nhập khi khóa). Khách xem khi đăng nhập / gọi API.
    // Xóa khi kích hoạt lại tài khoản.
    deactivationReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },

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