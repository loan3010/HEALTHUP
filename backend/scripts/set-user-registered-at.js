/**
 * Gán lại User.registeredAt cho một user (sửa tay sau khi backfill sai / nghiệp vụ rõ).
 *
 * Ví dụ — lấy theo createdAt của chính user (mốc tạo bản ghi):
 *   node scripts/set-user-registered-at.js --username "Xuân Meo" --from createdAt
 *
 * Hoặc ngày cụ thể (ISO):
 *   node scripts/set-user-registered-at.js --username "Xuân Meo" --iso 2026-03-21T06:40:09.802Z
 *
 * --dry-run chỉ in, không ghi.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthup';

function parseArgs() {
  const a = process.argv.slice(2);
  const out = { dry: false, username: '', iso: '', from: '' };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--dry-run') out.dry = true;
    else if (a[i] === '--username' && a[i + 1]) out.username = a[++i];
    else if (a[i] === '--iso' && a[i + 1]) out.iso = a[++i];
    else if (a[i] === '--from' && a[i + 1]) out.from = a[++i];
  }
  return out;
}

async function main() {
  const { dry, username, iso, from } = parseArgs();
  if (!username.trim()) {
    console.error('Thiếu --username "Tên đăng nhập"');
    process.exit(1);
  }
  if (!iso && !from) {
    console.error('Cần --iso <ISO date> hoặc --from createdAt');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  const u = await User.findOne({ username: username.trim() });
  if (!u) {
    console.error('Không tìm thấy user:', username);
    await mongoose.disconnect();
    process.exit(1);
  }

  let next;
  if (iso) {
    next = new Date(iso);
    if (Number.isNaN(next.getTime())) {
      console.error('ISO không hợp lệ:', iso);
      await mongoose.disconnect();
      process.exit(1);
    }
  } else if (from === 'createdAt') {
    next = u.createdAt;
  } else {
    console.error('--from chỉ hỗ trợ: createdAt');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('User:', u.username, 'id:', String(u._id));
  console.log('registeredAt hiện tại:', u.registeredAt);
  console.log('registeredAt mới:', next.toISOString());

  if (dry) {
    console.log('[dry-run] Không ghi DB.');
  } else {
    await User.updateOne({ _id: u._id }, { $set: { registeredAt: next } });
    console.log('Đã cập nhật.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
