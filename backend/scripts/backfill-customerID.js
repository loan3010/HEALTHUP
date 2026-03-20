/**
 * Backfill customerID cho toàn bộ user có role = 'user'
 *
 * Theo yêu cầu:
 * - Prefix: KH
 * - Format: KH0001, KH0002...
 * - Dãy số gán theo createdAt tăng dần (cũ -> mới)
 * - Overwrite-all: ghi đè toàn bộ customerID để đảm bảo hiển thị đồng nhất
 *
 * Usage:
 *   node scripts/backfill-customerID.js --dry-run
 *   node scripts/backfill-customerID.js --overwrite-all
 */

const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

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

  // Lấy toàn bộ user khách theo createdAt tăng dần để gán mã theo đúng thứ tự.
  const users = await User.find({ role: 'user' })
    .sort({ createdAt: 1 })
    .select('_id createdAt customerID')
    .lean();

  console.log(`Found ${users.length} users (role=user)`);

  const prefix = 'KH';
  const pad = 4;

  // Tạo danh sách bulk ops.
  // Lưu ý: vì chúng ta chỉ tạo dãy mã duy nhất KH0001..KHxxxx,
  // nên sẽ không bị trùng lẫn trong cùng batch.
  const ops = users.map((u, idx) => {
    const n = idx + 1;
    const newCustomerID = `${prefix}${String(n).padStart(pad, '0')}`;

    // Nếu không overwrite-all thì chỉ cập nhật khi customerID đang trống.
    if (!overwriteAll && u.customerID) return null;

    return {
      updateOne: {
        filter: { _id: u._id },
        update: { $set: { customerID: newCustomerID } },
      },
    };
  }).filter(Boolean);

  console.log(`Will update: ${ops.length} users`);

  if (dryRun) {
    console.log('--- DRY RUN (preview first 20) ---');
    ops.slice(0, 20).forEach(op => {
      console.log(op.updateOne.filter._id.toString(), '=>', op.updateOne.update.$set.customerID);
    });
    await mongoose.disconnect();
    return;
  }

  // ordered: false để tăng tốc; nếu 1 update lỗi nhỏ vẫn không chặn cả batch.
  // (Tính duy nhất của KH0001..KHxxxx đảm bảo sẽ không đụng trùng trong batch.)
  await User.bulkWrite(ops, { ordered: false });

  console.log('✅ Backfill customerID completed.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});

