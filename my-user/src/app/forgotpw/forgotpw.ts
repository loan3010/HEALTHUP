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
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

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
  private http = inject(HttpClient);
  closeOtp() {
  this.showOtp = false;
  this.otpError = '';
  this.clearOtpInterval();
}

  private API = 'http://localhost:3000/api';

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

  trackByIndex = (i: number) => i;

  form = this.fb.group({
    phone: ['', [Validators.required, Validators.pattern(/^(0|\+84)\d{9,10}$/)]]
  });

  ngAfterViewInit() {
    this.otpInputs?.changes.subscribe(() => {
      if (this.showOtp) setTimeout(() => this.focusOtp(0), 0);
    });
  }

  // ===== OPEN OTP =====
  openOtpPopup() {
    this.error = '';
    this.message = '';
    this.otpError = '';

    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error = 'Vui lòng nhập số điện thoại hợp lệ.';
      return;
    }

    // ✅ demo: mở OTP liền
    this.showOtp = true;
    this.resetOtp();
    this.startCountdown();

    setTimeout(() => this.focusOtp(0), 0);

    // demo message
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
    const digits = (input.value ?? '').replace(/\D/g, '');

    // paste nhiều số vào 1 ô
    if (digits.length > 1) {
      this.fillOtpFrom(index, digits);
      return;
    }

    const d = digits.length === 1 ? digits : '';
    this.otpValues[index] = d;
    this.otpError = '';

    if (d) {
      if (index < 5) this.focusOtp(index + 1);
      else this.tryAutoSubmit();
    }
  }

  onOtpKeydown(event: KeyboardEvent, index: number) {
    const key = event.key;

    if (key.length === 1 && !/^\d$/.test(key)) {
      event.preventDefault();
      return;
    }

    if (key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this.focusOtp(index - 1);
      return;
    }

    if (key === 'ArrowRight' && index < 5) {
      event.preventDefault();
      this.focusOtp(index + 1);
      return;
    }

    if (key === 'Backspace') {
      event.preventDefault();
      if (this.otpValues[index]) {
        this.otpValues[index] = '';
      } else if (index > 0) {
        this.otpValues[index - 1] = '';
        this.focusOtp(index - 1);
      }
    }
  }

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

  // ===== CONFIRM OTP (DEMO: OTP tự do, chỉ check SĐT tồn tại) =====
  confirmOtp() {
    this.error = '';
    this.otpError = '';

    const otp = this.otpValues.join('');
    const phoneVal = String(this.form.controls.phone.value || '').trim();

    // ✅ demo: OTP “tự do” nhưng vẫn bắt đủ 6 số
    if (!/^\d{6}$/.test(otp)) {
      this.otpError = 'Vui lòng nhập đủ 6 số OTP.';
      return;
    }

    this.loading = true;

    // ✅ chỉ check số điện thoại có tồn tại không
    this.http
      .post<any>(`${this.API}/auth/check-phone`, { phone: phoneVal })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res) => {
          if (!res?.user) {
            this.otpError = 'Số điện thoại chưa đăng ký.';
            return;
          }

          // ✅ lưu token/user (token demo nếu backend không trả)
          localStorage.setItem('token', res.token || 'demo-token');
          localStorage.setItem('user', JSON.stringify(res.user));

          this.clearOtpInterval();
          this.showOtp = false;

          // ✅ chuyển sang homepage
          this.router.navigate(['/homepage']);
        },
        error: (err: HttpErrorResponse) => {
          this.otpError = err?.error?.message || 'Số điện thoại chưa đăng ký.';
        }
      });
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