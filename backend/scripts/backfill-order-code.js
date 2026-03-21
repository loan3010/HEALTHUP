/**
 * Backfill orderCode cho toàn bộ đơn hàng.
 *
 * Format:
 * - Prefix: ORD
 * - Pad: 11 số
 * - Ví dụ: ORD00000000001
 *
 * Gán theo createdAt tăng dần (đơn cũ -> đơn mới).
 *
 * Usage:
 *   node scripts/backfill-order-code.js --dry-run
 *   node scripts/backfill-order-code.js --overwrite-all
 */

const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Order = require('../models/Order');

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const overwriteAll = args.includes('--overwrite-all');

  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in backend/.env');
  }

  if (!dryRun && !overwriteAll) {
    throw new Error('Chạy thật cần có flag --overwrite-all. Hoặc dùng --dry-run để xem trước.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected MongoDB');

  const orders = await Order.find({})
    .sort({ createdAt: 1, _id: 1 })
    .select('_id createdAt orderCode')
    .lean();

  console.log(`Found ${orders.length} orders`);

  const prefix = 'ORD';
  const pad = 11;

  const ops = orders.map((o, idx) => {
    if (!overwriteAll && o.orderCode) return null;
    const nextCode = `${prefix}${String(idx + 1).padStart(pad, '0')}`;
    return {
      updateOne: {
        filter: { _id: o._id },
        update: { $set: { orderCode: nextCode } }
      }
    };
  }).filter(Boolean);

  console.log(`Will update: ${ops.length} orders`);

  if (dryRun) {
    console.log('--- DRY RUN (preview first 20) ---');
    ops.slice(0, 20).forEach(op => {
      console.log(op.updateOne.filter._id.toString(), '=>', op.updateOne.update.$set.orderCode);
    });
    await mongoose.disconnect();
    return;
  }

  await Order.bulkWrite(ops, { ordered: false });
  console.log('✅ Backfill orderCode completed.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌ Backfill orderCode failed:', err);
  process.exit(1);
});

