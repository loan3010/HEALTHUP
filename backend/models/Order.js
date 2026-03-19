const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name:      { type: String, required: true },
    price:     { type: Number, required: true },
    quantity:  { type: Number, required: true, min: 1 },
    imageUrl:  { type: String, default: null },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    // ✅ Gắn user nếu đã đăng nhập (null nếu guest)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },

    customer: {
      fullName: { type: String, required: true, trim: true },
      phone:    { type: String, required: true, trim: true },
      email:    { type: String, default: '', trim: true },
      address:  { type: String, required: true, trim: true },
      province: { type: String, required: true },
      district: { type: String, required: true },
      ward:     { type: String, required: true },
      note:     { type: String, default: '', trim: true }
    },

    items: { type: [OrderItemSchema], required: true },

    shippingMethod: { type: String, enum: ['standard', 'express'], default: 'standard' },
    paymentMethod:  { type: String, enum: ['cod', 'momo', 'vnpay'], default: 'cod' },
    voucherCode:    { type: String, default: null },

    subTotal:    { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, required: true, min: 0 },
    discount:    { type: Number, required: true, min: 0 },
    total:       { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'],
      default: 'pending'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', OrderSchema);