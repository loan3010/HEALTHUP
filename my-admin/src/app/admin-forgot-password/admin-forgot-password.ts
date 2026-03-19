import { Component, ViewChildren, QueryList, ElementRef, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-forgot-password',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './admin-forgot-password.html',
  styleUrls: ['./admin-forgot-password.css']
})
export class AdminForgotPassword implements OnDestroy {
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef>;

  email: string = '';
  otpArray: string[] = ['', '', '', '', '', '']; 
  newPassword: string = '';
  step: number = 1; 
  isLoading: boolean = false;
  countdown: number = 60;
  timerInterval: any;

  modal = { show: false, type: 'success' as 'success' | 'error', title: '', message: '' };
  private API = 'http://localhost:3000/api/auth/admin';

  constructor(private http: HttpClient, private router: Router) {}

  showNotice(type: 'success' | 'error', title: string, message: string) {
    this.modal = { show: true, type, title, message };
  }

  closeModal() {
    this.modal.show = false;
    if (this.modal.type === 'success' && this.step === 3) {
      this.router.navigate(['/login']);
    }
  }

  startTimer() {
    this.countdown = 60;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.countdown > 0) this.countdown--;
      else clearInterval(this.timerInterval);
    }, 1000);
  }

  // LOGIC NHẬP OTP CỰC KỲ CƠ BẢN ĐỂ CHỐNG LỖI
  onOtpInput(event: any, index: number) {
    let val = event.target.value;
    
    // Chỉ giữ lại con số cuối cùng
    val = val.replace(/[^0-9]/g, '').slice(-1);
    this.otpArray[index] = val;

    // Nhảy sang ô tiếp theo nếu có số
    if (val && index < 5) {
      setTimeout(() => {
        this.otpInputs.toArray()[index + 1].nativeElement.focus();
      }, 10);
    }
  }

  onKeyDown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace') {
      if (!this.otpArray[index] && index > 0) {
        // Nếu ô đang trống, quay về ô trước và tập trung vào đó
        this.otpInputs.toArray()[index - 1].nativeElement.focus();
      }
    }
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const data = event.clipboardData?.getData('text').trim();
    if (data && data.length === 6 && /^\d+$/.test(data)) {
      this.otpArray = data.split('');
      setTimeout(() => this.otpInputs.last.nativeElement.focus(), 10);
    }
  }

  sendOTP() {
    if (!this.email) return this.showNotice('error', 'THÔNG BÁO', 'Vui lòng nhập Email quản trị!');
    this.isLoading = true;
    this.http.post(`${this.API}/forgot-password`, { email: this.email.trim() }).subscribe({
      next: () => {
        this.step = 2;
        this.otpArray = ['', '', '', '', '', ''];
        this.startTimer();
        this.isLoading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.showNotice('error', 'THÔNG BÁO', err.error.message || 'Không thể gửi mã xác thực!');
        this.isLoading = false;
      }
    });
  }

  resendOTP() { this.sendOTP(); }

  resetPassword() {
    // 1. Kết nối chuỗi OTP
    const fullOtp = this.otpArray.join('').trim();
    
    // 2. Kiểm tra mật khẩu (đảm bảo Angular đã nhận được giá trị)
    const pass = this.newPassword ? this.newPassword.trim() : '';

    console.log('OTP hiện tại:', fullOtp); // Bà bật F12 lên xem nó có đủ 6 số chưa nhé
    console.log('Mật khẩu mới:', pass);

    if (fullOtp.length < 6 || pass.length < 6) {
      this.showNotice('error', 'THÔNG BÁO', 'Vui lòng nhập đủ 6 số OTP và mật khẩu mới!');
      return;
    }

    this.isLoading = true;
    this.http.post(`${this.API}/reset-password`, {
      email: this.email.trim(),
      otp: fullOtp,
      newPassword: pass
    }).subscribe({
      next: () => {
        this.step = 3;
        this.showNotice('success', 'THÀNH CÔNG', 'Mật khẩu quản trị đã được cập nhật!');
        this.isLoading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.showNotice('error', 'XÁC THỰC LỖI', err.error.message || 'Mã OTP không đúng hoặc hết hạn!');
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy() { if (this.timerInterval) clearInterval(this.timerInterval); }
}