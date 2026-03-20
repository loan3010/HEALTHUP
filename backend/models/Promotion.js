const mongoose = require('mongoose');

const PromotionSchema = new mongoose.Schema({
  // Tên chương trình (Ví dụ: Miễn phí vận chuyển...)
  name: { type: String, required: true }, 
  // Mã voucher (Ví dụ: FREESHIP50)
  code: { type: String, required: true, unique: true }, 
  description: { type: String },

  // --- PHẦN MỚI: NHÓM KHUYẾN MÃI ---
  groupName: { type: String, default: "" }, // Lưu tên nhóm (Ví dụ: Chiến dịch Hè)

  // Loại đối tượng áp dụng (Mặc định là 'user')
  type: { type: String, default: 'user' }, 
  // Trạng thái: sắp diễn ra, đang diễn ra, đã kết thúc
  status: { 
    type: String, 
    enum: ['upcoming', 'ongoing', 'expired'], 
    default: 'upcoming' 
  },
  // Loại giảm giá: phần trăm (%) hoặc số tiền cụ thể
  discountType: { type: String, default: 'percent' }, 
  discountValue: { type: Number, required: true }, // Giá trị giảm
  minOrder: { type: Number, default: 0 }, // Đơn hàng tối thiểu
  maxDiscount: { type: Number, default: 0 }, // Giảm tối đa
  startDate: { type: Date, required: true }, // Ngày bắt đầu
  endDate: { type: Date, required: true }, // Ngày kết thúc
  totalLimit: { type: Number, default: 1000 }, // Tổng lượt sử dụng
  usedCount: { type: Number, default: 0 }, // Số lượt đã dùng
  userLimit: { type: Number, default: 1 }, // Giới hạn mỗi người dùng
  firstOrderOnly: { type: Boolean, default: false }, // Chỉ áp dụng đơn hàng đầu

  // --- PHẠM VI ÁP DỤNG ---
  applyScope: { 
    type: String, 
    enum: ['all', 'category', 'product'], 
    default: 'all' 
  },
  appliedCategoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  appliedProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
}, { 
  timestamps: true // Tự động tạo mốc thời gian createdAt và updatedAt
});

module.exports = mongoose.model('Promotion', PromotionSchema);