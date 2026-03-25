/**
 * Gửi SMS — tách lớp để sau này cắm ESMS / webhook / nhà cung cấp khác.
 *
 * Biến môi trường:
 * - SMS_PROVIDER: console | webhook | esms (mặc định console — chỉ log server)
 * - SMS_WEBHOOK_URL: POST JSON { phone, message } khi provider=webhook
 * - ESMS_API_KEY, ESMS_SECRET_KEY, ESMS_BRANDNAME: khi dùng esms
 * - SMS_OTP_PREFIX: tiền tố brand trong nội dung (mặc định HealthUp)
 * - SMS_HOTLINE: hiển thị trong tin nhắn mã tra cứu
 */

async function sendSms(phone, message) {
  const provider = String(process.env.SMS_PROVIDER || 'console').toLowerCase().trim();
  try {
    if (provider === 'console') {
      console.log(`\n========== SMS → ${phone} ==========\n${message}\n====================================\n`);
      return { ok: true };
    }

    if (provider === 'webhook') {
      const url = process.env.SMS_WEBHOOK_URL;
      if (!url) {
        console.warn('[SMS] SMS_WEBHOOK_URL chưa cấu hình, fallback console');
        console.log(`[SMS] ${phone} ${message}`);
        return { ok: true };
      }
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message }),
      });
      if (!r.ok) {
        return { ok: false, message: `Webhook trả lỗi HTTP ${r.status}` };
      }
      return { ok: true };
    }

    if (provider === 'esms') {
      return await sendViaEsms(phone, message);
    }

    console.warn('[SMS] SMS_PROVIDER không rõ, dùng console:', provider);
    console.log(`[SMS] ${phone} ${message}`);
    return { ok: true };
  } catch (e) {
    console.error('[SMS]', e);
    return { ok: false, message: e?.message || 'Gửi SMS thất bại' };
  }
}

/**
 * ESMS.VN — kiểm tra tài liệu nhà cung cấp nếu CodeResult khác kỳ vọng.
 */
async function sendViaEsms(phone, message) {
  const ApiKey = process.env.ESMS_API_KEY;
  const SecretKey = process.env.ESMS_SECRET_KEY;
  const Brandname = String(process.env.ESMS_BRANDNAME || '').trim();
  if (!ApiKey || !SecretKey) {
    console.warn('[SMS ESMS] Thiếu ESMS_API_KEY / ESMS_SECRET_KEY — log nội dung');
    console.log(`[SMS] ${phone} ${message}`);
    return { ok: true };
  }

  const body = {
    ApiKey,
    SecretKey,
    Phone: phone,
    Content: message,
    SmsType: '2',
    Brandname: Brandname || undefined,
  };

  const url =
    process.env.ESMS_API_URL ||
    'https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));

  const code = String(data?.CodeResult ?? data?.Code ?? '');
  const errMsg = data?.ErrorMessage != null ? String(data.ErrorMessage) : '';
  const sendOk =
    data?.SendStatus === 1 || code === '100' || (res.ok && !errMsg && data !== null);

  if (!sendOk && errMsg) {
    return { ok: false, message: errMsg };
  }
  if (!res.ok) {
    return { ok: false, message: `ESMS HTTP ${res.status}` };
  }
  return { ok: true };
}

function brandPrefix() {
  return String(process.env.SMS_OTP_PREFIX || 'HealthUp').trim() || 'HealthUp';
}

async function sendGuestOtpSms(phone, code) {
  const msg = `${brandPrefix()}: Mã xác nhận đặt hàng của bạn là ${code}. Hiệu lực 10 phút. Không chia sẻ mã cho người khác.`;
  return sendSms(phone, msg);
}

async function sendOrderLookupSms(phone, guestLookupCode, lookupPageUrl) {
  const hotline = String(process.env.SMS_HOTLINE || '0335 512 275').trim();
  const msg = `${brandPrefix()}: Đơn hàng ${guestLookupCode} đã tạo. Tra cứu: ${lookupPageUrl}. Hỗ trợ: ${hotline}`;
  return sendSms(phone, msg);
}

/**
 * Hotline + đơn đã gắn tài khoản — hướng khách vào trang đơn hàng (đăng nhập), không dùng mã HU làm kênh chính.
 */
async function sendMemberOrderTrackSms(phone, orderCode, ordersPageUrl) {
  const hotline = String(process.env.SMS_HOTLINE || '0335 512 275').trim();
  const msg = `${brandPrefix()}: Đơn ${orderCode} đã tạo. Đăng nhập vào website và mở «Đơn hàng của tôi» để theo dõi: ${ordersPageUrl}. Hỗ trợ: ${hotline}`;
  return sendSms(phone, msg);
}

module.exports = {
  sendSms,
  sendGuestOtpSms,
  sendOrderLookupSms,
  sendMemberOrderTrackSms,
};
