import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

/**
 * Thông báo admin: REST /api/admin/notifications + Socket.io real-time.
 * Tách khỏi thông báo user (my-user) để không lẫn API.
 */
export interface AdminNotificationRow {
  _id: string;
  type: string;
  title: string;
  message: string;
  orderId: string | null;
  productId: string | null;
  reviewId: string | null;
  /** Câu hỏi tư vấn (type consulting_pending). */
  consultingId?: string | null;
  isRead: boolean;
  createdAt: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminAlertsService {
  private readonly API = 'http://localhost:3000/api/admin/notifications';
  private socket: Socket | null = null;

  /** Danh sách hiển thị trong dropdown (mới nhất trước). */
  readonly list$ = new BehaviorSubject<AdminNotificationRow[]>([]);
  /** Số thông báo chưa đọc — badge chuông. */
  readonly unread$ = new BehaviorSubject<number>(0);

  constructor(private http: HttpClient) {}

  private authHeader(): { Authorization: string } {
    const token = localStorage.getItem('admin_token') || '';
    return { Authorization: `Bearer ${token}` };
  }

  /**
   * Kết nối Socket.io (JWT admin trong handshake.auth).
   * Gọi sau khi đăng nhập / khi header admin mount.
   */
  bootstrapSocket(): void {
    const token = localStorage.getItem('admin_token') || '';
    if (!token) return;
    this.teardownSocket();
    this.socket = io('http://localhost:3000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    this.socket.on('admin_notification', (payload: { notification?: AdminNotificationRow }) => {
      const n = payload?.notification;
      if (!n?._id) return;
      const cur = this.list$.value;
      const dedup = cur.filter((x) => x._id !== n._id);
      this.list$.next([n, ...dedup]);
      if (!n.isRead) this.unread$.next(this.unread$.value + 1);
    });
  }

  teardownSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket.removeAllListeners();
      this.socket = null;
    }
  }

  /** Tải lại list + unread từ server (F5 dropdown hoặc sau khi mở panel). */
  refresh(): void {
    this.http
      .get<{ notifications: AdminNotificationRow[]; unreadCount: number }>(this.API, {
        headers: this.authHeader(),
      })
      .subscribe({
        next: (res) => {
          this.list$.next(res.notifications || []);
          this.unread$.next(Number(res.unreadCount) || 0);
        },
        error: (err) => console.error('AdminAlertsService.refresh', err),
      });
  }

  markAllRead(): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${this.API}/read-all`, {}, { headers: this.authHeader() });
  }

  markOneRead(id: string): Observable<{ notification: AdminNotificationRow }> {
    return this.http.patch<{ notification: AdminNotificationRow }>(
      `${this.API}/${id}/read`,
      {},
      { headers: this.authHeader() }
    );
  }

  /** Cập nhật local sau mark read (tránh chờ round-trip phức tạp). */
  patchLocalRead(id: string): void {
    const list = this.list$.value.map((x) => (x._id === id ? { ...x, isRead: true } : x));
    this.list$.next(list);
    this.unread$.next(list.filter((x) => !x.isRead).length);
  }

  patchLocalAllRead(): void {
    this.list$.next(this.list$.value.map((x) => ({ ...x, isRead: true })));
    this.unread$.next(0);
  }
}
