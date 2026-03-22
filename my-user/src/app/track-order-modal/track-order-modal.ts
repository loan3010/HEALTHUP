import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

/**
 * Modal tra cứu (nút xanh header) — nhập SĐT + mã đơn, chuyển sang /tra-cuu-don (một lần gọi API).
 */
@Component({
  selector: 'app-track-order-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './track-order-modal.html',
  styleUrls: ['./track-order-modal.css'],
})
export class TrackOrderModal {
  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();

  phoneNumber = '';
  orderCode = '';
  errorMessage = '';

  constructor(private router: Router) {}

  close() {
    this.isOpen = false;
    this.phoneNumber = '';
    this.orderCode = '';
    this.errorMessage = '';
    this.closeModal.emit();
  }

  onSubmit() {
    this.errorMessage = '';

    const p = String(this.phoneNumber || '').trim();
    const c = String(this.orderCode || '').trim().toUpperCase();

    if (!/^0\d{9}$/.test(p)) {
      this.errorMessage = 'Số điện thoại không hợp lệ (10 số, bắt đầu 0).';
      return;
    }
    if (!/^ORD\d{11}$/i.test(c)) {
      this.errorMessage = 'Mã đơn không hợp lệ (VD: ORD00000000001).';
      return;
    }

    this.router.navigate(['/tra-cuu-don'], {
      queryParams: { phone: p, code: c },
    });
    this.close();
  }
}
