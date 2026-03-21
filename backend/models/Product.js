const mongoose = require('mongoose');

const NutritionSchema = new mongoose.Schema({
  name: String,
  value: String,
  percent: Number
});

const WeightOptionSchema = new mongoose.Schema({
  label: String,
  outOfStock: { type: Boolean, default: false }
});

// Biến thể bán hàng: mỗi phân loại có giá + tồn kho riêng.
// attr1Value / attr2Value: hai chiều phân loại (VD: hương vị + khối lượng).
// label giữ dạng "A | B" để tương thích API/cart cũ.
const VariantSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  attr1Value: { type: String, default: '', trim: true },
  attr2Value: { type: String, default: '', trim: true },
  image: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0 },
  oldPrice: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true }
}, { _id: true });

const ProductSchema = new mongoose.Schema({
  images: [String],
  name: { type: String, required: true },
  cat: { type: String, required: true },
  rating: { type: Number, default: 0 },
  starsDisplay: String,
  reviewCount: { type: Number, default: 0 },
  sold: { type: Number, default: 0 },
  // SKU dùng cho quản lý sản phẩm (backfill sẽ gán cho toàn bộ product hiện có).
  // Schema hiện tại trước đó chưa có field này nên API không trả ra được.
  sku: { type: String, default: '' },
  price: { type: Number, required: true },
  oldPrice: Number,
  saving: String,
  shortDesc: String,
  description: String,
  stock: { type: Number, default: 100 },
  variants: { type: [VariantSchema], default: [] },
  // Tên hiển thị cho 2 chiều phân loại (admin đặt tùy ý, ví dụ "Hương vị" / "Khối lượng").
  variantAttr1Name: { type: String, default: 'Phân loại 1', trim: true },
  variantAttr2Name: { type: String, default: 'Phân loại 2', trim: true },
  weights: [WeightOptionSchema],
  packagingTypes: [String],
  nutrition: [NutritionSchema],
  badge: { type: String, enum: ['new', 'hot', null] },
  sale: String,
  weight: String,
  stars: String,
  reviews: { type: Number, default: 0 },
  isHidden: { type: Boolean, default: false },
  isOutOfStock: { type: Boolean, default: false }
}, {
  timestamps: true   // tự động thêm createdAt + updatedAt
});

module.exports = mongoose.model('Product', ProductSchema);