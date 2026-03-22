import { Component, Output, EventEmitter, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-consulting-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './consulting-list.html',
  styleUrls: ['./consulting-list.css']
})
export class ConsultingList implements OnInit {
  @Output() selectProduct = new EventEmitter<any>();

  // Dữ liệu gốc và dữ liệu hiển thị
  products: any[] = [];
  filteredProducts: any[] = [];
  categories: any[] = []; // Chứa danh sách category từ Database

  // Trạng thái bộ lọc và sắp xếp
  searchText: string = '';
  filterStatus: 'all' | 'pending' | 'answered' = 'all';
  sortBy: string = 'pending-desc'; 
  selectedCat: string = '';

  // Trạng thái hiển thị giao diện
  isLoading: boolean = true;
  showCatDropdown: boolean = false;
  showSortDropdown: boolean = false;

  // Thống kê cho 3 thẻ đầu trang
  summary = {
    total: 0,
    pending: 0,
    answered: 0
  };

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  /**
   * Đóng các menu dropdown khi nhấn chuột ra ngoài vùng điều khiển
   */
  @HostListener('document:click', ['$event'])
  clickout(event: any) {
    if (!event.target.closest('.custom-dropdown-container')) {
      this.showCatDropdown = false;
      this.showSortDropdown = false;
    }
  }

  /**
   * Tải song song Danh mục và Dữ liệu tư vấn
   */
  loadData(): void {
    this.isLoading = true;

    // 1. Tải danh mục thực tế từ Database
    this.api.getCategories().subscribe({
      next: (res: any[]) => {
        this.categories = res || [];
        this.cdr.detectChanges();
      },
      error: (err: any) => console.error('Lỗi tải danh mục:', err)
    });

    // 2. Tải danh sách tóm tắt tư vấn
    this.api.getConsultingSummary().subscribe({
      next: (res: any[]) => {
        this.products = res || [];
        this.calculateGlobalStats();
        this.applyFilters();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Lỗi tải tóm tắt tư vấn:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Tính toán tổng số câu hỏi cho các thẻ Summary Cards
   */
  calculateGlobalStats(): void {
    this.summary.total = this.products.reduce((sum, p) => sum + (Number(p.total) || 0), 0);
    this.summary.pending = this.products.reduce((sum, p) => sum + (Number(p.pending) || 0), 0);
    this.summary.answered = this.products.reduce((sum, p) => sum + (Number(p.answered) || 0), 0);
  }

  /**
   * HÀM CORE: Áp dụng tất cả bộ lọc (Search + Status + Category) và Sắp xếp
   */
  applyFilters(): void {
    let temp = [...this.products];

    // 1. Lọc theo văn bản tìm kiếm (Tên sản phẩm hoặc SKU)
    const term = this.searchText.toLowerCase().trim();
    if (term) {
      temp = temp.filter(p => 
        (p.name && p.name.toLowerCase().includes(term)) || 
        (p.sku && p.sku.toLowerCase().includes(term))
      );
    }

    // 2. Lọc theo trạng thái từ thẻ Summary Card
    if (this.filterStatus === 'pending') {
      temp = temp.filter(p => (Number(p.pending) || 0) > 0);
    } else if (this.filterStatus === 'answered') {
      temp = temp.filter(p => (Number(p.pending) || 0) === 0 && (Number(p.total) || 0) > 0);
    }

    // 3. Lọc theo danh mục sản phẩm (So khớp với tên danh mục)
    if (this.selectedCat) {
      temp = temp.filter(p => p.cat === this.selectedCat);
    }

    // 4. LOGIC SẮP XẾP ƯU TIÊN
    temp.sort((a, b) => {
      // LUÔN ƯU TIÊN: Sản phẩm có câu hỏi đang chờ trả lời sẽ nhảy lên đầu danh sách
      const aHasPending = (Number(a.pending) || 0) > 0;
      const bHasPending = (Number(b.pending) || 0) > 0;

      if (aHasPending && !bHasPending) return -1;
      if (!aHasPending && bHasPending) return 1;

      // Nếu cả hai cùng trạng thái, sắp xếp theo lựa chọn của User
      switch (this.sortBy) {
        case 'total-desc':
          return (Number(b.total) || 0) - (Number(a.total) || 0);
        case 'pending-desc':
          return (Number(b.pending) || 0) - (Number(a.pending) || 0);
        case 'name-asc':
          return (a.name || '').localeCompare(b.name || '');
        default:
          return 0;
      }
    });

    this.filteredProducts = temp;
    this.cdr.detectChanges();
  }

  /**
   * Sự kiện khi nhấn vào các thẻ thống kê đầu trang
   */
  setFilterStatus(status: 'all' | 'pending' | 'answered'): void {
    this.filterStatus = status;
    this.applyFilters();
  }

  /**
   * Xử lý tìm kiếm: Chạy khi nhấn Enter hoặc khi xóa sạch từ khóa
   */
  onSearch(): void {
    this.applyFilters();
  }

  /**
   * Chọn danh mục từ Custom Dropdown
   */
  selectCategory(catName: string): void {
    this.selectedCat = catName;
    this.showCatDropdown = false;
    this.applyFilters();
  }

  /**
   * Chọn kiểu sắp xếp từ Custom Dropdown
   */
  selectSort(sortKey: string): void {
    this.sortBy = sortKey;
    this.showSortDropdown = false;
    this.applyFilters();
  }

  /**
   * Trả về nhãn hiển thị cho nút Sort
   */
  getSortLabel(): string {
    const labels: any = {
      'pending-desc': 'Chờ trả lời · Nhiều nhất',
      'total-desc': 'Tổng câu hỏi · Cao → Thấp',
      'name-asc': 'Tên sản phẩm · A → Z'
    };
    return labels[this.sortBy] || 'Sắp xếp';
  }

  /**
   * Đặt lại tất cả các bộ lọc về mặc định
   */
  resetFilters(): void {
    this.searchText = '';
    this.filterStatus = 'all';
    this.selectedCat = '';
    this.sortBy = 'pending-desc';
    this.applyFilters();
  }

  /**
   * Reset riêng ô tìm kiếm
   */
  resetSearch(): void {
    this.searchText = '';
    this.applyFilters();
  }
}