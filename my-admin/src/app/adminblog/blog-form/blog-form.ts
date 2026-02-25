import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-blog-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './blog-form.html',
  styleUrls: ['./blog-form.css']
})
export class BlogForm implements OnInit {
  // Nhận chế độ từ component cha ('add' hoặc 'edit')
  @Input() mode: 'add' | 'edit' = 'add';
  
  // Nhận dữ liệu bài viết nếu ở chế độ edit (Sửa lỗi NG8002)
  @Input() postData: any = null;
  
  // Phát sự kiện quay lại danh sách
  @Output() goBack = new EventEmitter<void>();

  // Đối tượng lưu trữ dữ liệu form
  formData: any = {
    title: '',
    author: '',
    email: '',
    updatedAt: '',
    category: 'Trái cây',
    content: ''
  };

  ngOnInit(): void {
    // Nếu là chế độ chỉnh sửa, đổ dữ liệu từ postData vào formData
    if (this.mode === 'edit' && this.postData) {
      this.formData = { ...this.postData };
    } else {
      // Nếu là thêm mới, thiết lập các giá trị mặc định
      this.formData = {
        title: '',
        author: '',
        email: '',
        updatedAt: new Date().toLocaleDateString('vi-VN'),
        category: 'Trái cây',
        content: ''
      };
    }
  }

  // Xử lý khi nhấn nút Lưu/Đăng bài
  onSave(): void {
    if (this.mode === 'add') {
      console.log('Thêm bài viết mới:', this.formData);
    } else {
      console.log('Cập nhật bài viết:', this.formData);
    }
    // Sau khi xử lý xong, quay lại danh sách
    this.goBack.emit();
  }

  // Xử lý khi nhấn nút Xóa (chỉ có ở chế độ edit)
  onDelete(): void {
    if (confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) {
      console.log('Xóa bài viết id:', this.formData.id);
      this.goBack.emit();
    }
  }

  // Hàm quay lại
  onCancel(): void {
    this.goBack.emit();
  }
}