const mongoose = require('mongoose');

const PromotionSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  code:        { type: String, required: true, unique: true },
  description: { type: String },
  groupName:   { type: String, default: '' },

  // Nhóm khuyến mãi (Ví dụ: Chiến dịch Hè)
  groupName: { type: String, default: '' },

  // TRẠNG THÁI KÍCH HOẠT (Mới thêm: Dùng để ẩn/hiện bên Client)
  isActive: { type: Boolean, default: true },

  // Loại khuyến mãi:
  //   'order'    = mã giảm tiền hàng
  //   'shipping' = mã giảm phí vận chuyển
  type: {
    type: String,
    enum: ['order', 'freeship'],
    default: 'order'
  },

  // Trạng thái tự động theo thời gian
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'expired'],
    default: 'upcoming'
  },

  discountType: {
    type: String,
    enum: ['percent', 'fixed'],
    default: 'percent'
  },

  discountValue: { type: Number, required: true, default: 0 },
  minOrder:      { type: Number, default: 0 },
  maxDiscount:   { type: Number, default: 0 },

  startDate: { type: Date, required: true },
  endDate:   { type: Date, required: true },

  totalLimit: { type: Number, default: 1000 },
  usedCount:  { type: Number, default: 0 },
  userLimit:  { type: Number, default: 1 },

  firstOrderOnly: { type: Boolean, default: false },

  applyScope: {
    type: String,
    enum: ['all', 'category', 'product'],
    default: 'all'
  },

  appliedCategoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  appliedProductIds:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

  // Hạng thành viên được phép dùng mã (mảng rỗng = tất cả mọi hạng)
  allowedMemberRanks: {
    type: [String],
    enum: ['member', 'vip'],
    default: []
  },

}, {
  timestamps: true
});

module.exports = mongoose.model('Promotion', PromotionSchema);