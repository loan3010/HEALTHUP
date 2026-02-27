const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },

    phone: { type: String, required: true, unique: true, trim: true },

    // ✅ Email KHÔNG bắt buộc
    // - unique + sparse để cho phép nhiều user không có email
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },

    passwordHash: { type: String, required: true },

    role: { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);