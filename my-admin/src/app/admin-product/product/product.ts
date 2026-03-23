import { Component, HostListener, OnInit, ViewChild, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ProductService, Product, ADMIN_STATIC_BASE } from '../product.service';
import { ProductFormComponent } from '../product-form/product-form';
import { CategoryAdminService, AdminCategoryRow } from '../category-admin.service';
import { buildProductClassificationSummary } from '../product-classification-summary.util';
import { AdminNavBridgeService } from '../../admin-nav-bridge.service';
import { AdminAlertModalService } from '../../admin-alert-modal/admin-alert-modal.service';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductFormComponent],
  templateUrl: './product.html',
  styleUrls: ['./product.css']
})
export class ProductComponent implements OnInit {
  /** Form chi tiết SP — tránh đóng editor do ghost-click sau hộp thoại chọn file (Chrome/Windows). */
  @ViewChild(ProductFormComponent) private productFormRef?: ProductFormComponent;

  readonly staticBase = ADMIN_STATIC_BASE;
  products: Product[] = [];
  filteredProducts: Product[] = [];
  searchText = '';
  isEditorPageOpen = false;
  selectedProduct: Product | null = null;
  isLoading = false;

  // Pagination — 50 sản phẩm mỗi trang
  currentPage = 1;
  totalPages  = 1;
  total       = 0;
  limit       = 50;

  // Checkbox
  selectedIds: Set<string> = new Set();
  allChecked = false;

  private readonly destroyRef = inject(DestroyRef);
  private readonly navBridge = inject(AdminNavBridgeService);

  // Sort
  sortField = '';
  sortDir: 'asc' | 'desc' = 'asc';

  // Filter
  showFilterPanel = false;
  showSortPanel   = false;
  filterCat       = '';
  filterMinPrice: number | null = null;
  filterMaxPrice: number | null = null;
  filterMinRating: number | null = null;
  filterSaleStatus: '' | 'selling' | 'out' = '';
  filterVisibility: '' | 'visible' | 'hidden' = '';

  /** Tên DM cho bộ lọc (mọi DM trong DB — kể cả đã vô hiệu). */
  filterCategoryNames: string[] = [];
  /** Tên DM đang active — truyền vào form thêm/sửa SP. */
  formCategoryNames: string[] = [];

  /** Modal quản lý danh mục — bảng đầy đủ từ GET admin/categories. */
  showCategoryModal = false;
  categoryModalLoading = false;
  categoryModalBusy = false;
  adminCategoryRows: AdminCategoryRow[] = [];
  /** Tên DM mới trong modal (POST). */
  newCategoryName = '';
  get hasActiveFilter(): boolean {
    return !!(
      this.filterCat ||
      this.filterMinPrice != null ||
      this.filterMaxPrice != null ||
      this.filterMinRating != null ||
      this.filterSaleStatus ||
      this.filterVisibility
    );
  }

  get filterLabelShort(): string {
    if (!this.hasActiveFilter) return 'Mặc định';
    const parts: string[] = [];
    if (this.filterCat) parts.push(`Cat: ${this.filterCat}`);
    if (this.filterMinPrice != null || this.filterMaxPrice != null) {
      const a = this.filterMinPrice != null ? this.filterMinPrice : '0';
      const b = this.filterMaxPrice != null ? this.filterMaxPrice : '∞';
      parts.push(`Giá: ${a}-${b}`);
    }
    if (this.filterMinRating != null) parts.push(`⭐ ${this.filterMinRating}+`);
    if (this.filterSaleStatus === 'selling') parts.push('Đang bán');
    if (this.filterSaleStatus === 'out') parts.push('Tạm hết');
    if (this.filterVisibility === 'visible') parts.push('Hiển thị');
    if (this.filterVisibility === 'hidden') parts.push('Ẩn');
    return parts.join(' · ');
  }

  // Modal xác nhận dùng thay cho confirm() để đồng bộ UX.
  showConfirmModal = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmDanger = false;
  private confirmAction: (() => void) | null = null;

  /**
   * Modal từ nút toolbar "Xóa": Hủy | Vô hiệu hóa (ẩn) | Xác nhận xóa (vĩnh viễn).
   */
  isBulkDeleteChoiceModalOpen = false;
  bulkToolbarSubmitting = false;

  // ── SẮP XẾP (dropdown kiểu admin-customer) ──
  sortMenuOpen = false;

  constructor(
    private productService: ProductService,
    private categoryAdmin: CategoryAdminService,
    private adminAlert: AdminAlertModalService,
  ) {}

  ngOnInit() {
    // Mở form sản phẩm khi bấm thông báo đánh giá mới.
    this.navBridge.openProductEditor$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((productId: string) => {
        if (!productId) return;
        this.productService.getById(productId, true).subscribe({
          next: (p) => this.editProduct(p),
          error: (err) => console.error('openProductEditor', err),
        });
      });
    this.loadProducts();
    this.loadAdminCategories();
  }

  /**
   * Đồng bộ danh mục từ API admin (đếm SP + trạng thái).
   * Form SP chỉ nhận DM active; lọc danh sách dùng mọi tên đã đăng ký.
   */
  loadAdminCategories(): void {
    this.categoryAdmin.list().subscribe({
      next: (rows) => this.applyAdminCategoryRows(rows),
      error: (err) => console.error('loadAdminCategories', err),
    });
  }

  /** Gán mảng từ server — dùng chung sau GET và sau CRUD trong modal. */
  private applyAdminCategoryRows(rows: AdminCategoryRow[]): void {
    this.adminCategoryRows = rows;
    const names = rows.map((r) => String(r.name || '').trim()).filter(Boolean);
    this.filterCategoryNames = [...new Set(names)].sort((a, b) => a.localeCompare(b, 'vi'));
    this.formCategoryNames = rows
      .filter((r) => r.isActive)
      .map((r) => r.name)
      .sort((a, b) => a.localeCompare(b, 'vi'));
  }

  openCategoryModal(): void {
    this.showCategoryModal = true;
    this.newCategoryName = '';
    this.categoryModalLoading = true;
    this.categoryAdmin.list().subscribe({
      next: (rows) => {
        this.applyAdminCategoryRows(rows);
        this.categoryModalLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.categoryModalLoading = false;
      },
    });
  }

  closeCategoryModal(): void {
    if (this.categoryModalBusy) return;
    this.showCategoryModal = false;
  }

  submitNewCategoryInModal(): void {
    const name = String(this.newCategoryName || '').trim();
    if (name.length < 2) return;
    this.categoryModalBusy = true;
    this.categoryAdmin.create({ name }).subscribe({
      next: () => {
        this.newCategoryName = '';
        this.reloadModalCategoriesAfterMutation();
      },
      error: (err) => {
        console.error(err);
        this.categoryModalBusy = false;
        this.adminAlert.show({
          title: 'Lỗi',
          message: err?.error?.message || 'Không thêm được danh mục.',
          isError: true,
        });
      },
    });
  }

  deactivateCategoryRow(row: AdminCategoryRow): void {
    this.openConfirmModal(
      'Vô hiệu hóa danh mục',
      `Danh mục "${row.name}" sẽ ẩn khỏi site user và khỏi form thêm SP. Sản phẩm hiện tại giữ nguyên trường danh mục.`,
      false,
      () => {
        this.categoryModalBusy = true;
        this.categoryAdmin.deactivate(row._id).subscribe({
          next: () => this.reloadModalCategoriesAfterMutation(),
          error: (e) => {
            console.error(e);
            this.categoryModalBusy = false;
            this.adminAlert.show({
              title: 'Lỗi',
              message: e?.error?.message || 'Lỗi vô hiệu hóa.',
              isError: true,
            });
          },
        });
      },
    );
  }

  restoreCategoryRow(row: AdminCategoryRow): void {
    this.categoryModalBusy = true;
    this.categoryAdmin.restore(row._id).subscribe({
      next: () => this.reloadModalCategoriesAfterMutation(),
      error: (e) => {
        console.error(e);
        this.categoryModalBusy = false;
        this.adminAlert.show({
          title: 'Lỗi',
          message: e?.error?.message || 'Lỗi khôi phục.',
          isError: true,
        });
      },
    });
  }

  /**
   * Xóa vĩnh viễn chỉ khi productCount === 0 (backend cũng chặn).
   * Có SP thì chỉ được vô hiệu hóa — đã cảnh báo ở UI.
   */
  deleteCategoryRow(row: AdminCategoryRow): void {
    if (row.productCount > 0) {
      this.adminAlert.show({
        title: 'Không thể xóa vĩnh viễn',
        message: `Danh mục "${row.name}" còn ${row.productCount} sản phẩm — chỉ có thể vô hiệu hóa, không xóa vĩnh viễn.`,
        isError: true,
      });
      return;
    }
    this.openConfirmModal(
      'Xóa vĩnh viễn danh mục',
      `Xóa hẳn "${row.name}" khỏi hệ thống? Thao tác không hoàn tác.`,
      true,
      () => {
        this.categoryModalBusy = true;
        this.categoryAdmin.delete(row._id).subscribe({
          next: () => this.reloadModalCategoriesAfterMutation(),
          error: (e) => {
            console.error(e);
            this.categoryModalBusy = false;
            this.adminAlert.show({
              title: 'Lỗi xóa',
              message: e?.error?.message || 'Không xóa được (có thể vẫn còn SP gắn tên này).',
              isError: true,
            });
          },
        });
      },
    );
  }

  private reloadModalCategoriesAfterMutation(): void {
    this.categoryAdmin.list().subscribe({
      next: (rows) => {
        this.applyAdminCategoryRows(rows);
        this.categoryModalBusy = false;
        this.loadProducts();
      },
      error: (err) => {
        console.error(err);
        this.categoryModalBusy = false;
      },
    });
  }

  /** Đóng menu Sắp xếp khi click ra ngoài */
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    const t = ev.target as HTMLElement;
    if (t.closest('.sort-wrap')) return;
    this.sortMenuOpen = false;
  }

  toggleSortMenu(): void {
    this.showFilterPanel = false;
    this.sortMenuOpen = !this.sortMenuOpen;
  }

  isSortActive(by: string, dir: 'asc' | 'desc'): boolean {
    return this.sortField === by && this.sortDir === dir;
  }

  get sortLabelShort(): string {
    const key = `${this.sortField}|${this.sortDir}`;
    const map: Record<string, string> = {
      'price|asc': 'Giá thấp',
      'price|desc': 'Giá cao',
      'rating|desc': 'Đánh giá cao',
      'rating|asc': 'Đánh giá thấp',
      'updatedAt|desc': 'Mới nhất',
      'updatedAt|asc': 'Cũ nhất',
      'stock|desc': 'Tồn nhiều',
      'stock|asc': 'Tồn ít',
    };
    return map[key] || 'Mặc định';
  }

  /**
   * Áp dụng sắp xếp theo backend (price/rating/updatedAt) hoặc client-side (stock).
   * Đóng dropdown và reset trang về 1.
   */
  applySort(by: string, dir: 'asc' | 'desc'): void {
    this.sortField = by;
    this.sortDir = dir;
    this.sortMenuOpen = false;
    this.showFilterPanel = false;
    this.currentPage = 1;
    this.loadProducts();
  }

  loadProducts() {
    this.isLoading = true;
    this.selectedIds.clear();
    this.allChecked = false;

    let sortParam = '';
    if (this.sortField === 'price') {
      sortParam = this.sortDir === 'asc' ? 'price-asc' : 'price-desc';
    } else if (this.sortField === 'rating') {
      sortParam = this.sortDir === 'asc' ? 'rating-asc' : 'rating';
    } else if (this.sortField === 'updatedAt') {
      sortParam = this.sortDir === 'asc' ? 'updated-asc' : 'updated';
    } else if (this.sortField === 'stock') {
      sortParam = ''; // sort client-side cho stock
    } else {
      sortParam = ''; // mặc định
    }

    this.productService.getProducts(
      this.currentPage,
      this.limit,
      this.filterCat,
      sortParam,
      this.filterMinPrice  ?? undefined,
      this.filterMaxPrice  ?? undefined,
      this.filterMinRating ?? undefined,
      true   // isAdmin = true → thấy cả sản phẩm ẩn
    ).subscribe({
      next: (res) => {
        let products = res.products;

        // Sort stock client-side (API chưa hỗ trợ)
        if (this.sortField === 'stock') {
          products = [...products].sort((a, b) =>
            this.sortDir === 'asc'
              ? this.stockOf(a) - this.stockOf(b)
              : this.stockOf(b) - this.stockOf(a)
          );
        }

        this.products = products;
        this.applySearch();
        this.total      = res.total;
        this.totalPages = res.totalPages;
        this.isLoading  = false;
      },
      error: (err) => { console.error(err); this.isLoading = false; }
    });
  }

  applySearch() {
    const kw = this.searchText.trim().toLowerCase();
    this.filteredProducts = this.products.filter((p) => {
      const matchSearch = !kw || p.name.toLowerCase().includes(kw) || p.cat.toLowerCase().includes(kw);
      const matchSaleStatus =
        !this.filterSaleStatus ||
        (this.filterSaleStatus === 'selling' ? (!p.isHidden && !this.isEffectiveOutOfStock(p)) : this.isEffectiveOutOfStock(p));
      const matchVisibility =
        !this.filterVisibility ||
        (this.filterVisibility === 'visible' ? !p.isHidden : !!p.isHidden);
      return matchSearch && matchSaleStatus && matchVisibility;
    });
    this.allChecked = this.filteredProducts.length > 0 && this.filteredProducts.every(p => this.selectedIds.has(p._id!));
  }

  onSearch() { this.applySearch(); }

  // ── CHECKBOX ──
  toggleAll(checked: boolean) {
    this.allChecked = checked;
    if (checked) this.filteredProducts.forEach(p => this.selectedIds.add(p._id!));
    else this.selectedIds.clear();
  }

  toggleOne(id: string, checked: boolean) {
    checked ? this.selectedIds.add(id) : this.selectedIds.delete(id);
    this.allChecked = this.filteredProducts.every(p => this.selectedIds.has(p._id!));
  }
  onRowClick(p: Product): void {
    this.editProduct(p);
  }

  get selectedCount() { return this.selectedIds.size; }

  /**
   * Trong nhóm đã chọn: bao nhiêu SP đang hiển thị (còn “vô hiệu hóa” = ẩn được).
   * Chọn lộn ẩn + hiện → chỉ những cái đang hiện mới bị toggle-hidden.
   */
  get bulkVisibleSelectedCount(): number {
    return this.selectedVisibleProductIds().length;
  }

  /** SP đã chọn nhưng đã ẩn — thao tác vô hiệu hóa hàng loạt bỏ qua. */
  get bulkHiddenSelectedCount(): number {
    return Math.max(0, this.selectedCount - this.bulkVisibleSelectedCount);
  }

  /** Tooltip nút Vô hiệu hóa trên toolbar. */
  get bulkDisableToolbarTitle(): string {
    if (this.selectedCount < 1) return '';
    if (this.bulkVisibleSelectedCount === 0) {
      return 'Tất cả sản phẩm đã chọn đang ẩn — không có gì để vô hiệu hóa thêm. Bật lại bằng nút Hiển thị trên từng dòng.';
    }
    if (this.bulkHiddenSelectedCount > 0) {
      return `Sẽ ẩn ${this.bulkVisibleSelectedCount} SP đang hiển thị; ${this.bulkHiddenSelectedCount} SP đã ẩn được bỏ qua.`;
    }
    return 'Ẩn khỏi cửa hàng — có thể hiện lại sau';
  }

  // ── SORT ── server-side
  setSort(field: string) {
    if (this.sortField === field) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortField = field; this.sortDir = 'asc'; }
    this.showSortPanel = false;
    this.currentPage   = 1;
    this.loadProducts();
  }

  // ── FILTER ──
  applyFilterPanel() { this.showFilterPanel = false; this.currentPage = 1; this.loadProducts(); }

  resetFilter() {
    this.filterCat      = '';
    this.filterMinPrice = null;
    this.filterMaxPrice = null;
    this.filterMinRating = null;
    this.filterSaleStatus = '';
    this.filterVisibility = '';
    this.currentPage    = 1;
    this.loadProducts();
  }

  // ── CRUD & ACTIONS ──
  addProduct() {
    this.selectedProduct = null;
    this.isEditorPageOpen = true;
  }

  editProduct(p: Product) {
    this.selectedProduct = { ...p };
    this.isEditorPageOpen = true;
  }

  editSelected() {
    if (this.selectedCount !== 1) return;
    const id = [...this.selectedIds][0];
    const p  = this.filteredProducts.find(x => x._id === id);
    if (p) { this.selectedProduct = { ...p }; this.isEditorPageOpen = true; }
  }

  /** Ẩn/hiện 1 sản phẩm từ nút inline trong bảng */
  toggleHidden(p: Product) {
    const verb = p.isHidden ? 'Hiển thị' : 'Xóa';
    const warning = p.isHidden
      ? 'Sản phẩm sẽ trở lại trạng thái đang hiển thị trong admin/user.'
      : 'Sản phẩm sẽ bị ẩn khỏi hệ thống (có thể khôi phục bằng nút "Hiển thị").';
    this.openConfirmModal(
      `${verb} sản phẩm`,
      `Bạn có chắc muốn ${verb.toLowerCase()} sản phẩm "${p.name}"?\n\n${warning}`,
      !p.isHidden,
      () => {
        this.productService.toggleHidden(p._id!).subscribe({
          next: (res) => {
            p.isHidden = res.isHidden;
            this.applySearch();
          },
          error: (err) => console.error(err)
        });
      }
    );
  }

  /** Mở modal cảnh báo khi bấm "Xóa" trên toolbar (nhiều hoặc 1 SP). */
  openBulkDeleteChoiceModal(): void {
    if (this.selectedCount < 1) return;
    this.isBulkDeleteChoiceModalOpen = true;
  }

  closeBulkDeleteChoiceModal(): void {
    if (this.bulkToolbarSubmitting) return;
    this.isBulkDeleteChoiceModalOpen = false;
  }

  /** Trong modal "Xóa": chỉ ẩn (vô hiệu hóa) các SP đang hiển thị. */
  executeBulkDisableFromChoiceModal(): void {
    const ids = this.selectedVisibleProductIds();
    if (!ids.length) {
      this.isBulkDeleteChoiceModalOpen = false;
      const n = this.selectedCount;
      this.openConfirmModal(
        'Không thể vô hiệu hóa thêm',
        n === 1
          ? 'Sản phẩm đã chọn đang ẩn. Không có gì để vô hiệu hóa — dùng nút Hiển thị trên dòng đó nếu muốn bật lại.'
          : `Cả ${n} sản phẩm đã chọn đều đang ẩn. Không có gì để vô hiệu hóa thêm — dùng nút Hiển thị trên từng dòng nếu muốn bật lại.`,
        false,
        () => {}
      );
      return;
    }
    this.runBulkDisable(() => {
      this.isBulkDeleteChoiceModalOpen = false;
    });
  }

  /** Trong modal "Xóa": xóa vĩnh viễn mọi ID đã chọn. */
  executeBulkPermanentDeleteFromModal(): void {
    const ids = [...this.selectedIds];
    if (!ids.length || this.bulkToolbarSubmitting) return;
    this.bulkToolbarSubmitting = true;
    forkJoin(ids.map((id) => this.productService.delete(id))).subscribe({
      next: () => {
        this.bulkToolbarSubmitting = false;
        this.isBulkDeleteChoiceModalOpen = false;
        this.loadProducts();
      },
      error: (err) => {
        console.error(err);
        this.bulkToolbarSubmitting = false;
      },
    });
  }

  /**
   * Nút toolbar "Vô hiệu hóa": xác nhận rồi ẩn hàng loạt (chỉ SP đang hiển thị).
   */
  openBulkDisableToolbarConfirm(): void {
    if (this.selectedCount < 1) return;
    const visibleIds = this.selectedVisibleProductIds();
    if (!visibleIds.length) {
      const n = this.selectedCount;
      this.openConfirmModal(
        'Vô hiệu hóa',
        n === 1
          ? 'Sản phẩm đã chọn đang ẩn. Không có gì để vô hiệu hóa thêm.'
          : `Cả ${n} sản phẩm đã chọn đều đang ẩn. Không có gì để vô hiệu hóa thêm.`,
        false,
        () => {}
      );
      return;
    }
    const skipped = this.bulkHiddenSelectedCount;
    let body = `Ẩn ${visibleIds.length} sản phẩm đang hiển thị khỏi cửa hàng?\n\nBạn có thể bật lại sau bằng nút Hiển thị trên từng dòng.`;
    if (skipped > 0) {
      body += `\n\n(${skipped} sản phẩm đã ẩn trong nhóm đã chọn sẽ được bỏ qua — không đổi.)`;
    }
    this.openConfirmModal('Vô hiệu hóa sản phẩm', body, false, () => this.runBulkDisable());
  }

  /** ID đã chọn mà hiện đang không ẩn — mới gọi toggle-hidden để ẩn. */
  private selectedVisibleProductIds(): string[] {
    return [...this.selectedIds].filter((id) => {
      const p = this.filteredProducts.find((x) => x._id === id);
      return !!p && !p.isHidden;
    });
  }

  /** Gọi API ẩn lần lượt các SP đang hiển thị trong nhóm đã chọn. */
  private runBulkDisable(afterClose?: () => void): void {
    const ids = this.selectedVisibleProductIds();
    if (!ids.length) {
      afterClose?.();
      return;
    }
    this.bulkToolbarSubmitting = true;
    forkJoin(ids.map((id) => this.productService.toggleHidden(id))).subscribe({
      next: () => {
        this.bulkToolbarSubmitting = false;
        afterClose?.();
        this.loadProducts();
      },
      error: (err) => {
        console.error(err);
        this.bulkToolbarSubmitting = false;
      },
    });
  }

  /** Toggle Tạm hết hàng thủ công */
  toggleOutOfStock(p: Product) {
    const action = p.isOutOfStock ? 'Bỏ tạm hết hàng' : 'Bật tạm hết hàng';
    this.openConfirmModal(
      action,
      `Bạn có chắc muốn ${action.toLowerCase()} cho sản phẩm "${p.name}"?`,
      false,
      () => {
        this.productService.toggleOutOfStock(p._id!).subscribe({
          next: (res) => { p.isOutOfStock = res.isOutOfStock; this.applySearch(); },
          error: (err) => console.error(err)
        });
      }
    );
  }

  openConfirmModal(title: string, message: string, danger: boolean, action: () => void): void {
    this.confirmTitle = title;
    this.confirmMessage = message;
    this.confirmDanger = danger;
    this.confirmAction = action;
    this.showConfirmModal = true;
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.confirmAction = null;
  }

  executeConfirmAction(): void {
    if (this.confirmAction) this.confirmAction();
    this.closeConfirmModal();
  }

  /**
   * Đóng trang editor; bỏ qua nếu vừa đóng hộp thoại upload ảnh (Chrome/Windows hay bắn thêm 1 click).
   */
  private closeProductEditor(): void {
    if (this.productFormRef?.isFilePickerGhostGuardActive?.()) return;
    this.isEditorPageOpen = false;
  }

  onFormCancel() {
    this.closeProductEditor();
  }

  onBackToList(): void {
    this.closeProductEditor();
  }

  onFormSave() {
    this.isEditorPageOpen = false;
    this.loadProducts();
    this.loadAdminCategories();
  }

  // Tính tồn kho thực tế: nếu có variants thì lấy tổng stock của variants.
  stockOf(p: Product): number {
    if (Array.isArray(p.variants) && p.variants.length > 0) {
      return p.variants.reduce((sum, v) => sum + Number(v?.stock || 0), 0);
    }
    return Number(p.stock || 0);
  }

  /**
   * Chuỗi phân loại biến thể (khớp form chỉnh sửa) — dùng cho cột bảng, không lẫn với danh mục `cat`.
   */
  classificationSummaryForList(p: Product): string {
    return buildProductClassificationSummary(p);
  }

  /**
   * Giá hiển thị trên bảng: ưu tiên biến thể đang bán có giá > 0 (min), fallback dòng đầu / price cấp SP.
   * Tránh lệch với form khi `p.price` chưa sync hoặc = 0.
   */
  adminListDisplayPrice(p: Product): number {
    const vs = p.variants || [];
    if (!vs.length) return Number(p.price || 0);
    const active = vs.filter((v) => v.isActive !== false);
    const src = active.length ? active : vs;
    const priced = src.map((v) => Number(v.price || 0)).filter((x) => x > 0);
    if (priced.length) return Math.min(...priced);
    return Number(src[0]?.price ?? p.price ?? 0);
  }

  isEffectiveOutOfStock(p: Product): boolean {
    return !!p.isOutOfStock || this.stockOf(p) <= 0;
  }

  changePage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadProducts();
  }
}