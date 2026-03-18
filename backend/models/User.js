const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },

    phone: { type: String, required: true, unique: true, trim: true },

    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },

    passwordHash: { type: String, required: true },

    role: { type: String, enum: ['user', 'admin'], default: 'user' },

    // ── THÊM MỚI: thông tin profile ──
    dob:     { type: String, default: '' },        // ngày sinh dạng string "YYYY-MM-DD"
    gender:  { type: String, enum: ['male', 'female', 'other'], default: 'male' },
    address: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);