import { Component, OnInit } from '@angular/core';
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

  // Pagination
  currentPage = 1;
  totalPages = 1;
  total = 0;
  limit = 10;

  // Checkbox
  selectedIds: Set<string> = new Set();
  allChecked = false;

  // Sort
  sortField = '';
  sortDir: 'asc' | 'desc' = 'asc';

  // Filter
  showFilterPanel = false;
  showSortPanel = false;
  filterCat = '';
  filterMinPrice: number | null = null;
  filterMaxPrice: number | null = null;
  filterMinRating: number | null = null;
  categories: string[] = [];

  constructor(private productService: ProductService) {}

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.isLoading = true;
    this.selectedIds.clear();
    this.allChecked = false;

    // Map sort field sang API params
    let sortParam = '';
    if (this.sortField === 'price') sortParam = this.sortDir === 'asc' ? 'price-asc' : 'price-desc';
    else if (this.sortField === 'rating') sortParam = 'rating';
    else if (this.sortField === 'createdAt') sortParam = 'newest';

    this.productService.getProducts(
      this.currentPage, this.limit,
      this.filterCat, sortParam,
      this.filterMinPrice ?? undefined,
      this.filterMaxPrice ?? undefined,
      this.filterMinRating ?? undefined
    ).subscribe({
      next: (res) => {
        this.products = res.products;
        this.applySearch();
        this.total = res.total;
        this.totalPages = res.totalPages;
        this.isLoading = false;
        // Lấy danh sách category từ trang đầu
        if (this.categories.length === 0) {
          this.categories = [...new Set(res.products.map(p => p.cat))];
        }
      },
      error: (err) => { console.error(err); this.isLoading = false; }
    });
  }

  // Chỉ search client-side trên trang hiện tại
  applySearch() {
    if (!this.searchText) {
      this.filteredProducts = [...this.products];
      return;
    }
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
    this.currentPage = 1;
    this.loadProducts();
  }

  // ── FILTER ── server-side
  applyFilterPanel() {
    this.showFilterPanel = false;
    this.currentPage = 1;
    this.loadProducts();
  }

  resetFilter() {
    this.filterCat = '';
    this.filterMinPrice = null;
    this.filterMaxPrice = null;
    this.filterMinRating = null;
    this.currentPage = 1;
    this.loadProducts();
  }

  // ── CRUD ──
  addProduct() { this.selectedProduct = null; this.isModalOpen = true; }

  editProduct(p: Product) {
    if (this.selectedCount > 1) return;
    this.selectedProduct = { ...p };
    this.isModalOpen = true;
  }

  editSelected() {
    if (this.selectedCount !== 1) return;
    const id = [...this.selectedIds][0];
    const p = this.filteredProducts.find(p => p._id === id);
    if (p) { this.selectedProduct = { ...p }; this.isModalOpen = true; }
  }

  deleteSelected() {
    if (!confirm(`Xóa ${this.selectedCount} sản phẩm đã chọn?`)) return;
    const ids = [...this.selectedIds];
    Promise.all(ids.map(id => this.productService.delete(id).toPromise()))
      .then(() => this.loadProducts());
  }

  deleteProduct(p: Product) {
    if (!confirm(`Xóa "${p.name}"?`)) return;
    this.productService.delete(p._id!).subscribe({ next: () => this.loadProducts() });
  }

  onFormSave() { this.isModalOpen = false; this.loadProducts(); }
  onFormCancel() { this.isModalOpen = false; }

  changePage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadProducts();
  }
}