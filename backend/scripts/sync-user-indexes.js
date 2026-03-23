/**
 * Cập nhật index User (customerID sparse unique) — chạy nếu guest thứ 2+ bị lỗi trùng khóa.
 *   node scripts/sync-user-indexes.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthup';

mongoose
  .connect(uri)
  .then(async () => {
    const r = await User.syncIndexes();
    console.log('User.syncIndexes:', r);
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
