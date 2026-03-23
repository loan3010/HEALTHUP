const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    customerID:   { type: String, unique: true, sparse: true },
    username:     { type: String, required: true, unique: true, trim: true },
    phone:        { type: String, required: true, unique: true, trim: true },
    email:        { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role:         { type: String, enum: ['user', 'admin', 'guest'], default: 'user' },

    isActive: { type: Boolean, default: true },
    deactivationReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },

    dob:    { type: String, default: '' },
    gender: { type: String, enum: ['male', 'female', 'other'], default: 'male' },
    address:{ type: String, default: '' },

    // Hạng thành viên: tự động cập nhật sau mỗi đơn delivered
    memberRank: {
      type: String,
      enum: ['member', 'vip'],
      default: 'member'
    },

    // Tổng tiền đã chi (chỉ tính đơn delivered)
    totalSpent: { type: Number, default: 0 },

    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

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