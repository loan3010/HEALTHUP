import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Blog } from './blog.model';

@Component({
  selector: 'app-blog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './blog.html',
  styleUrls: ['./blog.css']
})
export class BlogComponent implements OnInit {

  // --- DỮ LIỆU GỐC ---
  allBlogs: Blog[] = [];          // Danh sách gốc (đã loại trừ bài nổi bật)
  filteredBlogs: Blog[] = [];     // Danh sách sau khi lọc và sắp xếp
  displayedBlogs: Blog[] = [];    // Danh sách hiển thị theo phân trang
  featuredBlog: Blog | null = null; // Bài viết có lượt xem cao nhất

  // --- BỘ LỌC VÀ TÌM KIẾM ---
  tags: string[] = [];
  selectedTag: string = 'Tất cả';
  searchQuery: string = '';

  // --- TRẠNG THÁI SẮP XẾP ---
  sortBy: string = 'newest';      // Mặc định: Mới đăng nhất
  showSortMenu: boolean = false;

  // --- PHÂN TRANG & TRẠNG THÁI TẢI ---
  pageSize: number = 6;
  currentCount: number = 6;
  loading: boolean = true;

  private apiUrl = 'http://localhost:3000/api/blogs';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loading = true;

    this.http.get<Blog[]>(this.apiUrl).subscribe({
      next: (data) => {
        const blogs = Array.isArray(data) ? data : [];

        if (blogs.length > 0) {
          // 1. Tìm "vị vua lượt xem" để làm bài viết nổi bật
          // Dùng reduce để tìm bài có views lớn nhất một cách nhanh nhất
          this.featuredBlog = blogs.reduce((prev, current) => 
            ((prev.views || 0) >= (current.views || 0)) ? prev : current
          );

          // 2. Lưu các bài còn lại vào danh sách gốc (loại bỏ bài nổi bật để tránh trùng lặp)
          this.allBlogs = blogs.filter(b => b._id !== this.featuredBlog?._id);
        } else {
          this.featuredBlog = null;
          this.allBlogs = [];
        }

        // 3. Khởi tạo danh mục Tag từ dữ liệu thực tế
        const tagSet = new Set(
          blogs.map(b => b.tag).filter((t): t is string => !!t)
        );
        this.tags = ['Tất cả', ...Array.from(tagSet)];

        // 4. Áp dụng logic lọc và hiển thị lần đầu
        this.applyFilter();

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải bài viết:', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Tự động đóng menu sắp xếp khi người dùng nhấn chuột ra ngoài vùng dropdown
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.sort-dropdown')) {
      this.showSortMenu = false;
    }
  }

  /**
   * Cập nhật kiểu sắp xếp và thực hiện lọc lại
   */
  setSort(type: string): void {
    this.sortBy = type;
    this.showSortMenu = false;
    this.applyFilter();
  }

  /**
   * Trả về nhãn tiếng Việt tương ứng cho kiểu sắp xếp hiện tại
   */
  getSortLabel(): string {
    switch (this.sortBy) {
      case 'newest': return 'Mới đăng nhất';
      case 'oldest': return 'Cũ nhất';
      case 'views-desc': return 'Lượt xem cao nhất';
      case 'views-asc': return 'Lượt xem thấp nhất';
      case 'updated-newest': return 'Vừa cập nhật';
      default: return 'Sắp xếp';
    }
  }

  /**
   * Chuyển đổi định dạng ngày DD/MM/YYYY của bà sang con số (Timestamp) để máy tính so sánh được
   */
  private parseCustomDate(dateStr: string | undefined, createdAt: any): number {
    if (!dateStr || !dateStr.includes('/')) return new Date(createdAt).getTime();
    const parts = dateStr.split('/');
    // Định dạng: ngày/tháng/năm
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
  }

  selectTag(tag: string): void {
    this.selectedTag = tag;
    this.currentCount = this.pageSize; // Reset lại số lượng hiển thị khi đổi tag
    this.applyFilter();
  }

  onSearch(): void {
    this.currentCount = this.pageSize; // Reset lại số lượng hiển thị khi tìm kiếm
    this.applyFilter();
  }

  /**
   * Trái tim của Component: Xử lý Lọc theo Tag, Tìm kiếm và Sắp xếp bài viết
   */
  applyFilter(): void {
    let result = [...this.allBlogs];

    // 1. Lọc theo danh mục Tag
    if (this.selectedTag !== 'Tất cả') {
      result = result.filter((b) => b.tag === this.selectedTag);
    }

    // 2. Lọc theo từ khóa tìm kiếm (Tiêu đề hoặc Mô tả ngắn)
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter((b) =>
        (b.title || '').toLowerCase().includes(q) ||
        (b.excerpt || '').toLowerCase().includes(q)
      );
    }

    // 3. Thực hiện Sắp xếp dữ liệu theo tiêu chí đã chọn
    result.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      const viewsA = a.views || 0;
      const viewsB = b.views || 0;
      const updateA = this.parseCustomDate(a.date, a.createdAt);
      const updateB = this.parseCustomDate(b.date, b.createdAt);

      switch (this.sortBy) {
        case 'newest': return timeB - timeA;
        case 'oldest': return timeA - timeB;
        case 'views-desc': return viewsB - viewsA;
        case 'views-asc': return viewsA - viewsB;
        case 'updated-newest': return updateB - updateA;
        default: return 0;
      }
    });

    this.filteredBlogs = result;
    this.displayedBlogs = result.slice(0, this.currentCount);
  }

  /**
   * Tăng số lượng bài viết hiển thị khi nhấn "Xem thêm"
   */
  loadMore(): void {
    this.currentCount += this.pageSize;
    this.displayedBlogs = this.filteredBlogs.slice(0, this.currentCount);
  }

  get hasMore(): boolean {
    return this.displayedBlogs.length < this.filteredBlogs.length;
  }

  getImageUrl(path: string): string {
    if (!path) return 'assets/images/placeholder.jpg';
    if (path.startsWith('http')) return path;
    return `http://localhost:3000/${path}`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
}