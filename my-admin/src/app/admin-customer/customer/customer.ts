import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomerService, CustomerItem } from './customer.service';

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

@Component({
  selector: 'app-customer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer.html',
  styleUrls: ['./customer.css']
})
export class Customer implements OnInit {
  customers: CustomerRow[] = [];
  searchText = '';
  selectedCount = 0;
  isLoading = false;
  errorMsg  = '';

  // Modal detail
  isModalOpen = false;
  selectedCustomer: CustomerRow | null = null;

  // Modal confirm xóa
  isDeleteModalOpen = false;
  deleteTarget: CustomerRow | null = null;

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

  constructor(private customerService: CustomerService) {}

  ngOnInit(): void { this.loadCustomers(); }

  /** Đóng menu khi click ra ngoài vùng .sort-wrap */
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    const t = ev.target as HTMLElement;
    if (t.closest('.sort-wrap')) return;
    this.sortMenuOpen = false;
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

  // ── LOAD ──
  loadCustomers(): void {
    this.isLoading = true;
    this.errorMsg  = '';
    this.customerService.getAll({
      search: this.searchText,
      page:   this.currentPage,
      limit:  this.perPage,
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
      error: err => {
        this.errorMsg  = err?.error?.message || 'Không thể tải danh sách';
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
  onRowClick(c: CustomerRow): void { this.selectedCustomer = c; this.isModalOpen = true; }
  onEditClick(): void {
    const c = this.customers.find(c => c.selected);
    if (c) { this.selectedCustomer = c; this.isModalOpen = true; }
  }
  closeModal(): void { this.isModalOpen = false; this.selectedCustomer = null; }

  // ── TOGGLE ACTIVE ──
  onToggleActive(c: CustomerRow, event?: Event): void {
    event?.stopPropagation();
    this.customerService.toggleActive(c.id).subscribe({
      next: res => {
        c.isActive = res.isActive;
        if (this.selectedCustomer?.id === c.id) this.selectedCustomer.isActive = res.isActive;
      },
      error: err => alert(err?.error?.message || 'Có lỗi xảy ra')
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
      error: err => alert(err?.error?.message || 'Có lỗi khi xóa')
    });
  }
  cancelDelete(): void { this.isDeleteModalOpen = false; this.deleteTarget = null; }

  // ── HELPERS ──
  getTierClass(tier: string): string {
    const map: Record<string, string> = {
      'Đồng': 'tier-dong', 'Bạc': 'tier-bac',
      'Vàng': 'tier-vang', 'Kim Cương': 'tier-kim',
    };
    return map[tier] || 'tier-dong';
  }

  getAvgOrder(): string {
    const c = this.selectedCustomer;
    if (!c || c.totalOrders === 0) return '—';
    return Math.round(c.totalSpent / c.totalOrders).toLocaleString('vi-VN') + 'đ';
  }

  private toRow(c: CustomerItem): CustomerRow {
    return {
      ...c,
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