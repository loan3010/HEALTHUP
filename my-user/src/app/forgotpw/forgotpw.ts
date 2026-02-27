import {
  Component,
  ElementRef,
  QueryList,
  ViewChildren,
  inject,
  OnDestroy,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-forgotpw',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgotpw.html',
  styleUrls: ['./forgotpw.css']
})
export class Forgotpw implements OnDestroy, AfterViewInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  loading = false;
  message = '';
  error = '';

  showOtp = false;
  otpError = '';
  otpSecondsLeft = 60;
  private otpInterval: any;

  otpValues: string[] = Array(6).fill('');

  @ViewChildren('otpInput')
  otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  // trackBy để Angular không recreate input => hết “nhảy”
  trackByIndex = (i: number) => i;

  // ===== FORM =====
  form = this.fb.group({
    phone: ['', [Validators.required, Validators.pattern(/^(0|\+84)\d{9,10}$/)]]
  });

  ngAfterViewInit() {
    // Khi popup render xong list input, focus vào ô đầu
    this.otpInputs?.changes.subscribe(() => {
      if (this.showOtp) setTimeout(() => this.focusOtp(0), 0);
    });
  }

  // ===== GỬI OTP =====
  openOtpPopup() {
    this.error = '';
    this.message = '';
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.error = 'Vui lòng nhập số điện thoại hợp lệ.';
      return;
    }

    // ✅ HIỆN OTP LIỀN (không chờ)
    this.showOtp = true;

    this.resetOtp();
    this.startCountdown();

    // focus ngay sau khi render
    setTimeout(() => this.focusOtp(0), 0);

    // ✅ Nếu vẫn muốn hiệu ứng "Đang gửi..." (không chặn OTP)
    this.loading = true;
    setTimeout(() => {
      this.loading = false;
      this.message = 'Mã OTP đã được gửi (demo).';
    }, 300);
  }

  // ===== COUNTDOWN =====
  private startCountdown() {
    this.otpSecondsLeft = 60;
    this.clearOtpInterval();

    this.otpInterval = setInterval(() => {
      this.otpSecondsLeft--;

      if (this.otpSecondsLeft <= 0) {
        this.clearOtpInterval();
        this.showOtp = false;
        this.otpError = '';
      }
    }, 1000);
  }

  private clearOtpInterval() {
    if (this.otpInterval) {
      clearInterval(this.otpInterval);
      this.otpInterval = null;
    }
  }

  private resetOtp() {
    // chỉ reset khi mở popup
    this.otpValues = Array(6).fill('');
    this.otpError = '';
  }

  private focusOtp(index: number) {
    const inputs = this.otpInputs?.toArray() ?? [];
    const el = inputs[index]?.nativeElement;
    if (!el) return;

    el.focus();
    try {
      el.setSelectionRange(0, el.value.length);
    } catch {}
  }

  // ===== OTP INPUT =====
  onOtpInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;

    // Chỉ lấy số
    const digits = (input.value ?? '').replace(/\D/g, '');

    // Nếu paste nhiều số vào 1 ô
    if (digits.length > 1) {
      this.fillOtpFrom(index, digits);
      return;
    }

    // Bình thường: 0 hoặc 1 số
    const d = digits.length === 1 ? digits : '';
    this.otpValues[index] = d;

    this.otpError = '';

    if (d) {
      if (index < 5) this.focusOtp(index + 1);
      else this.tryAutoSubmit();
    }
  }

  // ===== KEYDOWN =====
  onOtpKeydown(event: KeyboardEvent, index: number) {
    const key = event.key;

    if (key === 'Tab') return;

    // Chặn ký tự không phải số (trừ các phím điều hướng)
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight'];
    if (key.length === 1 && !/^\d$/.test(key)) {
      event.preventDefault();
      return;
    }

    if (key === 'ArrowLeft') {
      event.preventDefault();
      if (index > 0) this.focusOtp(index - 1);
      return;
    }

    if (key === 'ArrowRight') {
      event.preventDefault();
      if (index < 5) this.focusOtp(index + 1);
      return;
    }

    if (key === 'Backspace') {
      event.preventDefault();

      // nếu ô hiện tại có số -> xóa tại chỗ
      if (this.otpValues[index]) {
        this.otpValues[index] = '';
        return;
      }

      // nếu ô rỗng -> lùi về ô trước và xóa ô trước
      if (index > 0) {
        this.otpValues[index - 1] = '';
        this.focusOtp(index - 1);
      }
      return;
    }

    if (key === 'Delete') {
      event.preventDefault();
      this.otpValues[index] = '';
      return;
    }

    // các phím khác thì cho chạy bình thường
    if (!allowed.includes(key) && key.length > 1) return;
  }

  // ===== PASTE =====
  onOtpPaste(event: ClipboardEvent, index: number) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') ?? '';
    const digits = text.replace(/\D/g, '');
    if (!digits) return;

    this.fillOtpFrom(index, digits);
  }

  private fillOtpFrom(startIndex: number, digits: string) {
    let i = startIndex;
    for (const ch of digits.replace(/\D/g, '')) {
      if (i > 5) break;
      this.otpValues[i] = ch;
      i++;
    }

    this.otpError = '';

    if (i <= 5) this.focusOtp(i);
    else this.tryAutoSubmit();
  }

  private tryAutoSubmit() {
    const otp = this.otpValues.join('');
    if (otp.length === 6) this.confirmOtp();
  }

  // ===== CONFIRM =====
  confirmOtp() {
    const otp = this.otpValues.join('');

    if (otp.length !== 6) {
      this.otpError = 'Vui lòng nhập đủ 6 số OTP.';
      return;
    }

    // demo: coi như đúng
    this.clearOtpInterval();
    this.showOtp = false;

    setTimeout(() => this.router.navigateByUrl('/login'), 100);
  }

  // ===== VALIDATION =====
  showErr(name: keyof typeof this.form.controls) {
    const c = this.form.controls[name];
    return !!(c.touched && c.invalid);
  }

  errText(name: keyof typeof this.form.controls) {
    const c = this.form.controls[name];
    if (c.errors?.['required']) return 'Trường này không được để trống.';
    if (c.errors?.['pattern']) return 'Số điện thoại không hợp lệ.';
    return 'Kiểm tra lại số điện thoại.';
  }

  ngOnDestroy() {
    this.clearOtpInterval();
  }
}