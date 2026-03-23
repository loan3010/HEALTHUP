const mongoose = require('mongoose');

const PromotionSchema = new mongoose.Schema({
  // Tên chương trình (Ví dụ: Miễn phí vận chuyển...)
  name: { type: String, required: true },

  // Mã voucher (Ví dụ: FREESHIP50)
  code: { type: String, required: true, unique: true },

  // Mô tả chi tiết
  description: { type: String },

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

  // Loại giảm giá:
  //   'percent'  = giảm theo phần trăm
  //   'fixed'    = giảm số tiền cố định
  //   'freeship' = miễn toàn bộ phí ship (chỉ dùng khi type = 'shipping')
  discountType: {
    type: String,
    enum: ['percent', 'fixed'],
    default: 'percent'
  },

  // Giá trị giảm (số %, số tiền, hoặc 0 nếu là freeship)
  discountValue: { type: Number, required: true, default: 0 },

  // Giá trị đơn hàng tối thiểu để áp dụng mã
  minOrder: { type: Number, default: 0 },

  // Giảm tối đa (áp dụng khi discountType = 'percent', 0 = không giới hạn)
  maxDiscount: { type: Number, default: 0 },

  // Thời gian hiệu lực
  startDate: { type: Date, required: true },
  endDate:   { type: Date, required: true },

  // Giới hạn sử dụng
  totalLimit: { type: Number, default: 1000 }, // Tổng lượt toàn hệ thống
  usedCount:  { type: Number, default: 0 },    // Số lượt đã dùng
  userLimit:  { type: Number, default: 1 },    // Giới hạn mỗi người dùng

  // Chỉ áp dụng cho đơn hàng đầu tiên của khách
  firstOrderOnly: { type: Boolean, default: false },

  // Phạm vi áp dụng:
  //   'all'      = Toàn bộ cửa hàng
  //   'category' = Danh mục sản phẩm cụ thể
  //   'product'  = Sản phẩm cụ thể
  applyScope: {
    type: String,
    enum: ['all', 'category', 'product'],
    default: 'all'
  },

  // Danh sách danh mục áp dụng (dùng khi applyScope = 'category')
  appliedCategoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],

  // Danh sách sản phẩm áp dụng (dùng khi applyScope = 'product')
  appliedProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]

}, {
  timestamps: true // Tự động tạo createdAt và updatedAt
});

module.exports = mongoose.model('Promotion', PromotionSchema);