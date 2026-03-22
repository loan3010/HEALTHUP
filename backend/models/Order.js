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
      // Khách checkout một ô địa chỉ đầy đủ có thể không tách tỉnh/huyện/xã — lưu rỗng, chi tiết nằm ở address.
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
      enum: ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'],
      default: 'pending'
    },

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