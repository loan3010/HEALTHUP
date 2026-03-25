/**
 * Liên hệ cửa hàng (Zalo) — một nguồn cho chatbot nổi và nút «Liên hệ người bán».
 * Đổi SĐT tại đây khi đổi Zalo chính thức.
 */
export const STORE_ZALO_PHONE = '0123456789';

/** URL mở chat Zalo theo số (chỉ chữ số trong path). */
export function buildZaloMeUrl(phoneRaw: string): string {
  const phone = String(phoneRaw || '').replace(/\D/g, '');
  return phone ? `https://zalo.me/${phone}` : '#';
}
