const mongoose = require('mongoose');



const CategorySchema = new mongoose.Schema({

  // Tên danh mục (Ví dụ: Trái cây sấy) [cite: 2025-12-21]

  name: { type: String, required: true },

  // Đường dẫn thân thiện (Ví dụ: trai-cay-say) [cite: 2025-12-21]

  slug: { type: String, required: true },

  // Mô tả chi tiết về danh mục [cite: 2025-12-21]

  description: { type: String },

  // Thứ tự hiển thị [cite: 2025-12-21]

  order: { type: Number, default: 0 },

  // Trạng thái hoạt động — false = vô hiệu hóa (user site không thấy trong danh sách DM).
  isActive: { type: Boolean, default: true },

  /** Ghi nhận thời điểm vô hiệu hóa (tuỳ chọn, phục vụ audit). */
  deactivatedAt: { type: Date, default: null },

  // Số lượng sản phẩm trong danh mục [cite: 2025-12-21]

  productCount: { type: Number, default: 0 },

  // Danh sách các danh mục con (nếu có) [cite: 2025-12-21]

  subcategories: [

    {

      name: { type: String },

      slug: { type: String }

    }

  ]

}, {

  timestamps: true // Tự động tạo createdAt và updatedAt

});

// Một slug / một tên — chuẩn hóa quản lý danh mục.
CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Category', CategorySchema);