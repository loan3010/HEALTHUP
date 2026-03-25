/**
 * Tài khoản khách (role: guest) — gắn SĐT khi đặt hàng không đăng nhập.
 * Đăng ký sau có thể nâng cấp cùng document (xem routes/auth register).
 */
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');

/** Chuẩn hóa SĐT VN về dạng 0xxxxxxxxx (10 số) để find/create khớp DB. */
function normalizePhoneVN(phoneRaw) {
  let s = String(phoneRaw || '').trim().replace(/\s+/g, '');
  if (s.startsWith('+84')) s = '0' + s.slice(3);
  else if (/^84\d{9}$/.test(s)) s = '0' + s.slice(2);
  return s;
}

function isValidPhoneVN(phone) {
  return /^0\d{9}$/.test(String(phone || '').trim());
}

/**
 * Các biến thể phone có thể có trong DB (dữ liệu cũ thiếu số 0 đầu).
 */
function phoneLookupVariants(phone) {
  const p = String(phone || '').trim();
  const digits = p.replace(/\D/g, '');
  const set = new Set([p]);
  if (/^0\d{9}$/.test(p)) {
    set.add(digits.slice(1));
  }
  if (digits.length === 9 && /^\d{9}$/.test(digits)) {
    set.add(`0${digits}`);
  }
  return [...set];
}

/**
 * Tìm user theo SĐT (chuẩn + vài dạng legacy).
 */
async function findUserByPhoneFlexible(phoneNormalized) {
  const variants = phoneLookupVariants(phoneNormalized);
  return User.findOne({ phone: { $in: variants } });
}

/**
 * Username guest luôn unique — tránh trùng với user đã có username dạng guest_09...
 * (trước đây dùng guest_<số> dễ đụng index username khi phone trong DB khác định dạng).
 */
function newGuestUsername() {
  return `guest_${new mongoose.Types.ObjectId().toString()}`;
}

/**
 * Kiểm tra SĐT có được đặt hàng kiểu khách (OTP) hay không.
 * Member (role user) → chặn ngay, không gửi SMS / không mở modal OTP.
 */
async function assertPhoneEligibleForGuestCheckout(phoneRaw) {
  const phone = normalizePhoneVN(phoneRaw);
  if (!isValidPhoneVN(phone)) {
    return {
      ok: false,
      message: 'Số điện thoại không hợp lệ (10 số, bắt đầu 0).',
    };
  }

  const existing = await findUserByPhoneFlexible(phone);
  if (!existing) {
    return { ok: true };
  }
  if (existing.role === 'guest') {
    return { ok: true };
  }
  if (existing.role === 'user') {
    return {
      ok: false,
      message:
        'Số điện thoại đã có tài khoản. Vui lòng đăng nhập để đặt hàng và dùng mã khuyến mãi.',
    };
  }
  return { ok: false, message: 'Không thể đặt hàng với số điện thoại này.' };
}

/**
 * Tìm guest theo SĐT hoặc tạo mới. Từ chối nếu SĐT đã thuộc tài khoản user thật.
 */
async function findOrCreateGuestUser(phoneRaw, _fullName, emailRaw) {
  const phone = normalizePhoneVN(phoneRaw);
  if (!isValidPhoneVN(phone)) {
    return { ok: false, message: 'Số điện thoại không hợp lệ' };
  }

  const existing = await findUserByPhoneFlexible(phone);
  if (existing) {
    if (existing.role === 'guest') {
      return { ok: true, userId: existing._id };
    }
    if (existing.role === 'user') {
      return {
        ok: false,
        message:
          'Số điện thoại đã có tài khoản. Vui lòng đăng nhập để đặt hàng và dùng mã khuyến mãi.',
      };
    }
    return { ok: false, message: 'Không thể tạo đơn với số điện thoại này.' };
  }

  const passwordHash = await bcrypt.hash(`guest_${Date.now()}_${Math.random()}`, 10);
  const emailVal =
    emailRaw && String(emailRaw).trim()
      ? String(emailRaw).trim().toLowerCase()
      : undefined;

  const username = newGuestUsername();

  try {
    const guest = await User.create({
      username,
      phone,
      email: emailVal,
      passwordHash,
      role: 'guest',
    });
    return { ok: true, userId: guest._id };
  } catch (err) {
    if (err.code === 11000) {
      const kv = err.keyValue || {};
      const or = [{ phone }, { username }];
      if (kv.phone !== undefined && kv.phone !== null) {
        or.push({ phone: kv.phone });
        phoneLookupVariants(normalizePhoneVN(String(kv.phone))).forEach((v) => {
          if (v !== kv.phone) or.push({ phone: v });
        });
      }
      if (kv.username) or.push({ username: kv.username });

      const retry = await User.findOne({ $or: or });
      if (retry) {
        if (retry.role === 'guest') {
          return { ok: true, userId: retry._id };
        }
        if (retry.role === 'user') {
          return {
            ok: false,
            message:
              'Số điện thoại đã có tài khoản. Vui lòng đăng nhập để đặt hàng và dùng mã khuyến mãi.',
          };
        }
      }

      const key = err.keyPattern ? Object.keys(err.keyPattern).join(', ') : '';
      if (key.includes('customerID')) {
        return {
          ok: false,
          message:
            'Lỗi cấu hình index tài khoản (customerID). Khởi động lại server hoặc liên hệ quản trị để chạy syncIndexes.',
        };
      }
      return {
        ok: false,
        message: key.includes('email')
          ? 'Email này đã gắn với tài khoản khác. Bỏ email hoặc đăng nhập.'
          : 'Không tạo được tài khoản khách (trùng dữ liệu). Thử lại sau vài giây hoặc đăng nhập.',
      };
    }
    throw err;
  }
}

module.exports = {
  findOrCreateGuestUser,
  assertPhoneEligibleForGuestCheckout,
  isValidPhoneVN,
  normalizePhoneVN,
  findUserByPhoneFlexible,
};
