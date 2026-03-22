import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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
    private cdr: ChangeDetectorRef
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

  markRead(noti: any) {
    if (noti.isRead) return;
    this.api.markNotificationRead(noti._id).subscribe({
      next: () => {
        noti.isRead = true;
        this.cdr.detectChanges();
      }
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

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diff < 60)   return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
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