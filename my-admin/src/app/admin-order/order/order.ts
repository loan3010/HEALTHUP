import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminOrder, AdminOrderService } from './order.service';
import { OrderDetail } from '../order-detail/order-detail';

@Component({
  selector: 'app-order',
  standalone: true,
  imports: [CommonModule, FormsModule, OrderDetail],
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
  showCreatePanel = false;
  createSubmitting = false;
  createError = '';
  productOptions: Array<{ _id: string; name: string }> = [];
  newOrder = {
    customer: {
      fullName: '',
      phone: '',
      email: '',
      address: '',
      province: '',
      district: '',
      ward: '',
      note: ''
    },
    shippingMethod: 'standard' as 'standard' | 'express',
    paymentMethod: 'cod' as 'cod' | 'momo' | 'vnpay',
    items: [
      { productId: '', quantity: 1 }
    ] as Array<{ productId: string; quantity: number }>
  };

  private searchTimer: any;
  private refreshTimer: any;

  constructor(private orderService: AdminOrderService) {}

  ngOnInit(): void {
    this.loadOrders();
    this.loadProductOptions();
    // Tự refresh để admin thấy đơn mới mà không cần F5.
    this.refreshTimer = setInterval(() => {
      if (!this.selectedOrderId) this.loadOrders(false);
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
        this.returnCompletedCount = Number(summary?.returnCompletedCount ?? 0);
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
    if (card === 'returnCompleted') this.returnStatusFilter = 'completed';

    this.loadOrders(true);
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  loadProductOptions(): void {
    this.orderService.getProductsForOrder(200).subscribe({
      next: (rows) => {
        this.productOptions = rows.map((p: any) => ({ _id: String(p._id), name: String(p.name || '') }));
      },
      error: () => {
        this.productOptions = [];
      }
    });
  }

  toggleCreatePanel(): void {
    this.showCreatePanel = !this.showCreatePanel;
    this.createError = '';
  }

  addItemRow(): void {
    this.newOrder.items.push({ productId: '', quantity: 1 });
  }

  removeItemRow(idx: number): void {
    if (this.newOrder.items.length <= 1) return;
    this.newOrder.items.splice(idx, 1);
  }

  submitHotlineOrder(): void {
    this.createError = '';
    if (!this.newOrder.customer.fullName || !this.newOrder.customer.phone || !this.newOrder.customer.address) {
      this.createError = 'Vui lòng nhập đủ họ tên, số điện thoại, địa chỉ.';
      return;
    }
    if (!this.newOrder.customer.province || !this.newOrder.customer.district || !this.newOrder.customer.ward) {
      this.createError = 'Vui lòng nhập đủ tỉnh/thành, quận/huyện, phường/xã.';
      return;
    }
    const items = this.newOrder.items
      .filter(i => i.productId && Number(i.quantity) > 0)
      .map(i => ({ productId: i.productId, quantity: Number(i.quantity) }));
    if (!items.length) {
      this.createError = 'Vui lòng chọn ít nhất 1 sản phẩm.';
      return;
    }

    this.createSubmitting = true;
    this.orderService.createHotlineOrder({
      customer: this.newOrder.customer,
      items,
      shippingMethod: this.newOrder.shippingMethod,
      paymentMethod: this.newOrder.paymentMethod
    }).subscribe({
      next: (res) => {
        this.createSubmitting = false;
        alert(`Tạo đơn thành công: ${res.orderCode || res.orderId}`);
        this.showCreatePanel = false;
        this.newOrder = {
          customer: { fullName: '', phone: '', email: '', address: '', province: '', district: '', ward: '', note: '' },
          shippingMethod: 'standard',
          paymentMethod: 'cod',
          items: [{ productId: '', quantity: 1 }]
        };
        this.loadOrders(true);
      },
      error: (err) => {
        this.createSubmitting = false;
        this.createError = err?.error?.message || 'Không thể tạo đơn hàng hotline';
      }
    });
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
    return parts.length ? parts.join(' · ') : 'Mặc định';
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
      delivered: 'Đã giao',
      cancelled: 'Đã hủy'
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
      completed: 'Đã hoàn/trả'
    };
    return map[returnStatus] || returnStatus;
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value || 0) + 'đ';
  }

}
