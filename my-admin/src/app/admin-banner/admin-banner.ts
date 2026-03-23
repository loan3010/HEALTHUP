import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-admin-banner',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, DragDropModule],
  templateUrl: './admin-banner.html',
  styleUrls: ['./admin-banner.css']
})
export class AdminBanner implements OnInit {
  banners: any[] = [];
  readonly apiUrl = 'http://localhost:3000/api/banners';
  readonly serverUrl = 'http://localhost:3000';

  // Quản lý trạng thái Modal chỉnh sửa
  showEditModal: boolean = false;
  selectedBanner: any = null;

  // Quản lý trạng thái Modal thông báo/xác nhận
  notification = {
    show: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'confirm' | 'info',
    pendingId: null as string | null // Lưu ID tạm thời khi cần xác nhận xóa
  };

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadBanners();
  }

  /**
   * Truy xuất danh sách banner từ máy chủ
   */
  loadBanners(): void {
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (res) => {
        this.banners = res.sort((a, b) => (a.order || 0) - (b.order || 0));
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.showNotification('Lỗi kết nối', 'Không thể tải danh sách banner từ máy chủ.', 'error');
      }
    });
  }

  /**
   * Xử lý kéo thả và cập nhật thứ tự hiển thị
   */
  onDrop(event: CdkDragDrop<any[]>): void {
    if (event.previousIndex === event.currentIndex) return;

    moveItemInArray(this.banners, event.previousIndex, event.currentIndex);

    this.banners.forEach((banner, index) => {
      banner.order = index;
      this.updateBannerServer(banner);
    });
    
    this.cdr.detectChanges();
  }

  /**
   * Mở Modal chỉnh sửa chi tiết
   */
  openEditModal(banner: any): void {
    this.selectedBanner = { ...banner };
    
    if (this.selectedBanner.startDate) {
      this.selectedBanner.startDate = this.formatDate(this.selectedBanner.startDate);
    }
    if (this.selectedBanner.endDate) {
      this.selectedBanner.endDate = this.formatDate(this.selectedBanner.endDate);
    }
    
    this.showEditModal = true;
  }

  closeModal(): void {
    this.showEditModal = false;
    this.selectedBanner = null;
  }

  /**
   * Lưu thông tin từ Modal chỉnh sửa
   */
  saveBannerDetails(): void {
    if (!this.selectedBanner) return;

    this.http.put(`${this.apiUrl}/${this.selectedBanner._id}`, this.selectedBanner).subscribe({
      next: () => {
        this.loadBanners();
        this.closeModal();
        this.showNotification('Thành công', 'Thông tin banner đã được cập nhật trên hệ thống.', 'success');
      },
      error: (err) => {
        this.showNotification('Lỗi cập nhật', 'Yêu cầu thay đổi thông tin không được máy chủ chấp nhận.', 'error');
      }
    });
  }

  private updateBannerServer(banner: any): void {
    this.http.put(`${this.apiUrl}/${banner._id}`, banner).subscribe({
      error: () => console.error('Lỗi đồng bộ thứ tự banner.')
    });
  }

  toggleActive(banner: any): void {
    banner.isActive = !banner.isActive;
    this.updateBannerServer(banner);
  }

  formatDate(date: any): string {
    if (!date) return '';
    const d = new Date(date);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  }

  /**
   * Xử lý tải ảnh và kiểm tra dung lượng (Max 2MB)
   */
  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (!file) return;

    // Kiểm tra định dạng
    if (!file.type.startsWith('image/')) {
      this.showNotification('Định dạng sai', 'Vui lòng chỉ lựa chọn các tệp tin hình ảnh hợp lệ.', 'error');
      return;
    }

    // Kiểm tra dung lượng (Ví dụ: 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      this.showNotification('Tệp quá lớn', 'Dung lượng hình ảnh vượt quá giới hạn cho phép (Tối đa 2MB).', 'error');
      event.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('title', 'Banner mới ' + (this.banners.length + 1));
    formData.append('order', this.banners.length.toString());

    this.http.post(this.apiUrl, formData).subscribe({
      next: () => {
        this.loadBanners();
        this.showNotification('Thành công', 'Hình ảnh mới đã được tải lên và lưu trữ thành công.', 'success');
        event.target.value = ''; 
      },
      error: (err) => {
        this.showNotification('Lỗi tải lên', 'Máy chủ không thể xử lý tệp tin tại thời điểm này.', 'error');
      }
    });
  }

  /**
   * Kích hoạt Modal xác nhận xóa thay vì confirm()
   */
  deleteBanner(id: string): void {
    this.notification = {
      show: true,
      title: 'Xác nhận xóa dữ liệu',
      message: 'Hành động này sẽ xóa vĩnh viễn banner khỏi hệ thống và không thể khôi phục. Bạn có chắc chắn muốn tiếp tục?',
      type: 'confirm',
      pendingId: id
    };
  }

  /**
   * Điều khiển hành động trong Modal Thông báo/Xác nhận
   */
  notificationAction(): void {
    if (this.notification.type === 'confirm' && this.notification.pendingId) {
      // Thực hiện xóa thực tế
      this.http.delete(`${this.apiUrl}/${this.notification.pendingId}`).subscribe({
        next: () => {
          this.loadBanners();
          this.showNotification('Đã xóa', 'Dữ liệu banner đã được loại bỏ hoàn toàn.', 'success');
        },
        error: () => {
          this.showNotification('Lỗi hệ thống', 'Không thể thực hiện yêu cầu xóa tại thời điểm này.', 'error');
        }
      });
    } else {
      // Đóng modal thông báo thông thường
      this.notification.show = false;
    }
  }

  /**
   * Cấu hình nhanh nội dung thông báo
   */
  showNotification(title: string, message: string, type: 'success' | 'error' | 'info'): void {
    this.notification = {
      show: true,
      title: title,
      message: message,
      type: type,
      pendingId: null
    };
  }
}