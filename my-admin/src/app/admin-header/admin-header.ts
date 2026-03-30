import {
  Component,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  HostListener,
  inject,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminAlertsService, AdminNotificationRow } from '../admin-alerts.service';
import { AdminNavBridgeService } from '../admin-nav-bridge.service';

@Component({
  selector: 'app-admin-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-header.html',
  styleUrls: ['./admin-header.css'],
})
export class AdminHeader implements OnInit, OnDestroy {
  @Output() toggleSidebarEvent = new EventEmitter<void>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly alerts = inject(AdminAlertsService);
  private readonly navBridge = inject(AdminNavBridgeService);
  private readonly router = inject(Router);

  adminName: string = 'Quản trị viên';
  adminFullName: string = '';
  adminID: string = '';
  showDropdown: boolean = false;

  /** Panel thông báo dưới chuông. */
  notifOpen = false;
  notifications: AdminNotificationRow[] = [];
  unreadCount = 0;

  ngOnInit(): void {
    const info = localStorage.getItem('admin_info');
    if (info) {
      const admin = JSON.parse(info);
      this.adminFullName = admin.name;
      this.adminID = admin.id || 'N/A';
      this.adminName = this.getShortName(admin.name);
    }

    if (localStorage.getItem('admin_token')) {
      this.alerts.bootstrapSocket();
      this.alerts.refresh();
      this.alerts.list$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((list) => (this.notifications = list));
      this.alerts.unread$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((n) => (this.unreadCount = n));
    }
  }

  ngOnDestroy(): void {
    this.alerts.teardownSocket();
  }

  getShortName(fullName: string): string {
    if (!fullName) return 'Admin';
    const parts = fullName.trim().split(' ');
    return parts.length > 1 ? parts.slice(-2).join(' ') : parts[0];
  }

  onToggleClick(): void {
    this.toggleSidebarEvent.emit();
  }

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.showDropdown = !this.showDropdown;
    if (this.showDropdown) this.notifOpen = false;
  }

  /** Bấm chuông: mở/đóng dropdown thông báo. */
  toggleNotifPanel(ev: Event): void {
    ev.stopPropagation();
    this.notifOpen = !this.notifOpen;
    this.showDropdown = false;
    if (this.notifOpen) this.alerts.refresh();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showDropdown = false;
    this.notifOpen = false;
  }

  onLogout(): void {
    this.alerts.teardownSocket();
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_info');
    this.router.navigate(['/login']);
  }

  /** Đánh dấu tất cả đã đọc. */
  markAllNotificationsRead(ev: Event): void {
    ev.stopPropagation();
    this.alerts.markAllRead().subscribe({
      next: () => this.alerts.patchLocalAllRead(),
      error: (err) => console.error('markAllRead', err),
    });
  }

  /** Click một dòng: đọc + điều hướng tới đơn hoặc sản phẩm. */
  onNotificationClick(ev: Event, n: AdminNotificationRow): void {
    ev.stopPropagation();
    if (!n.isRead) {
      this.alerts.markOneRead(n._id).subscribe({
        next: () => this.alerts.patchLocalRead(n._id),
        error: () => this.alerts.patchLocalRead(n._id),
      });
    }
    if (n.type === 'review_new') {
      this.navBridge.goToReview(n.productId || '', n.reviewId);
    } else if (n.type === 'consulting_pending' && n.productId) {
      this.navBridge.goToConsulting(n.productId);
    } else if (n.orderId) {
      this.navBridge.goToOrder(n.orderId);
    }
    this.notifOpen = false;
  }

  trackNoti(_i: number, n: AdminNotificationRow): string {
    return n._id;
  }
}
