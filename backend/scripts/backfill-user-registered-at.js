/**
 * Backfill User.registeredAt cho dữ liệu cũ (trước khi có field).
 *
 * Logic (mặc định):
 * - Bỏ qua role === 'guest' (chưa đăng ký thật).
 * - Bỏ qua bản ghi đã có registeredAt (không ghi đè).
 * - Nếu createdAt ≈ updatedAt (cùng lúc tạo): coi là đăng ký trực tiếp → registeredAt = createdAt.
 * - Nếu updatedAt sau createdAt trong khoảng tối đa N ngày (mặc định 120): coi là nâng cấp guest→user
 *   hoặc chỉnh sửa sớm → registeredAt = updatedAt (khớp ngày “đăng ký” sau khi có guest).
 * - Khoảng cách quá lớn: registeredAt = createdAt (tránh gán nhầm lần sửa hồ sơ muộn).
 *
 * Chạy:
 *   node scripts/backfill-user-registered-at.js
 *   node scripts/backfill-user-registered-at.js --dry-run
 *   node scripts/backfill-user-registered-at.js --simple   (chỉ copy createdAt)
 *   BACKFILL_MAX_DAYS=365 node scripts/backfill-user-registered-at.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthup';
const ONE_MIN_MS = 60 * 1000;
const MAX_DAYS = Math.max(1, parseInt(process.env.BACKFILL_MAX_DAYS || '120', 10));
const MAX_MS = MAX_DAYS * 24 * 60 * 60 * 1000;

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const SIMPLE = args.has('--simple');

function inferRegisteredAt(doc) {
  const c = doc.createdAt ? new Date(doc.createdAt).getTime() : 0;
  const u = doc.updatedAt ? new Date(doc.updatedAt).getTime() : c;
  const delta = u - c;

  if (SIMPLE || !c) {
    return doc.createdAt || doc.updatedAt || new Date();
  }

  if (delta <= ONE_MIN_MS) {
    return new Date(c);
  }
  if (delta > 0 && delta <= MAX_MS) {
    return new Date(u);
  }
  return new Date(c);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected:', MONGODB_URI.replace(/\/\/.*@/, '//***@'));

  const filter = {
    role: { $in: ['user', 'admin'] },
    $or: [{ registeredAt: { $exists: false } }, { registeredAt: null }],
  };

  const cursor = User.find(filter).select('createdAt updatedAt role registeredAt username').cursor();
  let updated = 0;

  for await (const doc of cursor) {
    const registeredAt = inferRegisteredAt(doc);
    if (DRY) {
      console.log(
        `[dry-run] ${doc._id} ${doc.username || ''} role=${doc.role} → registeredAt=${registeredAt.toISOString()}`
      );
      updated++;
      continue;
    }

    await User.updateOne({ _id: doc._id }, { $set: { registeredAt } });
    updated++;
  }

  console.log(DRY ? `Dry-run rows: ${updated}` : `Updated: ${updated}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
