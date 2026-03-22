/**
 * Chạy một lần (hoặc để server tự syncIndexes khi start):
 *   node scripts/sync-cart-indexes.js
 * Sửa index userId unique không sparse → nhiều giỏ khách (userId null) bị E11000.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Cart = require('../models/Cart');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthup';

mongoose
  .connect(uri)
  .then(async () => {
    const r = await Cart.syncIndexes();
    console.log('syncIndexes result:', r);
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
