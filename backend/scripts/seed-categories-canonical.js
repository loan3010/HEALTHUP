/**
 * Xóa toàn bộ document trong collection categories và seed 6 danh mục gốc HEALTHUP.
 * Chạy: node backend/scripts/seed-categories-canonical.js
 * (từ thư mục repo hoặc cd backend)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthup';

const CANONICAL = [
  { name: 'Hạt dinh dưỡng', slug: 'hat-dinh-duong', order: 1 },
  { name: 'Granola', slug: 'granola', order: 2 },
  { name: 'Trái cây sấy', slug: 'trai-cay-say', order: 3 },
  { name: 'Đồ ăn vặt', slug: 'do-an-vat', order: 4 },
  { name: 'Trà thảo mộc', slug: 'tra-thao-moc', order: 5 },
  { name: 'Combo', slug: 'combo', order: 6 },
];

async function main() {
  const Category = require(path.join(__dirname, '../models/Categories'));
  await mongoose.connect(MONGODB_URI);
  console.log('Connected:', MONGODB_URI);

  const del = await Category.deleteMany({});
  console.log('Deleted categories:', del.deletedCount);

  const docs = CANONICAL.map((c) => ({
    ...c,
    description: '',
    isActive: true,
    deactivatedAt: null,
    productCount: 0,
    subcategories: [],
  }));

  await Category.insertMany(docs);
  console.log('Inserted', docs.length, 'canonical categories.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
