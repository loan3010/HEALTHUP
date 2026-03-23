import { Injectable, inject, NgZone, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { AccountDisabledService } from './account-disabled.service';
import { ApiService } from '../services/api.service';

/**
 * Kết nối Socket.IO namespace `/user-account` khi đã đăng nhập (role=user).
 * Admin bấm vô hiệu hóa → server emit `account_disabled` → overlay ngay.
 * Nếu socket lỗi: poll nhẹ GET /api/users/:id (middleware trả 403 nếu đã khóa).
 * `notification_refresh`: admin trả lời tư vấn → cập nhật badge chuông.
 */
@Injectable({ providedIn: 'root' })
export class UserAccountRealtimeService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly accountDisabled = inject(AccountDisabledService);
  private readonly apiSvc = inject(ApiService);
  private readonly zone = inject(NgZone);

  private socket: Socket | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  private readonly apiBase = 'http://localhost:3000/api';
  private readonly socketUrl = 'http://localhost:3000/user-account';

  constructor() {
    this.connectIfLoggedIn();
  }

  ngOnDestroy(): void {
    this.disconnectSocket();
    this.stopPoll();
  }

  /** Gọi sau khi đăng nhập (cùng tab, không reload) nếu sau này bỏ window.location.reload. */
  reconnect(): void {
    this.disconnectSocket();
    this.stopPoll();
    this.connectIfLoggedIn();
  }

  private connectIfLoggedIn(): void {
    const token = localStorage.getItem('token');
    const rawUser = localStorage.getItem('user');
    if (!token || !rawUser) return;

    try {
      const u = JSON.parse(rawUser) as { role?: string };
      if (u?.role !== 'user') return;
    } catch {
      return;
    }

    this.disconnectSocket();

    const s = io(this.socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 8,
      reconnectionDelay: 1200,
    });
    this.socket = s;

    s.on('account_disabled', (payload: { reason?: string }) => {
      // Socket.io callback có thể chạy ngoài Angular zone.
      // Khi đó UI (signals/templates) có thể không re-render ngay cho tới lần người dùng click tiếp theo.
      // Bọc trong NgZone để luôn cập nhật UI tức thì.
      this.zone.run(() => {
        this.accountDisabled.blockSessionAndShow(payload?.reason || '');
        this.disconnectSocket();
        this.stopPoll();
      });
    });

    s.on('notification_refresh', () => {
      // Tương tự: đảm bảo change detection chạy để cập nhật badge chuông ngay.
      this.zone.run(() => {
        this.apiSvc.refreshUnreadCount();
      });
    });

    s.on('connect', () => {
      this.stopPoll();
      // Đồng bộ badge chuông sau khi nối lại socket (tránh bỏ lỡ notification_refresh).
      this.apiSvc.refreshUnreadCount();
    });

    s.on('disconnect', () => this.startPollFallback());

    s.on('connect_error', () => this.startPollFallback());
  }

  private disconnectSocket(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private startPollFallback(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.pollStatusOnce(), 25000);
  }

  private stopPoll(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Một request có auth — nếu tài khoản đã khóa, interceptor bật overlay. */
  private pollStatusOnce(): void {
    const token = localStorage.getItem('token');
    const userId = this.decodeUserIdFromToken(token!);
    if (!userId || !token) {
      this.stopPoll();
      return;
    }
    this.http.get(`${this.apiBase}/users/${userId}`, { headers: { Authorization: `Bearer ${token}` } }).subscribe({
      error: () => {
        /* 403 accountDisabled đã xử lý trong interceptor */
      },
    });
  }

  private decodeUserIdFromToken(token: string): string {
    if (!token) return '';
    try {
      const parts = String(token).split('.');
      if (parts.length < 2) return '';
      const payloadB64 = parts[1];
      const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
      const decodedStr = globalThis.atob(padded);
      const decoded = JSON.parse(decodedStr) as any;
      const uid = decoded?.userId ?? decoded?.id ?? decoded?._id;
      return uid != null ? String(uid) : '';
    } catch {
      return '';
    }
  }
}
