import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CustomerService,
  CustomerItem,
  CustomerHistoryRow,
  CustomerSavedAddress,
} from './customer.service';
import { AdminAlertModalService } from '../../admin-alert-modal/admin-alert-modal.service';
import { AdminNavBridgeService } from '../../admin-nav-bridge.service';

interface CustomerRow extends CustomerItem {
  selected: boolean;
  initials: string;
  avatarBg: string;
  avatarFg: string;
}

const AVATAR_COLORS = [
  { bg: '#D1FAE5', fg: '#065F46' }, { bg: '#DBEAFE', fg: '#1E40AF' },
  { bg: '#FEE2E2', fg: '#991B1B' }, { bg: '#FEF3C7', fg: '#92400E' },
  { bg: '#EDE9FE', fg: '#5B21B6' }, { bg: '#FCE7F3', fg: '#9D174D' },
  { bg: '#CCFBF1', fg: '#0F766E' },
];
const DEACTIVATE_QUICK_REASONS: ReadonlyArray<string> = [
  'Vi phạm điều khoản mua hàng.',
  'Nhiều lần hủy đơn không lý do.',
  'Có dấu hiệu gian lận thanh toán.',
  'Có hành vi quấy rối nhân viên/chăm sóc khách hàng.',
  'Tài khoản có rủi ro bảo mật, tạm khóa để xác minh.',
];

@Component({
  selector: 'app-customer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer.html',
  styleUrls: ['./customer.css']
})
export class Customer implements OnInit {
  readonly historyTabs: Array<{ id: 'all' | 'pending' | 'in_transit' | 'delivered' | 'cancelled' | 'return'; label: string }> = [
    { id: 'all', label: 'Tất cả' },
    { id: 'pending', label: 'Chờ xác nhận' },
    { id: 'in_transit', label: 'Đang vận chuyển' },
    { id: 'delivered', label: 'Đã giao' },
    { id: 'cancelled', label: 'Đã hủy' },
    { id: 'return', label: 'Đổi trả' },
  ];

  customers: CustomerRow[] = [];
  searchText = '';
  tierFilter: '' | 'member' | 'vip' = '';
  activeFilter: 'all' | 'active' | 'inactive' = 'all';
  selectedCount = 0;
  isLoading = false;
  errorMsg  = '';
  showFilterPanel = false;

  // Modal detail
  isModalOpen = false;
  selectedCustomer: CustomerRow | null = null;
  detailAddresses: CustomerSavedAddress[] = [];
  detailAddressesLoading = false;
  detailOrders: CustomerHistoryRow[] = [];
  detailOrdersLoading = false;
  detailHistoryError = '';
  detailHistoryTab: 'all' | 'pending' | 'in_transit' | 'delivered' | 'cancelled' | 'return' = 'all';
  detailHistoryCounts = { all: 0, pending: 0, in_transit: 0, delivered: 0, cancelled: 0, return: 0 };
  detailHistoryPage = 1;
  detailHistoryTotalPages = 1;
  detailShowAllHistory = false;
  topProducts: Array<{ name: string; count: number }> = [];

  // Modal confirm xóa
  isDeleteModalOpen = false;
  deleteTarget: CustomerRow | null = null;

  // Modal xác nhận vô hiệu hóa (bắt buộc nhập lý do cho khách)
  isDeactivateModalOpen = false;
  deactivateTarget: CustomerRow | null = null;
  deactivateReasonDraft = '';
  deactivateSubmitting = false;
  readonly deactivateQuickReasons = DEACTIVATE_QUICK_REASONS;

  // Modal xác nhận mở lại tài khoản
  isActivateModalOpen = false;
  activateTarget: CustomerRow | null = null;

  // Pagination — backend driven
  currentPage = 1;
  totalPages  = 1;
  totalItems  = 0;
  // Mỗi trang cần hiển thị tối thiểu 50 khách (theo yêu cầu).
  readonly perPage = 50;

  private searchTimer: any;

  // ── SẮP XẾP: menu + tham số gửi API (sortBy / sortDir) ──
  /** true khi dropdown mở */
  sortMenuOpen = false;
  /** Trường sort khớp backend: createdAt | username | customerID | totalOrders | totalSpent | membershipTier */
  sortBy = 'createdAt';
  sortDir: 'asc' | 'desc' = 'desc';

  constructor(
    private customerService: CustomerService,
    private adminAlert: AdminAlertModalService,
    private navBridge: AdminNavBridgeService
  ) {}

  ngOnInit(): void { this.loadCustomers(); }

  /** Đóng menu khi click ra ngoài vùng .sort-wrap */
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    const t = ev.target as HTMLElement;
    const inSort = !!t.closest('.sort-wrap');
    const inFilter = !!t.closest('.hu-dropdown-wrap');
    if (!inSort) this.sortMenuOpen = false;
    if (!inFilter) this.showFilterPanel = false;
  }

  /** Bật/tắt menu Sắp xếp */
  toggleSortMenu(): void {
    this.sortMenuOpen = !this.sortMenuOpen;
  }

  /**
   * Áp dụng tiêu chí sắp xếp, về trang 1 và gọi lại API.
   * Dùng cho từng dòng trong dropdown.
   */
  applySort(by: string, dir: 'asc' | 'desc'): void {
    this.sortBy = by;
    this.sortDir = dir;
    this.sortMenuOpen = false;
    this.currentPage = 1;
    this.loadCustomers();
  }

  isSortActive(by: string, dir: 'asc' | 'desc'): boolean {
    return this.sortBy === by && this.sortDir === dir;
  }

  /** Nhãn ngắn hiển thị cạnh nút để biết đang sort theo gì */
  get sortLabelShort(): string {
    const key = `${this.sortBy}|${this.sortDir}`;
    const map: Record<string, string> = {
      'createdAt|desc': 'Mới nhất',
      'createdAt|asc': 'Cũ nhất',
      'username|asc': 'Tên A–Z',
      'username|desc': 'Tên Z–A',
      'customerID|asc': 'Mã KH',
      'totalOrders|desc': 'Nhiều đơn',
      'totalOrders|asc': 'Ít đơn',
      'totalSpent|desc': 'Chi nhiều',
      'totalSpent|asc': 'Chi ít',
      'membershipTier|desc': 'Hạng cao',
      'membershipTier|asc': 'Hạng thấp',
    };
    return map[key] || this.sortBy;
  }

  /** Thông báo rõ hơn khi API không tới được (status 0) hoặc server trả JSON lỗi. */
  private formatCustomerListError(err: unknown): string {
    const e = err as { status?: number; error?: { message?: string }; message?: string };
    const apiMsg =
      typeof e?.error?.message === 'string' && e.error.message.trim()
        ? e.error.message.trim()
        : '';
    if (e?.status === 0) {
      return (
        'Không kết nối được API (thường do backend chưa chạy hoặc không phải cổng 3000). ' +
        'Hãy chạy `npm start` trong thư mục `backend` và thử lại.'
      );
    }
    if (apiMsg) return apiMsg;
    if (e?.status) {
      return `Lỗi ${e.status}: ${e.message || 'Không thể tải danh sách'}`;
    }
    return e?.message || 'Không thể tải danh sách';
  }

  // ── LOAD ──
  loadCustomers(): void {
    this.isLoading = true;
    this.errorMsg  = '';
    const isActiveValue =
      this.activeFilter === 'active'
        ? true
        : this.activeFilter === 'inactive'
          ? false
          : undefined;
    this.customerService.getAll({
      search: this.searchText,
      page:   this.currentPage,
      limit:  this.perPage,
      tier: this.tierFilter || undefined,
      isActive: isActiveValue,
      sortBy: this.sortBy,
      sortDir: this.sortDir,
    }).subscribe({
      next: res => {
        this.customers  = res.data.map(c => this.toRow(c));
        this.totalPages = res.totalPages;
        this.totalItems = res.total;
        this.isLoading  = false;
        this.updateSelectedCount();
      },
      error: (err: unknown) => {
        this.errorMsg = this.formatCustomerListError(err);
        this.isLoading = false;
      }
    });
  }

  // ── SEARCH debounce 400ms ──
  onSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.currentPage = 1;
      this.loadCustomers();
    }, 400);
  }

  /** Đổi bộ lọc (hạng/trạng thái) thì quay lại trang 1 rồi gọi lại API. */
  onFilterChange(): void {
    this.currentPage = 1;
    this.loadCustomers();
    this.showFilterPanel = false;
  }

  /** Xóa nhanh toàn bộ bộ lọc về mặc định. */
  resetFilters(): void {
    this.tierFilter = '';
    this.activeFilter = 'all';
    this.currentPage = 1;
    this.loadCustomers();
    this.showFilterPanel = false;
  }

  get hasActiveFilter(): boolean {
    return !!this.tierFilter || this.activeFilter !== 'all';
  }

  get filterLabelShort(): string {
    const parts: string[] = [];
    if (this.tierFilter === 'vip') parts.push('VIP');
    if (this.tierFilter === 'member') parts.push('Thành viên');
    if (this.activeFilter === 'active') parts.push('Hoạt động');
    if (this.activeFilter === 'inactive') parts.push('Đang khóa');
    return parts.length ? parts.join(' · ') : 'Tất cả';
  }

  // ── PAGINATION ──
  get pageStart(): number { return this.totalItems === 0 ? 0 : (this.currentPage - 1) * this.perPage + 1; }
  get pageEnd():   number { return Math.min(this.currentPage * this.perPage, this.totalItems); }
  prevPage(): void { if (this.currentPage > 1)              { this.currentPage--; this.loadCustomers(); } }
  nextPage(): void { if (this.currentPage < this.totalPages) { this.currentPage++; this.loadCustomers(); } }

  // ── SELECT ──
  toggleAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.customers.forEach(c => c.selected = checked);
    this.updateSelectedCount();
  }
  updateSelectedCount(): void {
    this.selectedCount = this.customers.filter(c => c.selected).length;
  }

  // ── MODAL DETAIL ──
  onRowClick(c: CustomerRow): void { this.openCustomerDetail(c); }
  onEditClick(): void {
    const c = this.customers.find(c => c.selected);
    if (c) this.openCustomerDetail(c);
  }
  closeModal(): void {
    this.isModalOpen = false;
    this.selectedCustomer = null;
    this.detailAddresses = [];
    this.detailOrders = [];
    this.topProducts = [];
    this.detailHistoryError = '';
  }

  private openCustomerDetail(c: CustomerRow): void {
    this.selectedCustomer = c;
    this.isModalOpen = true;
    this.detailAddresses = [];
    this.topProducts = [];
    this.detailOrders = [];
    this.detailHistoryError = '';
    this.detailHistoryTab = 'all';
    this.detailHistoryPage = 1;
    this.detailShowAllHistory = false;
    // Làm mới số liệu CRM từ API chi tiết (đồng bộ sau khi đổi rule chỉ tính theo userId).
    this.customerService.getById(c.id).subscribe({
      next: (fresh) => {
        if (!this.selectedCustomer || this.selectedCustomer.id !== fresh.id) return;
        this.selectedCustomer = {
          ...this.selectedCustomer,
          totalOrders: fresh.totalOrders,
          totalSpent: fresh.totalSpent,
          membershipTier: fresh.membershipTier,
          hasProvisionalSpend: fresh.hasProvisionalSpend,
          orderCountAll: fresh.orderCountAll,
          recentSpent90d: fresh.recentSpent90d,
        };
      },
      error: () => {
        /* giữ số từ danh sách nếu GET lỗi */
      },
    });
    this.loadDetailAddresses();
    this.loadDetailOrderHistory(true);
  }

  loadDetailAddresses(): void {
    if (!this.selectedCustomer?.id) return;
    this.detailAddressesLoading = true;
    this.customerService.getAddresses(this.selectedCustomer.id).subscribe({
      next: (res) => {
        this.detailAddresses = (res?.addresses || []) as CustomerSavedAddress[];
        this.detailAddressesLoading = false;
      },
      error: () => {
        this.detailAddresses = [];
        this.detailAddressesLoading = false;
      },
    });
  }

  onHistoryTabClick(tab: 'all' | 'pending' | 'in_transit' | 'delivered' | 'cancelled' | 'return'): void {
    this.detailHistoryTab = tab;
    this.detailHistoryPage = 1;
    this.loadDetailOrderHistory(false);
  }

  toggleShowAllHistory(): void {
    this.detailShowAllHistory = !this.detailShowAllHistory;
    this.detailHistoryPage = 1;
    this.loadDetailOrderHistory(false);
  }

  prevHistoryPage(): void {
    if (this.detailHistoryPage <= 1) return;
    this.detailHistoryPage -= 1;
    this.loadDetailOrderHistory(false);
  }

  nextHistoryPage(): void {
    if (this.detailHistoryPage >= this.detailHistoryTotalPages) return;
    this.detailHistoryPage += 1;
    this.loadDetailOrderHistory(false);
  }

  loadDetailOrderHistory(resetPage = false): void {
    if (!this.selectedCustomer?.id) return;
    if (resetPage) this.detailHistoryPage = 1;
    this.detailOrdersLoading = true;
    this.detailHistoryError = '';
    this.customerService.getOrderHistory(this.selectedCustomer.id, {
      tab: this.detailHistoryTab,
      page: this.detailHistoryPage,
      limit: this.detailShowAllHistory ? 20 : 5,
    }).subscribe({
      next: (res) => {
        this.detailOrders = res?.data || [];
        this.detailHistoryCounts = res?.counts || this.detailHistoryCounts;
        this.detailHistoryPage = Number(res?.page || 1);
        this.detailHistoryTotalPages = Number(res?.totalPages || 1);
        this.topProducts = res?.topProducts || [];
        this.detailOrdersLoading = false;
      },
      error: (err) => {
        this.detailOrders = [];
        this.detailHistoryError = err?.error?.message || 'Không thể tải lịch sử đơn hàng';
        this.detailOrdersLoading = false;
      },
    });
  }

  historyItemPreview(items: Array<{ name: string; quantity: number }>): string {
    const list = (items || []).slice(0, 3).map((i) => `${i.name} x${i.quantity}`);
    const hasMore = (items || []).length > 3;
    return hasMore ? `${list.join(', ')} ...` : list.join(', ');
  }

  historyStatusClass(row: CustomerHistoryRow): string {
    const status = String(row?.status || '');
    if (status === 'pending') return 'oh-status-pending';
    if (status === 'confirmed') return 'oh-status-confirmed';
    if (status === 'shipping') return 'oh-status-shipping';
    if (status === 'delivery_failed') return 'oh-status-delivery-failed';
    if (status === 'delivered') return 'oh-status-delivered';
    if (status === 'cancelled') return 'oh-status-cancelled';
    return 'oh-status-default';
  }

  openOrderDetail(orderId: string, event?: Event): void {
    event?.stopPropagation();
    if (!orderId) return;
    this.closeModal();
    this.navBridge.goToOrder(orderId);
  }

  // ── TOGGLE ACTIVE ──
  /** Đang khóa → mở modal nhập lý do. Đang mở khóa → gọi API ngay (không cần lý do). */
  onToggleActive(c: CustomerRow, event?: Event): void {
    event?.stopPropagation();
    if (!c.isActive) {
      this.activateTarget = c;
      this.isActivateModalOpen = true;
      return;
    }
    this.deactivateTarget = c;
    this.deactivateReasonDraft = '';
    this.isDeactivateModalOpen = true;
  }

  cancelDeactivate(): void {
    this.isDeactivateModalOpen = false;
    this.deactivateTarget = null;
    this.deactivateReasonDraft = '';
    this.deactivateSubmitting = false;
  }

  applyQuickDeactivateReason(reason: string): void {
    this.deactivateReasonDraft = reason;
  }

  cancelActivate(): void {
    this.isActivateModalOpen = false;
    this.activateTarget = null;
  }

  confirmActivate(): void {
    const target = this.activateTarget;
    if (!target) return;
    this.deactivateSubmitting = true;
    this.runToggleActive(target, null, () => {
      this.cancelActivate();
    });
  }

  confirmDeactivate(): void {
    const reason = this.deactivateReasonDraft.trim();
    if (reason.length === 0) {
      this.adminAlert.show({
        title: 'Thiếu lý do',
        message: 'Vui lòng nhập lý do vô hiệu hóa. Khách hàng sẽ thấy nội dung này khi đăng nhập.',
        isError: true,
      });
      return;
    }
    const target = this.deactivateTarget;
    if (!target) return;
    this.deactivateSubmitting = true;
    this.runToggleActive(
      target,
      { reason, performedBy: this.getAdminActorLabel() },
      () => {
        this.cancelDeactivate();
      }
    );
  }

  /**
   * Lấy nhãn admin đang đăng nhập (lưu sau admin-login) để ghi vào audit khóa tài khoản.
   */
  private getAdminActorLabel(): string {
    try {
      const raw = localStorage.getItem('admin_info');
      if (!raw) return '';
      const j = JSON.parse(raw) as { name?: string; email?: string };
      const name = String(j?.name || '').trim();
      const email = String(j?.email || '').trim();
      return (name || email || '').slice(0, 200);
    } catch {
      return '';
    }
  }

  /**
   * Gọi PATCH toggle-active.
   * @param payload null = kích hoạt lại; object = vô hiệu hóa kèm lý do.
   */
  private runToggleActive(
    c: CustomerRow,
    payload: { reason: string; performedBy?: string } | null,
    onDone?: () => void
  ): void {
    const body: Record<string, string> = {};
    if (payload && payload.reason.trim().length > 0) {
      body['reason'] = payload.reason.trim();
      const actor = String(payload.performedBy || '').trim();
      if (actor) body['performedBy'] = actor;
    }
    this.customerService.toggleActive(c.id, body).subscribe({
      next: res => {
        c.isActive = res.isActive;
        c.deactivationReason = res.deactivationReason ?? (res.isActive ? '' : c.deactivationReason);
        c.deactivatedBy = res.deactivatedBy ?? '';
        c.deactivatedAt = res.deactivatedAt ?? null;
        if (this.selectedCustomer?.id === c.id) {
          this.selectedCustomer.isActive = res.isActive;
          this.selectedCustomer.deactivationReason = c.deactivationReason;
          this.selectedCustomer.deactivatedBy = c.deactivatedBy;
          this.selectedCustomer.deactivatedAt = c.deactivatedAt;
        }
        onDone?.();
        this.deactivateSubmitting = false;
      },
      error: err => {
        this.deactivateSubmitting = false;
        this.adminAlert.show({
          title: 'Lỗi',
          message: err?.error?.message || 'Có lỗi xảy ra.',
          isError: true,
        });
      }
    });
  }

  // ── XÓA ──
  onDeleteClick(): void {
    const c = this.customers.find(c => c.selected);
    if (!c) return;
    this.deleteTarget = c;
    this.isDeleteModalOpen = true;
  }
  onDeleteFromDetail(): void {
    if (!this.selectedCustomer) return;
    this.deleteTarget = this.selectedCustomer;
    this.isDeleteModalOpen = true;
  }
  confirmDelete(): void {
    if (!this.deleteTarget) return;
    this.customerService.delete(this.deleteTarget.id).subscribe({
      next: () => {
        this.isDeleteModalOpen = false;
        this.isModalOpen       = false;
        this.deleteTarget      = null;
        this.selectedCustomer  = null;
        this.loadCustomers();
      },
      error: err =>
        this.adminAlert.show({
          title: 'Lỗi xóa',
          message: err?.error?.message || 'Có lỗi khi xóa.',
          isError: true,
        })
    });
  }
  cancelDelete(): void { this.isDeleteModalOpen = false; this.deleteTarget = null; }

  // ── HELPERS ──
  tierLabel(tier: string): string {
    return String(tier || '').toLowerCase() === 'vip' ? 'VIP' : 'Thành viên';
  }

  getTierClass(tier: string): string {
    return String(tier || '').toLowerCase() === 'vip' ? 'tier-vip' : 'tier-member';
  }

  private toRow(c: CustomerItem): CustomerRow {
    return {
      ...c,
      deactivationReason: c.deactivationReason || '',
      deactivatedBy: c.deactivatedBy || '',
      deactivatedAt: c.deactivatedAt ?? null,
      selected: false,
      initials: this.getInitials(c.username),
      avatarBg: this.getAvatarColor(c.username).bg,
      avatarFg: this.getAvatarColor(c.username).fg,
    };
  }
  private getInitials(name: string): string {
    const p = name.trim().split(' ');
    return (p[0][0] + (p[p.length - 1][0] || '')).toUpperCase();
  }
  private getAvatarColor(name: string): { bg: string; fg: string } {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xFFFF;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }
}