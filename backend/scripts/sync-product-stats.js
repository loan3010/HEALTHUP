/**
 * sync-product-stats.js
 * Đồng bộ reviewCount và rating thực tế từ collection Reviews → Products
 *
 * Chạy: node backend/scripts/sync-product-stats.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product  = require('../models/Product');
const Review   = require('../models/Review');

async function main() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log('✅ Đã kết nối MongoDB');

  const products = await Product.find({}).select('_id name').lean();
  console.log(`📦 Tổng số sản phẩm: ${products.length}`);

  let updated = 0;

  for (const p of products) {
    const reviews = await Review.find({ productId: p._id }).lean();

    const count = reviews.length;
    const avg   = count
      ? Number((reviews.reduce((s, r) => s + r.rating, 0) / count).toFixed(1))
      : 0;

    await Product.findByIdAndUpdate(p._id, {
      reviewCount: count,
      rating:      avg,
    });

    if (count > 0) {
      console.log(`  ✔ ${p.name}: ${count} đánh giá, rating ${avg}`);
      updated++;
    }
  }

  console.log(`\n🎉 Hoàn tất! Đã cập nhật ${updated}/${products.length} sản phẩm có review.`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});