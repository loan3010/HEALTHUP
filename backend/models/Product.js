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
// attr1–attr4: tối đa 4 chiều (preset: khối lượng, đóng gói, hương vị, size).
// label dạng "A | B | C | D" (bỏ phần rỗng phía sau).
const VariantSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  attr1Value: { type: String, default: '', trim: true },
  attr2Value: { type: String, default: '', trim: true },
  attr3Value: { type: String, default: '', trim: true },
  attr4Value: { type: String, default: '', trim: true },
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
  // Tên hiển thị cho từng chiều phân loại trên shop (tối đa 4).
  variantAttr1Name: { type: String, default: 'Phân loại 1', trim: true },
  variantAttr2Name: { type: String, default: 'Phân loại 2', trim: true },
  variantAttr3Name: { type: String, default: 'Phân loại 3', trim: true },
  variantAttr4Name: { type: String, default: 'Phân loại 4', trim: true },
  /**
   * Cấu hình nhóm phân loại do admin chọn (tối đa 4 nhóm preset).
   * role: free | mass | volume — không được vừa mass vừa volume; tối đa 1 mass và 1 volume.
   */
  variantClassifications: {
    type: [{
      _id: false,
      role: { type: String, enum: ['free', 'mass', 'volume'], default: 'free' },
      name: { type: String, default: '', trim: true },
      values: { type: [String], default: [] }
    }],
    default: []
  },
  /**
   * Kiểu định lượng cho biến thể: chỉ một trong ba — không trộn g/kg với ml/l trên cùng SP.
   * - none: không ép đơn vị (vị, size chữ, loại đóng gói…)
   * - mass: biến thể theo khối lượng (g, kg)
   * - volume: biến thể theo thể tích (ml, l)
   */
  variantQuantityKind: {
    type: String,
    enum: ['none', 'mass', 'volume'],
    default: 'none'
  },
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