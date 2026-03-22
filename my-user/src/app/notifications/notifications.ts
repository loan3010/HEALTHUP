import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './notifications.html',
  styleUrls: ['./notifications.css']
})
export class Notification implements OnInit {

  notifications: any[] = [];
  isLoading = true;

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.isLoading = true;
    this.api.getNotifications().subscribe({
      next: (res) => {
        this.notifications = res.notifications || [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onClickNoti(noti: any) {
    if (!noti.isRead) {
      this.api.markNotificationRead(noti._id).subscribe({
        next: () => { noti.isRead = true; this.cdr.detectChanges(); }
      });
    }

    if (noti.type === 'order') {
      const orderId = noti.orderId;
      if (orderId) {
        this.router.navigate(['/profile/order-detail', orderId]);
      } else {
        const match = (noti.message || '').match(/ORD\w+/);
        if (match) this.router.navigate(['/profile/order-detail', match[0]]);
      }
    }
  }

  markRead(noti: any) {
    if (noti.isRead) return;
    this.api.markNotificationRead(noti._id).subscribe({
      next: () => { noti.isRead = true; this.cdr.detectChanges(); }
    });
  }

  markAllRead() {
    this.api.markAllNotificationsRead().subscribe({
      next: () => {
        this.notifications.forEach(n => n.isRead = true);
        this.cdr.detectChanges();
      }
    });
  }

  // ✅ Xóa 1 thông báo
  deleteOne(event: Event, id: string) {
    event.stopPropagation(); // không trigger onClickNoti
    this.api.deleteNotification(id).subscribe({
      next: () => {
        this.notifications = this.notifications.filter(n => n._id !== id);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  // ✅ Xóa tất cả thông báo
  deleteAll() {
    if (!confirm('Bạn có chắc muốn xóa tất cả thông báo?')) return;
    this.api.deleteAllNotifications().subscribe({
      next: () => {
        this.notifications = [];
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  continueShopping() {
    this.router.navigate(['/products']);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diff < 60)    return 'Vừa xong';
    if (diff < 3600)  return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return d.toLocaleDateString('vi-VN');
  }

  getIcon(type: string): string {
    const map: Record<string, string> = {
      order:  'bi-bag-check',
      promo:  'bi-tag',
      system: 'bi-bell',
    };
    return map[type] || 'bi-bell';
  }

  get unreadCount(): number {
    return this.notifications.filter(n => !n.isRead).length;
  }
}