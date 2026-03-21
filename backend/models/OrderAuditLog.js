const mongoose = require('mongoose');

const OrderAuditLogSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    adminId: { type: String, required: true, trim: true },
    action: {
      type: String,
      enum: ['status_change', 'return_status_change'],
      required: true
    },
    fromValue: { type: String, default: '' },
    toValue: { type: String, default: '' },
    note: { type: String, default: '', trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('OrderAuditLog', OrderAuditLogSchema);
