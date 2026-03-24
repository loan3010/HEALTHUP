const crypto = require('crypto');
const GuestCheckoutOtp = require('../models/GuestCheckoutOtp');
const { sendGuestOtpSms } = require('../services/smsService');
const { assertPhoneEligibleForGuestCheckout } = require('./guestUser');

/** Khoảng cách tối thiểu giữa hai lần gửi OTP cùng SĐT */
const COOLDOWN_MS = 55 * 1000;
/** OTP hết hạn sau */
const OTP_TTL_MS = 10 * 60 * 1000;
/** Khóa OTP sau quá nhiều lần nhập sai */
const MAX_VERIFY_ATTEMPTS = 7;

function normalizePhone(p) {
  return String(p || '').trim();
}

function hashOtp(phone, code) {
  const pepper =
    process.env.OTP_PEPPER || 'healthup_otp_dev_doi_trong_production';
  return crypto.createHmac('sha256', pepper).update(`${phone}|${code}`).digest('hex');
}

/**
 * Gửi OTP mới qua SMS, ghi DB (ghi đè bản ghi cùng SĐT).
 * @returns {{ ok: true, message, devPlainOtp? } | { ok: false, status?, message }}
 */
async function requestGuestCheckoutOtp(phoneRaw) {
  const phone = normalizePhone(phoneRaw);
  if (!/^0\d{9}$/.test(phone)) {
    return { ok: false, status: 400, message: 'Số điện thoại không hợp lệ (10 số, bắt đầu 0).' };
  }

  // Chặn trước khi gửi SMS: SĐT đã là tài khoản member → báo ngay, không tốn OTP.
  const eligible = await assertPhoneEligibleForGuestCheckout(phone);
  if (!eligible.ok) {
    return { ok: false, status: 400, message: eligible.message };
  }

  const now = Date.now();
  const existing = await GuestCheckoutOtp.findOne({ phone });
  if (
    existing &&
    existing.lastSentAt &&
    now - existing.lastSentAt.getTime() < COOLDOWN_MS
  ) {
    const waitSec = Math.ceil(
      (COOLDOWN_MS - (now - existing.lastSentAt.getTime())) / 1000
    );
    return {
      ok: false,
      status: 429,
      message: `Vui lòng đợi ${waitSec}s trước khi gửi lại mã.`,
    };
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = hashOtp(phone, code);
  const expiresAt = new Date(now + OTP_TTL_MS);

  await GuestCheckoutOtp.findOneAndUpdate(
    { phone },
    {
      $set: {
        codeHash,
        expiresAt,
        verifyAttempts: 0,
        lastSentAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  const sms = await sendGuestOtpSms(phone, code);
  if (!sms.ok) {
    await GuestCheckoutOtp.deleteOne({ phone });
    return {
      ok: false,
      status: 500,
      message: sms.message || 'Không gửi được SMS. Thử lại sau.',
    };
  }

  const out = { ok: true, message: 'Đã gửi mã OTP tới số điện thoại của bạn.' };

  /**
   * Trả mã plaintext trong JSON → mockup trên web hiện đúng 6 số để test.
   * - SMS_PROVIDER=console (mặc định): không gửi SMS thật → luôn trả devPlainOtp.
   * - esms/webhook: không trả — khách chỉ xem mã trong điện thoại.
   * - SMS_DEBUG_RETURN_OTP=true: bật trả mã kể cả khi cần debug gateway.
   */
  const provider = String(process.env.SMS_PROVIDER || 'console').toLowerCase();
  const debugOtp =
    String(process.env.SMS_DEBUG_RETURN_OTP || '').toLowerCase() === 'true';
  if (debugOtp || provider === 'console') {
    out.devPlainOtp = code;
  }
  return out;
}

/**
 * Kiểm tra OTP một lần — đúng thì xóa bản ghi (không dùng lại).
 * @returns {{ ok: true } | { ok: false, message }}
 */
async function consumeGuestCheckoutOtp(phoneRaw, plainCode) {
  const phone = normalizePhone(phoneRaw);
  const code = String(plainCode || '').replace(/\D/g, '');

  if (!/^0\d{9}$/.test(phone)) {
    return { ok: false, message: 'Số điện thoại không hợp lệ.' };
  }
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, message: 'Mã OTP phải gồm 6 chữ số.' };
  }

  const doc = await GuestCheckoutOtp.findOne({ phone });
  if (!doc) {
    return { ok: false, message: 'Chưa có mã OTP. Vui lòng bấm «Gửi mã OTP».' };
  }
  if (doc.expiresAt.getTime() < Date.now()) {
    await GuestCheckoutOtp.deleteOne({ _id: doc._id });
    return { ok: false, message: 'Mã OTP đã hết hạn. Vui lòng gửi lại.' };
  }
  if (doc.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
    await GuestCheckoutOtp.deleteOne({ _id: doc._id });
    return {
      ok: false,
      message: 'Nhập sai quá nhiều lần. Vui lòng gửi mã mới.',
    };
  }

  if (hashOtp(phone, code) !== doc.codeHash) {
    await GuestCheckoutOtp.updateOne(
      { _id: doc._id },
      { $inc: { verifyAttempts: 1 } }
    );
    return { ok: false, message: 'Mã OTP không đúng.' };
  }

  await GuestCheckoutOtp.deleteOne({ _id: doc._id });
  return { ok: true };
}

module.exports = {
  requestGuestCheckoutOtp,
  consumeGuestCheckoutOtp,
  normalizeGuestCheckoutPhone: normalizePhone,
};
