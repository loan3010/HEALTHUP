import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-order-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './order-management.html',
  styleUrls: ['./order-management.css']
})
export class OrderManagement implements OnInit {

  orders: any[] = [];
  filteredOrders: any[] = [];

  searchQuery = '';
  activeTab = 'all';

  tabs = [
    { id: 'all',       label: 'Tất cả',        count: 0 },
    { id: 'pending',   label: 'Chờ xác nhận',  count: 0 },
    { id: 'confirmed', label: 'Chờ giao hàng', count: 0 },
    { id: 'delivered', label: 'Đã giao',        count: 0 },
    { id: 'cancelled', label: 'Đã hủy',         count: 0 },
  ];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    let userPhone = '';
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      userPhone = user?.phone || '';
    } catch {}

    this.api.getOrders().subscribe((res: any) => {
      const all = res || [];
      this.orders = userPhone
        ? all.filter((o: any) => o.customer?.phone === userPhone)
        : all;
      this.filteredOrders = this.orders;
      this.updateTabCounts();
    });
  }

  updateTabCounts(): void {
    this.tabs.forEach(tab => {
      tab.count = tab.id === 'all'
        ? this.orders.length
        : this.orders.filter(o => o.status === tab.id).length;
    });
  }

  onTabClick(tab: string): void {
    this.activeTab = tab;
    this.filterOrders();
  }

  filterOrders(): void {
    let data = this.orders;

    if (this.activeTab !== 'all') {
      data = data.filter(o => o.status === this.activeTab);
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      data = data.filter(o =>
        o.customer?.fullName?.toLowerCase().includes(q)
      );
    }

    this.filteredOrders = data;
  }

  formatCurrency(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending:         'Chờ xác nhận',
      pending_payment: 'Chờ giao hàng',
      paid:            'Đã giao',
      cancelled:       'Đã hủy',
    };
    return map[status] || status;
  }

  reorder(order: any): void {
    if (!order?.items?.length) return;

    let completed = 0;
    let failed    = 0;
    const total   = order.items.length;

    order.items.forEach((item: any) => {
      this.api.addToCart(item.productId, item.quantity, item.name).subscribe({
        next: () => {
          completed++;
          if (completed + failed === total) {
            this.api.showToast(
              failed === 0
                ? 'Đã thêm lại tất cả sản phẩm vào giỏ hàng!'
                : `Thêm được ${completed}/${total} sản phẩm.`,
              failed === 0 ? 'success' : 'info'
            );
          }
        },
        error: () => {
          failed++;
          if (completed + failed === total) {
            this.api.showToast(`Thêm được ${completed}/${total} sản phẩm.`, 'info');
          }
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
      error: (err) => {
        console.error('Lỗi hủy đơn:', err);
        this.api.showToast('Không thể hủy đơn hàng. Vui lòng thử lại.', 'error');
      }
    });
  }
}