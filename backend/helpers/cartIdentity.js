/**
 * Nhận diện giỏ hàng từ header:
 * - User đăng nhập: x-user-id (ObjectId)
 * - Khách: x-guest-cart-id (UUID v4) — lưu ở localStorage phía client
 */
const mongoose = require('mongoose');

// UUID dạng RFC 4122 (v1–v5) — crypto.randomUUID() luôn v4; nới lỏng để khớp mọi UUID hợp lệ từ trình duyệt / polyfill.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidGuestCartSessionId(s) {
  return UUID_RE.test(String(s || '').trim());
}

/**
 * @returns {{ mode:'user', userId:string, guestSessionId:null } | { mode:'guest', userId:null, guestSessionId:string } | null}
 */
function parseCartRequest(req) {
  const rawUser = String(req.headers['x-user-id'] || '').trim();
  const rawGuest = String(req.headers['x-guest-cart-id'] || '').trim();

  if (mongoose.Types.ObjectId.isValid(rawUser)) {
    return { mode: 'user', userId: rawUser, guestSessionId: null };
  }
  if (isValidGuestCartSessionId(rawGuest)) {
    return { mode: 'guest', userId: null, guestSessionId: rawGuest.trim() };
  }
  return null;
}

module.exports = {
  parseCartRequest,
  isValidGuestCartSessionId,
};
