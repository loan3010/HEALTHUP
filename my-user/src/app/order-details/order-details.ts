import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, STATIC_BASE } from '../services/api.service';


@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './order-details.html',
  styleUrls: ['./order-details.css']
})
export class OrderDetail implements OnInit {

  order: any = null;
  orders: any[] = [];
  loading = true;
  currentId = '';
  activeTab: 'detail' | 'history' = 'detail'; // Tab hiện tại

  // Phân trang
  currentPage = 1;
  pageSize = 10;
  totalOrders = 0;
  totalPages = 1;
  isLoadingHistory = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Load chi tiết đơn khi route thay đổi
    this.route.paramMap.subscribe(params => {
      const id = params.get('id') || '';
      if (id && id !== this.currentId) {
        this.currentId = id;
        this.loading = true;
        this.order = null;
        this.activeTab = 'detail'; // Chuyển về tab chi tiết khi xem đơn mới
        this.cdr.detectChanges();
        this.loadOrder(id);
      }
    });
  }

  // Quay lại trang order-management
  goBack(): void {
    this.router.navigate(['/profile/order-management']);
  }

  // Lấy userId từ localStorage
  private getUserId(): string {
    const direct = localStorage.getItem('userId');
    if (direct) return direct;
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user?.id || user?._id || '';
    } catch { return ''; }
  }

  loadOrder(id: string): void {
    this.api.getOrderById(id).subscribe({
      next: (res: any) => {
        this.order = res;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Load orders với phân trang
  loadOrders(page: number = 1): void {
    const userId = this.getUserId();
    if (!userId) {
      this.orders = [];
      this.totalOrders = 0;
      this.totalPages = 1;
      this.cdr.detectChanges();
      return;
    }

    this.isLoadingHistory = true;
    this.cdr.detectChanges();

    this.api.getOrdersPaginated(userId, page, this.pageSize).subscribe({
      next: (res: any) => {
        this.orders = Array.isArray(res.orders) ? res.orders : [];
        this.totalOrders = res.total || 0;
        this.totalPages = Math.ceil(this.totalOrders / this.pageSize);
        this.currentPage = page;
        this.isLoadingHistory = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.orders = [];
        this.totalOrders = 0;
        this.totalPages = 1;
        this.isLoadingHistory = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Khi chuyển sang tab Lịch sử, load trang đầu tiên
  onTabChange(tab: 'detail' | 'history'): void {
    this.activeTab = tab;
    if (tab === 'history' && this.orders.length === 0) {
      this.currentPage = 1;
      this.loadOrders(1);
    }
  }

  // Chuyển trang
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.loadOrders(page);
    // Cuộn lên đầu bảng
    setTimeout(() => {
      const table = document.querySelector('.orders-table');
      if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  // Tạo mảng số trang để hiển thị
  getPageNumbers(): (number | string)[] {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (this.totalPages <= maxVisible) {
      for (let i = 1; i <= this.totalPages; i++) pages.push(i);
    } else {
      if (this.currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(this.totalPages);
      } else if (this.currentPage >= this.totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = this.totalPages - 3; i <= this.totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = this.currentPage - 1; i <= this.currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(this.totalPages);
      }
    }
    return pages;
  }

  goToOrder(id: string): void {
    this.router.navigate(['/profile/order-detail', id]);
  }

  // ==================== HELPERS ====================

  getTotal(): number {
    return this.order?.total
      || this.order?.items?.reduce((s: number, i: any) => s + i.price * i.quantity, 0)
      || 0;
  }

  getFullAddress(): string {
    const c = this.order?.customer;
    if (!c) return '';
    const parts = [c.address, c.ward, c.district, c.province]
      .map((p) => (p == null ? '' : String(p).trim()))
      .filter((p) => p.length > 0 && !/^n\/a$/i.test(p));
    return parts.join(', ');
  }

  fixImage(url: string): string {
    if (!url) return 'assets/placeholder.png';
    return url.startsWith('http') ? url : `${STATIC_BASE}${url}`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  formatDateShort(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Chờ xác nhận',
      confirmed: 'Chờ giao hàng',
      shipping: 'Đang giao',
      delivery_failed: 'Giao thất bại',
      delivered: 'Đã giao',
      cancelled: 'Đã hủy',
      pending_payment: 'Chờ thanh toán',
      paid: 'Đã thanh toán',
    };
    return map[status] || status;
  }

  getPaymentLabel(method: string): string {
    const map: Record<string, string> = {
      cod: 'Thanh toán khi nhận hàng (COD)',
      vnpay: 'VNPay',
      momo: 'MoMo',
      bank: 'Chuyển khoản',
    };
    return map[method] || method;
  }

  getShippingLabel(method: string): string {
    const map: Record<string, string> = {
      standard: 'Giao hàng tiêu chuẩn',
      express: 'Giao hàng nhanh',
    };
    return map[method] || method;
  }

  getReturnImages(order: any): string[] {
    const arr = order?.returnImages;
    if (!Array.isArray(arr)) return [];
    return arr.map((u: any) => String(u || '').trim()).filter(Boolean);
  }

  getReturnLines(order: any): any[] {
    const rows = order?.returnItems;
    if (!Array.isArray(rows)) return [];
    return rows.filter((r: any) => Number(r?.returnQty ?? 0) > 0);
  }

  returnRequestGoodsTotal(order: any): number {
    return this.getReturnLines(order).reduce(
      (s: number, r: any) => s + Number(r.price || 0) * Number(r.returnQty || 0),
      0
    );
  }

  getReturnStatusLabel(rs: string): string {
    const map: Record<string, string> = {
      requested: 'Đang chờ shop xử lý',
      approved: 'Shop đã chấp nhận hoàn',
      rejected: 'Yêu cầu bị từ chối',
      completed: 'Đã hoàn tiền / trả xong',
    };
    return map[rs] || rs;
  }
}