import { Injectable, signal } from '@angular/core';

/**
 * Trạng thái chặn toàn app khi tài khoản bị admin vô hiệu hóa (socket hoặc API 403).
 * Xóa token để mọi request sau không còn dùng phiên cũ.
 */
@Injectable({ providedIn: 'root' })
export class AccountDisabledService {
  /** true = hiện overlay che toàn trang, chặn thao tác phía sau. */
  readonly overlayVisible = signal(false);

  /** Lý do admin nhập — hiển thị cho khách. */
  readonly overlayReason = signal('');

  /** Đóng overlay (ví dụ khi đi tới trang đăng nhập). */
  dismissOverlay(): void {
    this.overlayVisible.set(false);
    this.overlayReason.set('');
  }

  /**
   * Đăng xuất khẩn cấp + bật overlay.
   * Gọi từ socket `account_disabled` hoặc HTTP interceptor khi `accountDisabled: true`.
   */
  blockSessionAndShow(reason: string): void {
    this.clearAuthStorage();
    const r = String(reason || '').trim();
    this.overlayReason.set(r || 'Tài khoản của bạn đã bị vô hiệu hóa.');
    this.overlayVisible.set(true);
  }

  private clearAuthStorage(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
  }
}
