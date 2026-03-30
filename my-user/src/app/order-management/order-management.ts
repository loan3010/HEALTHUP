import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterModule } from '@angular/router';
import { ApiService } from '../services/api.service';
import { STORE_ZALO_PHONE, buildZaloMeUrl } from '../constants/store-contact.constants';


@Component({
  selector: 'app-order-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './order-management.html',
  styleUrls: ['./order-management.css']
})
export class OrderManagement implements OnInit {
  private readonly shippingStatuses = ['confirmed', 'shipping', 'delivery_failed'];
  /** Tab hợp lệ trên URL (?tab=) — đồng bộ với `tabs[].id`. */
  private readonly listTabIds = new Set<string>([
    'all',
    'pending',
    'waiting_shipping',
    'delivered',
    'cancelled',
  ]);

  // Dữ liệu gốc
  allOrders: any[] = [];
  
  // Dữ liệu hiển thị sau khi lọc
  filteredOrders: any[] = [];
  
  // Dữ liệu hiển thị trên trang hiện tại
  paginatedOrders: any[] = [];
  
  searchQuery = '';
  activeTab = 'all';
  loading = false;

  // Phân trang
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalFiltered = 0;
  
  // Cho phép sử dụng Math trong template
  Math = Math;

  /** Link Zalo cửa hàng — cùng số với nút chat nổi (store-contact.constants). */
  readonly zaloSellerUrl = buildZaloMeUrl(STORE_ZALO_PHONE);

  /** Modal xác nhận hủy đơn (thay window.confirm). */
  cancelConfirmOrderId: string | null = null;
  cancelActionLoading = false;

  tabs = [
    { id: 'all',       label: 'Tất cả',        count: 0 },
    { id: 'pending',   label: 'Chờ xác nhận',  count: 0 },
    { id: 'waiting_shipping', label: 'Chờ vận chuyển', count: 0 },
    { id: 'delivered', label: 'Đã giao',        count: 0 },
    { id: 'cancelled', label: 'Đã hủy',         count: 0 },
  ];

  constructor(
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params: ParamMap) => {
      this.applyTabFromQuery(params);
      if (this.allOrders.length > 0) {
        this.applyFilters();
      }
    });
    this.loadOrders();
  }

  private applyTabFromQuery(params: ParamMap): void {
    const t = params.get('tab');
    if (t && this.listTabIds.has(t)) {
      this.activeTab = t;
    } else {
      this.activeTab = 'all';
    }
  }

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
      this.allOrders = [];
      this.filteredOrders = [];
      this.paginatedOrders = [];
      this.updateTabCounts();
      this.updatePagination();
      this.cdr.detectChanges();
      return;
    }
    
    this.loading = true;
    this.api.getOrders(userId).subscribe({
      next: (res: any) => {
        this.allOrders = Array.isArray(res) ? res : [];
        this.applyFilters();
        this.updateTabCounts();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { 
        this.allOrders = [];
        this.filteredOrders = [];
        this.paginatedOrders = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  updateTabCounts(): void {
    this.tabs.forEach(tab => {
      if (tab.id === 'all') {
        tab.count = this.allOrders.length;
        return;
      }
      if (tab.id === 'waiting_shipping') {
        tab.count = this.allOrders.filter(o => this.shippingStatuses.includes(o.status)).length;
        return;
      }
      tab.count = this.allOrders.filter(o => o.status === tab.id).length;
    });
  }

  onTabClick(tab: string): void { 
    this.activeTab = tab; 
    this.currentPage = 1;
    this.applyFilters(); 
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  applyFilters(): void {
    let data = [...this.allOrders];
    
    // Lọc theo tab
    if (this.activeTab !== 'all') {
      if (this.activeTab === 'waiting_shipping') {
        data = data.filter(o => this.shippingStatuses.includes(o.status));
      } else {
        data = data.filter(o => o.status === this.activeTab);
      }
    }
    
    // Lọc theo từ khóa tìm kiếm
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
    this.totalFiltered = data.length;
    this.updatePagination();
    this.cdr.detectChanges();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredOrders.length / this.pageSize);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.paginatedOrders = this.filteredOrders.slice(start, end);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.updatePagination();
    // Cuộn lên đầu danh sách
    setTimeout(() => {
      const container = document.querySelector('.order-cards-container');
      if (container) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

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

  goToDetail(orderId: string): void {
    this.router.navigate(['/profile/order-detail', orderId], {
      queryParams: this.activeTab === 'all' ? {} : { tab: this.activeTab },
    });
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
      pending:          'Chờ xác nhận',
      confirmed:        'Chờ giao hàng',
      shipping:         'Đang giao',
      delivery_failed:  'Giao thất bại',
      delivered:        'Đã giao',
      cancelled:        'Đã hủy',
      pending_payment:  'Chờ thanh toán',
      paid:             'Đã thanh toán',
    };
    return map[status] || status;
  }

  reorder(order: any): void {
    if (!order?.items?.length) return;
    let done = 0, fail = 0;
    let firstFailReason = '';
    const total = order.items.length;
    order.items.forEach((item: any) => {
      const productId = this.normalizeObjectId(item?.productId || item?.product || item?._id);
      const variantId = this.normalizeObjectId(item?.variantId);
      const variantLabel = String(item?.variantLabel || '').trim();
      if (!productId) {
        fail++;
        if (!firstFailReason) firstFailReason = 'Không đọc được mã sản phẩm từ đơn hàng.';
        if (done + fail === total) {
          this.api.showToast(
            firstFailReason ? `Thêm được ${done}/${total} sản phẩm. ${firstFailReason}` : `Thêm được ${done}/${total} sản phẩm.`,
            'info'
          );
        }
        return;
      }
      this.api.addToCart(productId, item.quantity, item.name, variantId || undefined, variantLabel).subscribe({
        next: () => {
          done++;
          if (done + fail === total)
            this.api.showToast(
              fail === 0 ? 'Đã thêm lại tất cả sản phẩm vào giỏ hàng!' : `Thêm được ${done}/${total} sản phẩm.`,
              fail === 0 ? 'success' : 'info'
            );
        },
        error: (err: any) => {
          fail++;
          const backendMessage = String(err?.error?.message || '').trim();
          if (!firstFailReason) firstFailReason = backendMessage || 'Một số sản phẩm không còn khả dụng.';
          if (done + fail === total)
            this.api.showToast(
              firstFailReason ? `Thêm được ${done}/${total} sản phẩm. ${firstFailReason}` : `Thêm được ${done}/${total} sản phẩm.`,
              'info'
            );
        }
      });
    });
  }

  private normalizeObjectId(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object') {
      const nested = this.normalizeObjectId(value._id || value.id || value.$oid);
      if (nested) return nested;
      if (typeof value.toHexString === 'function') {
        const hex = String(value.toHexString() || '').trim();
        if (/^[a-f0-9]{24}$/i.test(hex)) return hex;
      }
      // Trường hợp mongoose ObjectId (không có _id/id) thì toString() trả về chuỗi 24 ký tự.
      const raw = String(value).trim();
      if (/^[a-f0-9]{24}$/i.test(raw)) return raw;
    }
    return '';
  }

  /** Mở modal xác nhận — không dùng confirm() của trình duyệt. */
  openCancelConfirm(orderId: string, ev?: Event): void {
    ev?.stopPropagation();
    this.cancelConfirmOrderId = orderId;
    this.cdr.detectChanges();
  }

  closeCancelConfirm(): void {
    if (this.cancelActionLoading) return;
    this.cancelConfirmOrderId = null;
    this.cdr.detectChanges();
  }

  /** Gọi API sau khi user bấm «Hủy đơn» trên modal. */
  confirmCancelOrder(): void {
    const id = this.cancelConfirmOrderId;
    if (!id || this.cancelActionLoading) return;
    this.cancelActionLoading = true;
    this.api.cancelOrder(id).subscribe({
      next: () => {
        this.cancelActionLoading = false;
        this.cancelConfirmOrderId = null;
        this.loadOrders();
        this.api.showToast('Đơn hàng đã được hủy.', 'info');
        this.cdr.detectChanges();
      },
      error: () => {
        this.cancelActionLoading = false;
        this.api.showToast('Không thể hủy đơn hàng. Vui lòng thử lại.', 'error');
        this.cdr.detectChanges();
      },
    });
  }
}