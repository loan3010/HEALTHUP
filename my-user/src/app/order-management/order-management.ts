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

  loadOrders(): void {
    const userId = this.getUserId();
    if (!userId) {
      this.orders = []; this.filteredOrders = [];
      this.updateTabCounts(); this.cdr.detectChanges(); return;
    }
    this.api.getOrders(userId).subscribe({
      next: (res: any) => {
        this.orders         = Array.isArray(res) ? res : [];
        this.filteredOrders = [...this.orders];
        this.updateTabCounts(); this.cdr.detectChanges();
      },
      error: () => { this.orders = []; this.filteredOrders = []; this.cdr.detectChanges(); }
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
    this.filteredOrders = data; this.cdr.detectChanges();
  }

  goToDetail(orderId: string): void {
    this.router.navigate(['/profile/order-detail', orderId]);
  }

  goToReview(order: any): void {
    if (order?.status !== 'delivered') return;
    this.router.navigate(['/profile/order-review']);
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

  // ✅ Mua lại — tự động tìm đúng productId từ nhiều field có thể có
  reorder(order: any): void {
    if (!order?.items?.length) return;

    console.log('ORDER ITEMS:', order.items); // debug — xóa sau khi fix xong

    let done = 0, fail = 0;
    const total = order.items.length;

    order.items.forEach((item: any) => {
      // Thử lấy productId từ nhiều field backend có thể trả về
      const productId =
        (typeof item.productId === 'object' ? item.productId?._id : item.productId) ||
        item.product?._id ||
        item.product ||
        item._id;

      console.log('productId resolved:', productId, '| item:', item); // debug

      if (!productId) {
        fail++;
        if (done + fail === total)
          this.api.showToast(`Thêm được ${done}/${total} sản phẩm.`, 'info');
        return;
      }

      this.api.addToCart(productId, item.quantity, item.name).subscribe({
        next: () => {
          done++;
          if (done + fail === total)
            this.api.showToast(
              fail === 0
                ? 'Đã thêm lại tất cả sản phẩm vào giỏ hàng! 🛒'
                : `Thêm được ${done}/${total} sản phẩm.`,
              fail === 0 ? 'success' : 'info'
            );
        },
        error: (err) => {
          console.error('addToCart lỗi:', err); // debug
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
      next: () => { this.loadOrders(); this.api.showToast('Đơn hàng đã được hủy.', 'info'); },
      error: () => { this.api.showToast('Không thể hủy đơn hàng. Vui lòng thử lại.', 'error'); }
    });
  }

  // ✅ Mở chatbot khi bấm "Liên hệ người bán"
  contactSeller(): void {
    const chatBtn = document.querySelector('.hu-chat-button') as HTMLElement;
    if (chatBtn) chatBtn.click();
  }
}