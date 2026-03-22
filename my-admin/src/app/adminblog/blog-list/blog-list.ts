import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-blog-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './blog-list.html',
  styleUrls: ['./blog-list.css']
})
export class BlogList implements OnInit {
  @Output() goEdit = new EventEmitter<any>();
  @Output() goAdd = new EventEmitter<void>();

  // --- QUẢN LÝ DỮ LIỆU ---
  posts: any[] = [];          // Dữ liệu gốc từ server
  filteredPosts: any[] = [];  // Dữ liệu sau khi lọc/sắp xếp dùng để hiển thị

  // --- TRẠNG THÁI BỘ LỌC ---
  searchText: string = '';
  selectedCategory: string = 'Tất cả';
  sortBy: string = 'newest'; // Các giá trị: newest, oldest, updated, views-desc, views-asc

  categories: string[] = [
    'Tất cả', 
    'Sức khỏe', 
    'Dinh dưỡng', 
    'Công thức', 
    'Eat Clean', 
    'Gym & Thể thao'
  ];

  // --- CẤU HÌNH MODAL THÔNG BÁO ---
  showNotifyModal: boolean = false;
  notifyConfig: any = {
    type: 'success', // success, error, confirm, warning
    title: '',
    message: '',
    btnText: 'Xác nhận',
    action: null
  };

  private apiUrl = 'http://localhost:3000/api/blogs';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.fetchPosts();
  }

  /**
   * Tải danh sách bài viết từ máy chủ.
   * Thêm tham số isAdmin=true để lấy cả các bài viết đang bị ẩn.
   */
  fetchPosts(): void {
    this.http.get<any[]>(`${this.apiUrl}?isAdmin=true`)
      .subscribe({
        next: (data) => {
          this.posts = data.map(p => ({
            ...p,
            selected: false,
            // Đảm bảo có thuộc tính isHidden (mặc định false nếu null/undefined)
            isHidden: p.isHidden || false,
            createdAtTime: p.createdAt ? new Date(p.createdAt).getTime() : 0,
            updatedAtTime: this.parseDateString(p.date),
            displayCreated: p.createdAt ? new Date(p.createdAt).toLocaleDateString('vi-VN') : '---',
            displayUpdated: p.date || (p.createdAt ? new Date(p.createdAt).toLocaleDateString('vi-VN') : '---')
          }));
          this.applyFiltersAndSort();
        },
        error: (err) => {
          console.error('Lỗi khi lấy dữ liệu bài viết:', err);
          this.showNotify('error', 'Lỗi hệ thống', 'Không thể kết nối với máy chủ để tải danh sách bài viết.');
        }
      });
  }

  private parseDateString(dateStr: string): number {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return new Date(dateStr).getTime() || 0;
    const dateObj = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    return dateObj.getTime();
  }

  applyFiltersAndSort(): void {
    let result = [...this.posts];

    // 1. Lọc theo từ khóa tìm kiếm
    if (this.searchText.trim()) {
      const search = this.searchText.toLowerCase().trim();
      result = result.filter(p => 
        p.title.toLowerCase().includes(search) || 
        p.author.toLowerCase().includes(search)
      );
    }

    // 2. Lọc theo danh mục bài viết
    if (this.selectedCategory !== 'Tất cả') {
      result = result.filter(p => p.tag === this.selectedCategory);
    }

    // 3. Sắp xếp dữ liệu (Ngày đăng, Ngày cập nhật, Lượt xem)
    result.sort((a, b) => {
      switch (this.sortBy) {
        case 'newest': return b.createdAtTime - a.createdAtTime;
        case 'oldest': return a.createdAtTime - b.createdAtTime;
        case 'updated': return b.updatedAtTime - a.updatedAtTime;
        case 'views-desc': return (b.views || 0) - (a.views || 0);
        case 'views-asc': return (a.views || 0) - (b.views || 0);
        default: return 0;
      }
    });

    this.filteredPosts = result;
  }

  // --- QUẢN LÝ TRẠNG THÁI ẨN / HIỆN ---
  /**
   * Cập nhật trạng thái ẩn/hiện cho các bài viết đã chọn.
   * Text của Modal sẽ thay đổi linh hoạt tùy vào hành động Ẩn hay Hiện.
   */
  onToggleStatus(): void {
    const selectedPosts = this.filteredPosts.filter(p => p.selected);
    if (selectedPosts.length === 0) return;

    // Lấy trạng thái mục tiêu dựa trên bài viết đầu tiên được chọn
    const targetIsHidden = !selectedPosts[0].isHidden;

    // Cấu hình nội dung Modal dựa trên hành động
    const title = targetIsHidden ? 'Xác nhận ẩn bài viết' : 'Xác nhận hiển thị bài viết';
    const btnText = targetIsHidden ? 'Ẩn bài viết' : 'Hiển thị ngay';
    const message = targetIsHidden
      ? `Bạn có chắc chắn muốn ẩn ${selectedPosts.length} bài viết đã chọn? Người dùng sẽ không thể nhìn thấy nội dung này bên ngoài trang chủ.`
      : `Bạn có chắc chắn muốn hiển thị lại ${selectedPosts.length} bài viết đã chọn? Nội dung sẽ được công khai cho tất cả người dùng trên trang chủ.`;

    this.showNotify('confirm', title, message, btnText, () => {
      let updatedCount = 0;
      selectedPosts.forEach(post => {
        this.http.put(`${this.apiUrl}/${post._id}`, { isHidden: targetIsHidden }).subscribe({
          next: () => {
            updatedCount++;
            if (updatedCount === selectedPosts.length) {
              this.fetchPosts(); // Tải lại dữ liệu sau khi cập nhật thành công
              const successMsg = targetIsHidden ? 'Đã ẩn bài viết thành công.' : 'Đã hiển thị bài viết thành công.';
              this.showNotify('success', 'Thành công', successMsg);
            }
          },
          error: (err) => {
            console.error('Lỗi khi cập nhật trạng thái:', err);
            this.showNotify('error', 'Lỗi hệ thống', 'Quá trình cập nhật trạng thái gặp sự cố.');
          }
        });
      });
    });
  }

  // --- QUẢN LÝ MODAL THÔNG BÁO ---
  showNotify(type: 'success'|'error'|'confirm'|'warning', title: string, message: string, btnText: string = 'Xác nhận', action: any = null) {
    this.notifyConfig = { type, title, message, btnText, action };
    this.showNotifyModal = true;
  }

  closeNotify() {
    this.showNotifyModal = false;
  }

  handleNotifyAction() {
    if (this.notifyConfig.action) {
      this.notifyConfig.action();
    }
    this.closeNotify();
  }

  // --- THAO TÁC DỮ LIỆU ---
  get selectedCount(): number {
    return this.filteredPosts.filter(p => p.selected).length;
  }

  toggleAll(event: any): void {
    const isChecked = event.target.checked;
    this.filteredPosts.forEach(p => p.selected = isChecked);
  }

  onEdit(): void {
    const selected = this.filteredPosts.find(p => p.selected);
    if (selected && this.selectedCount === 1) {
      this.goEdit.emit(selected);
    }
  }

  onDelete(): void {
    const selectedPosts = this.filteredPosts.filter(p => p.selected);
    if (selectedPosts.length === 0) return;

    const title = 'Xác nhận xóa bài viết';
    const message = selectedPosts.length === 1 
      ? 'Hành động này sẽ xóa vĩnh viễn bài viết đã chọn và không thể khôi phục. Bạn có chắc chắn muốn thực hiện?' 
      : `Hành động này sẽ xóa vĩnh viễn ${selectedPosts.length} bài viết đã chọn và không thể khôi phục. Bạn có chắc chắn muốn thực hiện?`;

    this.showNotify('confirm', title, message, 'Xác nhận xóa', () => {
      let deletedCount = 0;
      selectedPosts.forEach(post => {
        this.http.delete(`${this.apiUrl}/${post._id}`).subscribe({
          next: () => {
            deletedCount++;
            if (deletedCount === selectedPosts.length) {
              this.fetchPosts();
              this.showNotify('success', 'Thành công', 'Đã xóa các bài viết thành công.');
            }
          },
          error: (err) => {
            console.error('Lỗi khi xoá bài viết:', err);
            this.showNotify('error', 'Lỗi hệ thống', 'Quá trình thực hiện xóa gặp sự cố. Vui lòng thử lại sau.');
          }
        });
      });
    });
  }

  onSearchChange(): void {
    this.applyFiltersAndSort();
  }
}