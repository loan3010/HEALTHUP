/**
 * Real-time cho tài khoản khách (Socket.IO namespace riêng, JWT role=user).
 * Admin khóa tài khoản → emit `account_disabled` tới room user:<mongoId>.
 */
const jwt = require('jsonwebtoken');

/** @type {import('socket.io').Namespace | null} */
let userNamespace = null;

function jwtSecret() {
  return process.env.JWT_SECRET || 'secret_key';
}

/**
 * Gắn namespace `/user-account` (chỉ user JWT; admin dùng namespace mặc định khác).
 * @param {import('socket.io').Server} io
 */
function attachUserAccountNamespace(io) {
  const nsp = io.of('/user-account');

  nsp.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (typeof socket.handshake.query?.token === 'string' ? socket.handshake.query.token : '');
      if (!token) return next(new Error('Unauthorized'));
      const decoded = jwt.verify(token, jwtSecret());
      if (decoded.role !== 'user') return next(new Error('Forbidden'));
      socket.data.userId = String(decoded.userId);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  nsp.on('connection', (socket) => {
    const uid = socket.data.userId;
    if (uid) socket.join(`user:${uid}`);
  });

  userNamespace = nsp;
}

/**
 * Thông báo ngay cho mọi tab đang mở của khách (đã kết nối socket).
 * @param {string} userId
 * @param {{ reason: string, deactivatedBy?: string, deactivatedAt?: string }} payload
 */
function emitAccountDisabled(userId, payload) {
  if (!userNamespace || !userId) return;
  userNamespace.to(`user:${userId}`).emit('account_disabled', payload);
}

/**
 * Sau khi có thông báo DB mới — client gọi lại GET /notifications để cập nhật badge chuông.
 * @param {string} userId
 */
function emitNotificationRefresh(userId) {
  if (!userNamespace || !userId) return;
  userNamespace.to(`user:${userId}`).emit('notification_refresh', { at: Date.now() });
}

module.exports = {
  attachUserAccountNamespace,
  emitAccountDisabled,
  emitNotificationRefresh,
};
