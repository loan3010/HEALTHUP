const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },     // snapshot tên lúc mua
    price: { type: Number, required: true },    // snapshot giá lúc mua
    quantity: { type: Number, required: true, min: 1 },
    imageUrl: { type: String, default: null },  // snapshot ảnh
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    customer: {
      fullName: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      email: { type: String, default: '', trim: true },
      address: { type: String, required: true, trim: true },
      province: { type: String, required: true },
      district: { type: String, required: true },
      ward: { type: String, required: true },
      note: { type: String, default: '', trim: true }
    },

    items: { type: [OrderItemSchema], required: true },

    shippingMethod: { type: String, enum: ['standard', 'express'], default: 'standard' },
    paymentMethod: { type: String, enum: ['cod', 'momo', 'vnpay'], default: 'cod' },
    voucherCode: { type: String, default: null },

    subTotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ['pending', 'pending_payment', 'paid', 'cancelled'],
      default: 'pending'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', OrderSchema);