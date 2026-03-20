import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService, Product } from '../product.service';
import { ProductFormComponent } from '../product-form/product-form';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductFormComponent],
  templateUrl: './product.html',
  styleUrls: ['./product.css']
})
export class ProductComponent implements OnInit {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  searchText = '';
  isModalOpen = false;
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
  categories: string[] = [];
  get hasActiveFilter(): boolean {
    return !!(
      this.filterCat ||
      this.filterMinPrice != null ||
      this.filterMaxPrice != null ||
      this.filterMinRating != null
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
    return parts.join(' · ');
  }

  // ── SẮP XẾP (dropdown kiểu admin-customer) ──
  sortMenuOpen = false;

  constructor(private productService: ProductService) {}

  ngOnInit() { this.loadProducts(); }

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
            this.sortDir === 'asc' ? a.stock - b.stock : b.stock - a.stock
          );
        }

        this.products = products;
        this.applySearch();
        this.total      = res.total;
        this.totalPages = res.totalPages;
        this.isLoading  = false;

        if (this.categories.length === 0) {
          this.categories = [...new Set(res.products.map(p => p.cat))];
        }
      },
      error: (err) => { console.error(err); this.isLoading = false; }
    });
  }

  applySearch() {
    if (!this.searchText) { this.filteredProducts = [...this.products]; return; }
    const kw = this.searchText.toLowerCase();
    this.filteredProducts = this.products.filter(p =>
      p.name.toLowerCase().includes(kw) || p.cat.toLowerCase().includes(kw)
    );
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

  get selectedCount() { return this.selectedIds.size; }

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
    this.currentPage    = 1;
    this.loadProducts();
  }

  // ── CRUD & ACTIONS ──
  addProduct() { this.selectedProduct = null; this.isModalOpen = true; }

  editProduct(p: Product) {
    this.selectedProduct = { ...p };
    this.isModalOpen = true;
  }

  editSelected() {
    if (this.selectedCount !== 1) return;
    const id = [...this.selectedIds][0];
    const p  = this.filteredProducts.find(x => x._id === id);
    if (p) { this.selectedProduct = { ...p }; this.isModalOpen = true; }
  }

  /** Ẩn/hiện 1 sản phẩm từ nút inline trong bảng */
  toggleHidden(p: Product) {
    // Soft delete theo yêu cầu: đổi label UI sang "Xóa/Hiển thị" nhưng vẫn dùng toggle-hidden.
    const action = p.isHidden ? 'hiển thị' : 'xóa';
    const verb = p.isHidden ? 'Hiển thị' : 'Xóa';
    const warning = p.isHidden
      ? 'Sản phẩm sẽ trở lại trạng thái đang hiển thị trong admin/user.'
      : 'Sản phẩm sẽ bị ẩn khỏi hệ thống (có thể khôi phục bằng nút "Hiển thị").';
    if (
      !confirm(`${verb} sản phẩm "${p.name}"?\n\n${warning}`)
    ) return;
    this.productService.toggleHidden(p._id!).subscribe({
      next: (res) => {
        // Cập nhật local để không cần reload toàn trang
        p.isHidden = res.isHidden;
        this.applySearch();
      },
      error: (err) => console.error(err)
    });
  }

  /** Ẩn nhiều sản phẩm đã chọn */
  hideSelected() {
    if (!confirm(`Xóa (ẩn) ${this.selectedCount} sản phẩm đã chọn khỏi hệ thống?\n\nCó thể khôi phục bằng "Hiển thị".`)) return;
    const ids = [...this.selectedIds];
    Promise.all(ids.map(id => this.productService.toggleHidden(id).toPromise()))
      .then(() => this.loadProducts());
  }

  /** Toggle Tạm hết hàng thủ công */
  toggleOutOfStock(p: Product) {
    const action = p.isOutOfStock ? "bỏ tạm hết hàng" : "bật tạm hết hàng";
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} cho "${p.name}"?`)) return;
    this.productService.toggleOutOfStock(p._id!).subscribe({
      next: (res) => { p.isOutOfStock = res.isOutOfStock; this.applySearch(); },
      error: (err) => console.error(err)
    });
  }

  onFormSave()   { this.isModalOpen = false; this.loadProducts(); }
  onFormCancel() { this.isModalOpen = false; }

  changePage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadProducts();
  }
}