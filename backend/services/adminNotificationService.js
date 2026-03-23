const AdminNotification = require('../models/AdminNotification');

/** Socket.io instance — gán từ server.js sau khi khởi tạo. */
let ioRef = null;

/**
 * Gắn io để broadcast tới room `admin` (mọi socket admin đã xác thực).
 */
function attachAdminIo(ioInstance) {
  ioRef = ioInstance;
}

/**
 * Chuẩn hóa object gửi JSON/socket (ObjectId → string).
 */
function serializeNotification(doc) {
  const p = doc && typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    _id: String(p._id),
    type: p.type,
    title: p.title,
    message: p.message,
    orderId: p.orderId ? String(p.orderId) : null,
    productId: p.productId ? String(p.productId) : null,
    reviewId: p.reviewId ? String(p.reviewId) : null,
    consultingId: p.consultingId ? String(p.consultingId) : null,
    isRead: !!p.isRead,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function createAndEmit(payload) {
  const row = await AdminNotification.create(payload);
  const out = serializeNotification(row);
  if (ioRef) {
    ioRef.to('admin').emit('admin_notification', { event: 'created', notification: out });
  }
  return row;
}

function customerBits(order) {
  const name = String(order?.customer?.fullName || '').trim() || 'Khách';
  const code = String(order?.orderCode || '').trim() || String(order?._id || '');
  return { name, code };
}

/** Đơn mới (checkout khách — không gọi từ hotline admin). */
async function notifyAdminOrderPlaced(order) {
  const { name, code } = customerBits(order);
  return createAndEmit({
    type: 'order_new',
    title: 'Đơn hàng mới',
    message: `${code} — ${name}`,
    orderId: order._id,
    isRead: false,
  });
}

/** Khách / API user hủy đơn (PATCH /orders/:id/status → cancelled). */
async function notifyAdminOrderCancelled(order) {
  const { name, code } = customerBits(order);
  return createAndEmit({
    type: 'order_cancelled',
    title: 'Đơn đã hủy',
    message: `${code} — ${name}`,
    orderId: order._id,
    isRead: false,
  });
}

/** Sau khi user hoặc khách gửi yêu cầu hoàn/trả. */
async function notifyAdminReturnRequested(order) {
  const { name, code } = customerBits(order);
  return createAndEmit({
    type: 'return_requested',
    title: 'Yêu cầu hoàn/trả hàng',
    message: `${code} — ${name}`,
    orderId: order._id,
    isRead: false,
  });
}

/** Đánh giá sản phẩm mới (có thể khá nhiều — vẫn tạo từng dòng theo yêu cầu). */
async function notifyAdminReviewNew(reviewDoc, productName) {
  const reviewer = String(reviewDoc.name || '').trim() || 'Khách';
  const pname = String(productName || '').trim() || 'Sản phẩm';
  const stars = Number(reviewDoc.rating || 0);
  return createAndEmit({
    type: 'review_new',
    title: 'Đánh giá mới',
    message: `${pname} — ${reviewer} (${stars}★)`,
    productId: String(reviewDoc.productId || ''),
    reviewId: reviewDoc._id,
    isRead: false,
  });
}

/** Khách gửi câu hỏi tư vấn sản phẩm — chờ admin trả lời. */
async function notifyAdminConsultingPending(consultingDoc, productName) {
  const customer = String(consultingDoc.user || '').trim() || 'Khách';
  const pname = String(productName || '').trim() || 'Sản phẩm';
  const raw = String(consultingDoc.content || '').trim();
  const preview = raw.length > 90 ? `${raw.slice(0, 90)}…` : raw;
  return createAndEmit({
    type: 'consulting_pending',
    title: 'Câu hỏi tư vấn chờ trả lời',
    message: `${pname} — ${customer}: ${preview || '(Không có nội dung)'}`,
    productId: String(consultingDoc.productId || ''),
    consultingId: consultingDoc._id,
    isRead: false,
  });
}

module.exports = {
  attachAdminIo,
  serializeNotification,
  notifyAdminOrderPlaced,
  notifyAdminOrderCancelled,
  notifyAdminReturnRequested,
  notifyAdminReviewNew,
  notifyAdminConsultingPending,
};
