import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-blog-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './blog-list.html',
  styleUrls: ['./blog-list.css']
})
export class BlogList {
  // Phát tín hiệu cho component cha khi nhấn Chỉnh hoặc Thêm
  @Output() goEdit = new EventEmitter<any>();
  @Output() goAdd = new EventEmitter<void>();

  searchText: string = '';

  // Dữ liệu mẫu đầy đủ các trường để hiển thị lên bảng
  posts = [
    { id: 'NS002', title: '5 Loại Trái Cây ‘Vàng’ Giúp Tăng Cường Miễn Dịch Cấp Tốc', updatedAt: '23/10/2024', author: 'Trần Thanh Tâm', category: 'Trái cây', views: 2, selected: false },
    { id: 'NS016', title: 'Nấm Tươi Hay Nấm Khô – Loại Nào Tốt Hơn Cho Sức Khỏe?', updatedAt: '23/10/2024', author: 'Ngô Thảo Linh', category: 'Nấm', views: 2, selected: false },
    { id: 'NS015', title: 'Khám Phá Thế Giới Nấm Ăn – Nguồn Dinh Dưỡng Từ Thiên Nhiên', updatedAt: '22/10/2024', author: 'Vũ Hoàng My', category: 'Dinh dưỡng', views: 2389, selected: false },
    { id: 'NS003', title: 'Dinh Dưỡng Từ Nông Sản Sạch: Kho Báu Cho Sức Khỏe Tim Mạch', updatedAt: '20/10/2024', author: 'Nguyễn Minh Hùng', category: 'Nông sản', views: 1, selected: false },
    { id: 'NS014', title: 'Bi Quyết Giữ Rau Củ Tươi Lâu Trong Tủ Lạnh', updatedAt: '20/10/2024', author: 'Đặng Bảo Ngọc', category: 'Mẹo dinh dưỡng', views: 3, selected: false }
  ];

  // Tính số lượng bài viết đang được tick chọn
  get selectedCount(): number {
    return this.posts.filter(p => p.selected).length;
  }

  // HÀM SỬA LỖI TS2339: Chọn hoặc bỏ chọn tất cả bài viết
  toggleAll(event: any): void {
    const isChecked = event.target.checked;
    this.posts.forEach(p => p.selected = isChecked);
  }

  // Xử lý khi nhấn nút Chỉnh
  onEdit(): void {
    const selected = this.posts.find(p => p.selected);
    if (selected && this.selectedCount === 1) {
      this.goEdit.emit(selected);
    }
  }
}