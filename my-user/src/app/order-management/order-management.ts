import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-order-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './order-management.html',
  styleUrls: ['./order-management.css']
})
export class OrderManagement implements OnInit {

  orders: any[]         = [];
  filteredOrders: any[] = [];
  searchQuery           = '';
  activeTab             = 'all';

  tabs = [
    { id: 'all',       label: 'Tất cả',        count: 0 },
    { id: 'pending',   label: 'Chờ xác nhận',  count: 0 },
    { id: 'confirmed', label: 'Chờ giao hàng', count: 0 },
    { id: 'shipping',  label: 'Đang giao',      count: 0 },
    { id: 'delivered', label: 'Đã giao',        count: 0 },
    { id: 'cancelled', label: 'Đã hủy',         count: 0 },
  ];

  constructor(
    private api: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void { this.loadOrders(); }

  private getUserId(): string {
    const direct = localStorage.getItem('userId');
    if (direct) return direct;
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user?._id || user?.id || '';
    } catch { return ''; }
  }

  private getUserPhone(): string {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user?.phone || '';
    } catch { return ''; }
  }

  loadOrders(): void {
    const userId    = this.getUserId();
    const userPhone = this.getUserPhone();

    if (!userId && !userPhone) {
      this.orders         = [];
      this.filteredOrders = [];
      this.updateTabCounts();
      this.cdr.detectChanges();
      return;
    }

    this.api.getOrders(userId).subscribe({
      next: (res: any) => {
        const all = Array.isArray(res) ? res : [];

        // Nếu có phone thì lọc thêm theo phone
        this.orders = userPhone
          ? all.filter((o: any) => o.customer?.phone === userPhone)
          : all;

        this.filteredOrders = [...this.orders];
        this.updateTabCounts();
        this.cdr.detectChanges();
      },
      error: () => {
        this.orders         = [];
        this.filteredOrders = [];
        this.cdr.detectChanges();
      }
    });
  }

  updateTabCounts(): void {
    this.tabs.forEach(tab => {
      tab.count = tab.id === 'all'
        ? this.orders.length
        : this.orders.filter(o => o.status === tab.id).length;
    });
  }

  onTabClick(tab: string): void { this.activeTab = tab; this.filterOrders(); }

  filterOrders(): void {
    let data = [...this.orders];
    if (this.activeTab !== 'all') data = data.filter(o => o.status === this.activeTab);
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      data = data.filter(o =>
        o.orderCode?.toLowerCase().includes(q) ||
        o._id?.toLowerCase().includes(q) ||
        o.customer?.fullName?.toLowerCase().includes(q) ||
        o.items?.some((i: any) => i.name?.toLowerCase().includes(q))
      );
    }
    this.filteredOrders = data;
    this.cdr.detectChanges();
  }

  goToDetail(orderId: string): void {
    this.router.navigate(['/profile/order-detail', orderId]);
  }

  goToReview(order: any): void {
    const firstItem = order?.items?.[0];
    if (!firstItem?.productId) return;
    this.router.navigate(['/profile/order-review'], {
      queryParams: { productId: String(firstItem.productId) }
    });
  }

  formatCurrency(price: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending:         'Chờ xác nhận',
      confirmed:       'Chờ giao hàng',
      shipping:        'Đang giao',
      delivered:       'Đã giao',
      cancelled:       'Đã hủy',
      pending_payment: 'Chờ thanh toán',
      paid:            'Đã thanh toán',
    };
    return map[status] || status;
  }

  reorder(order: any): void {
    if (!order?.items?.length) return;
    let done = 0, fail = 0;
    const total = order.items.length;
    order.items.forEach((item: any) => {
      this.api.addToCart(item.productId, item.quantity, item.name).subscribe({
        next: () => {
          done++;
          if (done + fail === total)
            this.api.showToast(
              fail === 0 ? 'Đã thêm lại tất cả sản phẩm vào giỏ hàng!' : `Thêm được ${done}/${total} sản phẩm.`,
              fail === 0 ? 'success' : 'info'
            );
        },
        error: () => {
          fail++;
          if (done + fail === total)
            this.api.showToast(`Thêm được ${done}/${total} sản phẩm.`, 'info');
        }
      });
    });
  }

  cancelOrder(orderId: string): void {
    if (!confirm('Bạn có chắc muốn hủy đơn này?')) return;
    this.api.cancelOrder(orderId).subscribe({
      next: () => {
        this.loadOrders();
        this.api.showToast('Đơn hàng đã được hủy.', 'info');
      },
      error: () => {
        this.api.showToast('Không thể hủy đơn hàng. Vui lòng thử lại.', 'error');
      }
    });
  }
}