import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-track-order-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './track-order-modal.html',
  styleUrls: ['./track-order-modal.css']
})
export class TrackOrderModal {
  
  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();

  phoneNumber = '';
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  private API = 'http://localhost:3000/api';

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  close() {
    this.isOpen = false;
    this.phoneNumber = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.closeModal.emit();
  }

  onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';

    // Validate số điện thoại
    if (!this.phoneNumber) {
      this.errorMessage = 'Vui lòng nhập số điện thoại!';
      return;
    }

    const phonePattern = /^[0-9]{9,11}$/;
    if (!phonePattern.test(this.phoneNumber)) {
      this.errorMessage = 'Số điện thoại không hợp lệ (9-11 chữ số)!';
      return;
    }

    this.isLoading = true;

    // Gọi API tra cứu đơn hàng (bạn cần tạo endpoint này ở backend)
    this.http
      .get(`${this.API}/orders/track?phone=${this.phoneNumber}`)
      .subscribe({
        next: (res: any) => {
          this.isLoading = false;
          
          if (res.orders && res.orders.length > 0) {
            this.successMessage = `Tìm thấy ${res.orders.length} đơn hàng!`;
            
            // Chuyển đến trang kết quả tra cứu
            setTimeout(() => {
              this.router.navigate(['/order-tracking'], {
                queryParams: { phone: this.phoneNumber }
              });
              this.close();
            }, 1000);
          } else {
            this.errorMessage = 'Không tìm thấy đơn hàng nào với số điện thoại này!';
          }
        },
        error: (err: HttpErrorResponse) => {
          this.isLoading = false;
          this.errorMessage = err?.error?.message || 'Có lỗi xảy ra, vui lòng thử lại!';
        }
      });
  }
}