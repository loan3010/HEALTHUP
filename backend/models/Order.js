const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    variantLabel: { type: String, default: '' },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    imageUrl: { type: String, default: null },
  },
  { _id: false }
);

// Schema cho từng sản phẩm trả
const ReturnItemSchema = new mongoose.Schema(
  {
    productId: { type: String, default: '' },
    name:      { type: String, default: '' },
    imageUrl:  { type: String, default: '' },
    price:     { type: Number, default: 0 },
    quantity:  { type: Number, default: 0 },
    returnQty: { type: Number, default: 0 },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    orderCode: { type: String, unique: true, sparse: true, index: true, trim: true },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    customer: {
      fullName: { type: String, required: true, trim: true },
      phone:    { type: String, required: true, trim: true },
      email:    { type: String, default: '', trim: true },
      address:  { type: String, required: true, trim: true },
      province: { type: String, default: '', trim: true },
      district: { type: String, default: '', trim: true },
      ward:     { type: String, default: '', trim: true },
      note:     { type: String, default: '', trim: true }
    },

    items: { type: [OrderItemSchema], required: true },

    shippingMethod: { type: String, enum: ['standard', 'express'], default: 'standard' },
    paymentMethod:  { type: String, enum: ['cod', 'momo', 'vnpay'], default: 'cod' },
    voucherCode:    { type: String, default: null },
    shipVoucherCode: { type: String, default: null },

    subTotal:           { type: Number, required: true, min: 0 },
    shippingFee:        { type: Number, required: true, min: 0 },
    discount:           { type: Number, required: true, min: 0 },
    discountOnItems:    { type: Number, default: 0 },
    discountOnShipping: { type: Number, default: 0 },
    total:              { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipping', 'delivery_failed', 'delivered', 'cancelled'],
      default: 'pending'
    },

    /**
     * Lý do hủy đơn (admin / hệ thống ghi nhận) — hiển thị cho khách ở chi tiết đơn.
     * Hủy trước khi giao: bắt buộc có khi admin hủy; khách tự hủy pending có thể là chuỗi mặc định.
     */
    cancelReason: { type: String, default: '', trim: true, maxlength: 2000 },
    
    /**
     * Nguồn hủy đơn để phân biệt rõ trên UI/admin:
     * - customer: khách tự hủy
     * - admin: quản trị viên hủy
     * - system: hệ thống tự động hủy (nếu có luồng sau này)
     * - unknown: dữ liệu cũ chưa có nguồn
     */
    cancelledByType: {
      type: String,
      enum: ['customer', 'admin', 'system', 'unknown'],
      default: 'unknown'
    },
    /** ID người thực hiện hủy (userId/adminId), nếu xác định được. */
    cancelledById: { type: String, default: '', trim: true, maxlength: 200 },

    /** Đã hoàn kho khi hủy (tránh hoàn trùng). Đơn mới: false; trừ kho lúc tạo đơn. */
    inventoryReleased: { type: Boolean, default: false },

    /**
     * Hoàn tiền online sau hủy: none → pending (chờ xử lý thủ công / cổng).
     * completed khi kế toán xác nhận (có thể cập nhật sau qua tool khác).
     */
    refundStatus: {
      type: String,
      enum: ['none', 'pending', 'completed'],
      default: 'none'
    },

    /** Lý do giao thất bại (chuỗi hiển thị cho admin & thông báo khách). */
    deliveryFailureReason: { type: String, default: '', trim: true, maxlength: 2000 },
    deliveryFailurePreset: {
      type: String,
      enum: ['', 'no_contact', 'wrong_address', 'customer_refused', 'reschedule', 'other'],
      default: ''
    },

    /** Số lần đã chọn "Giao lại" từ delivery_failed → shipping (tối đa 2). */
    redeliveryAttempts: { type: Number, default: 0, min: 0 },

    // Theo dõi quy trình trả hàng/hoàn tiền tách biệt với status giao hàng.
    // none → requested → approved | rejected | completed (trực tiếp); approved → completed.
    returnStatus: {
      type: String,
      enum: ['none', 'requested', 'approved', 'rejected', 'completed'],
      default: 'none'
    },
    returnReason: { type: String, default: '', trim: true },
    returnRejectionReason: { type: String, default: '', trim: true, maxlength: 2000 },
    returnNote:        { type: String, default: '', trim: true },
    returnRequestedAt: { type: Date, default: null },
    returnCompletedAt: { type: Date, default: null },

    returnItems: { type: [ReturnItemSchema], default: [] },

    returnImages: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', OrderSchema);