/**
 * Backfill SKU cho toàn bộ sản phẩm.
 *
 * Yêu cầu:
 * - SKU sinh theo createdAt tăng dần (cũ -> mới)
 * - Format: SKU0001, SKU0002...
 *
 * Usage:
 *  node scripts/backfill-product-sku.js --dry-run
 *  node scripts/backfill-product-sku.js --overwrite-all
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('../models/Product');

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const overwriteAll = args.includes('--overwrite-all');

  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in backend/.env');
  }

  if (!dryRun && !overwriteAll) {
    throw new Error('Chạy thật cần flag --overwrite-all. Hoặc dùng --dry-run.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected MongoDB');

  // Lấy tất cả sản phẩm theo createdAt (cũ -> mới)
  const products = await Product.find({})
    .sort({ createdAt: 1 })
    .select('_id createdAt sku')
    .lean();

  console.log(`Found ${products.length} products`);

  const prefix = 'SKU';
  const pad = 4;

  const ops = products.map((p, idx) => {
    const n = idx + 1;
    const newSku = `${prefix}${String(n).padStart(pad, '0')}`;

    // Nếu không overwrite-all thì chỉ cập nhật khi sku đang rỗng
    if (!overwriteAll && p.sku) return null;

    return {
      updateOne: {
        filter: { _id: p._id },
        update: { $set: { sku: newSku } },
      },
    };
  }).filter(Boolean);

  console.log(`Will update: ${ops.length} products`);

  if (dryRun) {
    console.log('--- DRY RUN (preview first 20) ---');
    ops.slice(0, 20).forEach(op => {
      console.log(op.updateOne.filter._id.toString(), '=>', op.updateOne.update.$set.sku);
    });
    await mongoose.disconnect();
    return;
  }

  await Product.bulkWrite(ops, { ordered: false });
  console.log('✅ Backfill product sku completed.');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌ Backfill product sku failed:', err);
  process.exit(1);
});

