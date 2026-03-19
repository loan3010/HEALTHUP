import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router'; 
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [
    FormsModule, 
    CommonModule, 
    RouterModule 
  ],
  templateUrl: './admin-login.html',
  styleUrls: ['./admin-login.css']
})
export class AdminLogin {
  // --- THÔNG TIN ĐĂNG NHẬP ---
  email: string = '';
  password: string = '';
  isLoading: boolean = false;
  showPassword: boolean = false; // Biến điều khiển ẩn/hiện mật mã

  // --- CẤU HÌNH HỘP THOẠI THÔNG BÁO (MODAL) ---
  modal = {
    show: false,
    type: 'success' as 'success' | 'error',
    title: '',
    message: ''
  };

  // Đường dẫn đến API xác thực quản trị viên của hệ thống
  private API = 'http://localhost:3000/api/auth/admin-login';

  constructor(
    private router: Router, 
    private http: HttpClient
  ) {}

  /**
   * Hiển thị hộp thoại thông báo thay cho lệnh alert mặc định
   */
  showNotice(type: 'success' | 'error', title: string, message: string) {
    this.modal = { show: true, type, title, message };
  }

  /**
   * Đóng hộp thoại thông báo
   */
  closeModal() {
    this.modal.show = false;
  }

  /**
   * Thực hiện lệnh xác thực thông tin đăng nhập vào hệ thống quản trị
   */
  onLogin() {
    const emailVal = (this.email || '').trim();
    const passVal = (this.password || '');

    // Kiểm tra dữ liệu đầu vào
    if (!emailVal || !passVal) {
      this.showNotice('error', 'THIẾU THÔNG TIN', 'Bà vui lòng điền đầy đủ thư điện tử và mật mã hệ thống nhé!');
      return;
    }

    this.isLoading = true;

    this.http.post<any>(this.API, {
      email: emailVal,
      password: passVal
    })
    .subscribe({
      next: (res) => {
        // Lưu trữ chứng chỉ và thông tin quản trị viên vào bộ nhớ trình duyệt
        localStorage.setItem('admin_token', res.token);
        localStorage.setItem('admin_info', JSON.stringify(res.user));

        console.log('Xác thực thành công! Đang tiến vào hệ thống quản trị...');

        // Điều hướng trực tiếp vào trang quản lý chính
        this.router.navigate(['/admin']);
        
        this.isLoading = false;
      },
      error: (err: HttpErrorResponse) => {
        console.error('LỖI XÁC THỰC QUẢN TRỊ:', err);
        
        // Hiển thị lỗi bằng Modal chuyên nghiệp
        const errorMsg = err?.error?.message || 'Đăng nhập thất bại. Bà kiểm tra lại tài khoản hoặc đường truyền nhé!';
        this.showNotice('error', 'LỖI ĐĂNG NHẬP', errorMsg);
        
        this.isLoading = false;
      }
    });
  }
}