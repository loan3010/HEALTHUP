/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthup';

async function main() {
  await mongoose.connect(uri);
  const p = await Product.findOne().select('_id variants stock').lean();
  if (!p) {
    console.log('No product in DB');
    process.exit(0);
  }
  const gid = '22222222-2222-4222-a222-222222222222';
  const filter = { guestSessionId: gid };
  const setOnInsert = { guestSessionId: gid };
  let cart = await Cart.findOneAndUpdate(filter, { $setOnInsert: setOnInsert }, { upsert: true, new: true });
  console.log('cart keys', Object.keys(cart.toObject()));
  console.log('userId', cart.userId, 'guest', cart.guestSessionId);

  const variantId =
    p.variants && p.variants.length ? p.variants[0]._id : null;
  cart.items.push({
    productId: p._id,
    variantId,
    variantLabel: '',
    quantity: 1,
  });
  await cart.save();
  console.log('save OK');
  await Cart.deleteOne({ _id: cart._id });
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('FAIL', e.message);
  console.error(e);
  process.exit(1);
});
