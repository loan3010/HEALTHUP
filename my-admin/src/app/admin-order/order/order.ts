import { Component, HostListener, OnDestroy, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminOrder, AdminOrderService } from './order.service';
import { OrderDetail } from '../order-detail/order-detail';
import { OrderFormComponent } from '../order-form/order-form';
import { AdminNavBridgeService } from '../../admin-nav-bridge.service';

@Component({
  selector: 'app-order',
  standalone: true,
  imports: [CommonModule, FormsModule, OrderDetail, OrderFormComponent],
  templateUrl: './order.html',
  styleUrl: './order.css',
})
export class Order implements OnInit, OnDestroy {
  orders: AdminOrder[] = [];
  isLoading = false;
  errorMsg = '';

  // Filters
  searchText = '';
  statusFilter = '';
  paymentMethodFilter = '';
  returnStatusFilter = '';
  /** Khách có TK / khách vãng lai / admin tạo — rỗng = tất cả. */
  orderSegmentFilter = '';
  fromDate = '';
  toDate = '';
  sortBy = 'createdAt';
  sortDir: 'asc' | 'desc' = 'desc';

  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  readonly perPage = 50;

  // Detail view on same page (no modal)
  selectedOrderId: string | null = null;

  /** Màn hình tạo đơn full-page (giống product-form). */
  isCreateFormOpen = false;

  // Stats cards
  totalOrders = 0;
  pendingCount = 0;
  shippingCount = 0;
  returnRequestedCount = 0;
  returnCompletedCount = 0;
  activeQuickCard: 'all' | 'pending' | 'shipping' | 'returnRequested' | 'returnCompleted' = 'all';
  selectedIds: Set<string> = new Set();
  allChecked = false;
  showFilterPanel = false;
  sortMenuOpen = false;

  private searchTimer: any;
  private refreshTimer: any;

  private readonly destroyRef = inject(DestroyRef);
  private readonly navBridge = inject(AdminNavBridgeService);

  constructor(private orderService: AdminOrderService) {}

  ngOnInit(): void {
    // Deep link từ thông báo admin (chuông).
    this.navBridge.openOrderDetail$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id: string) => {
        if (!id) return;
        this.isCreateFormOpen = false;
        this.openDetail(id);
      });

    this.loadOrders();
    // Tự refresh khi đang xem danh sách (không mở chi tiết / form tạo).
    this.refreshTimer = setInterval(() => {
      if (!this.selectedOrderId && !this.isCreateFormOpen) this.loadOrders(false);
    }, 30000);
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
    clearInterval(this.refreshTimer);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    const t = ev.target as HTMLElement;
    if (t.closest('.sort-wrap') || t.closest('.hu-dropdown-wrap')) return;
    this.sortMenuOpen = false;
    this.showFilterPanel = false;
  }

  loadOrders(resetPage = true): void {
    if (resetPage) this.currentPage = 1;
    this.fetchOrders();
  }

  fetchOrders(): void {
    this.isLoading = true;
    this.errorMsg = '';
    this.selectedIds.clear();
    this.allChecked = false;
    this.orderService.getList({
      page: this.currentPage,
      limit: this.perPage,
      search: this.searchText.trim(),
      status: this.statusFilter,
      paymentMethod: this.paymentMethodFilter,
      returnStatus: this.returnStatusFilter,
      orderSegment: this.orderSegmentFilter,
      from: this.fromDate,
      to: this.toDate,
      sortBy: this.sortBy,
      sortDir: this.sortDir
    }).subscribe({
      next: (res) => {
        this.orders = res.data || [];
        this.totalItems = res.total || 0;
        this.totalPages = res.totalPages || 1;
        const summary = res.summary;
        this.totalOrders = Number(summary?.totalOrders ?? this.totalItems);
        this.pendingCount = Number(summary?.pendingCount ?? 0);
        this.shippingCount = Number(summary?.shippingCount ?? 0);
        this.returnRequestedCount = Number(summary?.returnRequestedCount ?? 0);
        // Luồng mới: `approved` là trạng thái kết thúc luôn.
        // Dữ liệu cũ còn `completed` vẫn được tính vào cùng một nhóm "đã trả/hoàn".
        this.returnCompletedCount =
          Number(summary?.returnApprovedCount ?? 0) + Number(summary?.returnCompletedCount ?? 0);
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMsg = err?.error?.message || err?.message || 'Không thể tải danh sách đơn hàng';
        this.isLoading = false;
      }
    });
  }

  onSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadOrders(true), 350);
  }

  onApplyFilters(): void {
    this.showFilterPanel = false;
    this.loadOrders(true);
  }

  onResetFilters(): void {
    this.searchText = '';
    this.statusFilter = '';
    this.paymentMethodFilter = '';
    this.returnStatusFilter = '';
    this.orderSegmentFilter = '';
    this.fromDate = '';
    this.toDate = '';
    this.sortBy = 'createdAt';
    this.sortDir = 'desc';
    this.activeQuickCard = 'all';
    this.showFilterPanel = false;
    this.sortMenuOpen = false;
    this.loadOrders(true);
  }

  quickFilter(card: 'all' | 'pending' | 'shipping' | 'returnRequested' | 'returnCompleted'): void {
    this.activeQuickCard = card;
    this.statusFilter = '';
    this.returnStatusFilter = '';

    if (card === 'pending') this.statusFilter = 'pending';
    if (card === 'shipping') this.statusFilter = 'shipping';
    if (card === 'returnRequested') this.returnStatusFilter = 'requested';
    if (card === 'returnCompleted') this.returnStatusFilter = 'approved';

    this.loadOrders(true);
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  openCreateForm(): void {
    this.isCreateFormOpen = true;
  }

  closeCreateForm(): void {
    this.isCreateFormOpen = false;
  }

  /** Sau khi tạo đơn hotline: đóng form và mở chi tiết đơn vừa tạo. */
  onHotlineCreated(orderId: string): void {
    this.isCreateFormOpen = false;
    this.selectedOrderId = orderId;
    this.loadOrders(true);
  }

  toggleAll(checked: boolean): void {
    this.allChecked = checked;
    if (checked) {
      this.orders.forEach(o => this.selectedIds.add(o._id));
    } else {
      this.selectedIds.clear();
    }
  }

  toggleOne(id: string, checked: boolean): void {
    if (checked) this.selectedIds.add(id);
    else this.selectedIds.delete(id);
    this.allChecked = this.orders.length > 0 && this.orders.every(o => this.selectedIds.has(o._id));
  }

  editSelected(): void {
    if (this.selectedCount !== 1) return;
    const id = [...this.selectedIds][0];
    this.openDetail(id);
  }

  toggleSortMenu(): void {
    this.showFilterPanel = false;
    this.sortMenuOpen = !this.sortMenuOpen;
  }

  applySort(by: 'createdAt' | 'total', dir: 'asc' | 'desc'): void {
    this.sortBy = by;
    this.sortDir = dir;
    this.sortMenuOpen = false;
    this.loadOrders(true);
  }

  isSortActive(by: 'createdAt' | 'total', dir: 'asc' | 'desc'): boolean {
    return this.sortBy === by && this.sortDir === dir;
  }

  get sortLabelShort(): string {
    const key = `${this.sortBy}|${this.sortDir}`;
    const map: Record<string, string> = {
      'createdAt|desc': 'Mới nhất',
      'createdAt|asc': 'Cũ nhất',
      'total|desc': 'Tổng tiền cao',
      'total|asc': 'Tổng tiền thấp'
    };
    return map[key] || 'Mặc định';
  }

  get filterLabelShort(): string {
    const parts: string[] = [];
    if (this.statusFilter) parts.push('Trạng thái');
    if (this.paymentMethodFilter) parts.push('Thanh toán');
    if (this.returnStatusFilter) parts.push('Trả/hoàn');
    if (this.fromDate || this.toDate) parts.push('Khoảng ngày');
    if (this.orderSegmentFilter) parts.push('Loại đơn');
    return parts.length ? parts.join(' · ') : 'Mặc định';
  }

  /**
   * Một dòng phụ dưới SĐT — tiếng Việt, không badge (đồng bộ nhãn với bộ lọc).
   * Đơn cũ thiếu buyerLinkType: suy từ role trong buyerAccount khi có.
   */
  buyerSegmentLine(o: AdminOrder): string {
    if (o.orderSource === 'admin_hotline') return 'Admin tạo đơn';
    const b = o.buyerLinkType;
    if (b === 'user') return 'Khách có tài khoản';
    if (b === 'guest' || b === 'none') return 'Khách vãng lai';
    const r = o.buyerAccount?.role;
    if (r === 'user') return 'Khách có tài khoản (đơn cũ)';
    if (r === 'guest') return 'Khách vãng lai (đơn cũ)';
    if (!o.userId) return 'Khách vãng lai (đơn cũ)';
    return 'Khách có tài khoản (đơn cũ)';
  }

  prevPage(): void {
    if (this.currentPage <= 1) return;
    this.currentPage -= 1;
    this.fetchOrders();
  }

  nextPage(): void {
    if (this.currentPage >= this.totalPages) return;
    this.currentPage += 1;
    this.fetchOrders();
  }

  openDetail(orderId: string): void {
    this.selectedOrderId = orderId;
  }

  closeDetail(): void {
    this.selectedOrderId = null;
    this.fetchOrders();
  }

  onOrderUpdated(): void {
    this.fetchOrders();
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Chờ xác nhận',
      confirmed: 'Chờ giao hàng',
      shipping: 'Đang giao',
      delivery_failed: 'Giao thất bại',
      delivered: 'Đã giao',
      cancelled: 'Đã hủy',
    };
    return map[status] || status;
  }

  paymentMethodLabel(method: string): string {
    const map: Record<string, string> = {
      cod: 'COD',
      momo: 'MoMo',
      vnpay: 'VNPay'
    };
    return map[method] || method;
  }

  returnLabel(returnStatus: string): string {
    const map: Record<string, string> = {
      none: 'Không',
      requested: 'Yêu cầu hoàn/trả',
      approved: 'Đã chấp nhận hoàn',
      rejected: 'Từ chối hoàn',
      // Dữ liệu cũ còn `completed` coi như kết thúc (tương đương `approved`).
      completed: 'Đã chấp nhận hoàn',
    };
    return map[returnStatus] || returnStatus;
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value || 0) + 'đ';
  }

}
