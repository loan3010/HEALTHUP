import {
  Component,
  ElementRef,
  QueryList,
  ViewChildren,
  OnInit,
  OnDestroy
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

type RegisterRes = {
  message: string;
  id?: string;
  token?: string;
  user?: any;
};

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class Register implements OnInit, OnDestroy {
  form!: FormGroup;

  loading = false;
  message = '';
  error = '';

  showOtp = false;
  otpError = '';
  otpSecondsLeft = 60;
  private otpInterval: any;

  otpValues: string[] = ['', '', '', '', '', ''];

  @ViewChildren('otpInput')
  otpInputs!: QueryList<ElementRef>;

  private API = 'http://localhost:3000/api';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private http: HttpClient
  ) {
    this.form = this.fb.group({
      // ✅ username: cho phép tiếng Việt + khoảng trắng, chỉ cấm toàn số
      username: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(50),
          Validators.pattern(/^(?!\d+$)[\p{L}\d\s]+$/u)
        ]
      ],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{9,11}$/)]],
      email: ['', [Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    // reset sạch khi vừa vào trang (giảm bị autofill)
    setTimeout(() => this.resetRegisterForm(), 0);
  }

  ngOnDestroy(): void {
    if (this.otpInterval) {
      clearInterval(this.otpInterval);
      this.otpInterval = null;
    }
  }

  get passwordMismatch(): boolean {
    return this.form.get('password')?.value !== this.form.get('confirmPassword')?.value;
  }

  // ===== RESET HELPERS =====
  private resetOtpUI(): void {
    this.otpValues = ['', '', '', '', '', ''];
    this.otpError = '';

    const inputs = this.otpInputs?.toArray?.() || [];
    inputs.forEach((el) => (el.nativeElement.value = ''));
  }

  private resetRegisterForm(): void {
    this.form.reset();
    this.form.markAsPristine();
    this.form.markAsUntouched();

    Object.keys(this.form.controls).forEach((k) => {
      this.form.get(k)?.setErrors(null);
    });

    this.resetOtpUI();
    this.message = '';
    this.error = '';
  }

  closeOtpPopup(): void {
    this.showOtp = false;

    if (this.otpInterval) {
      clearInterval(this.otpInterval);
      this.otpInterval = null;
    }

    this.resetOtpUI();
  }

  openOtpPopup(): void {
    this.error = '';
    this.message = '';
    this.otpError = '';

    if (this.form.invalid || this.passwordMismatch) {
      this.form.markAllAsTouched();
      if (this.passwordMismatch) this.error = 'Mật khẩu xác nhận không khớp.';
      return;
    }

    this.showOtp = true;
    this.resetOtpUI();
    this.startOtpCountdown();

    setTimeout(() => this.otpInputs?.first?.nativeElement?.focus(), 0);
  }

  private startOtpCountdown(): void {
    this.otpSecondsLeft = 60;

    if (this.otpInterval) clearInterval(this.otpInterval);

    this.otpInterval = setInterval(() => {
      this.otpSecondsLeft--;
      if (this.otpSecondsLeft <= 0) {
        clearInterval(this.otpInterval);
        this.otpInterval = null;
        this.showOtp = false;
      }
    }, 1000);
  }

  // ===== OTP HANDLERS =====
  /** Đồng bộ mảng → DOM (mỗi ô tối đa 1 số — tránh một ô dính "112") */
  private flushRegisterOtpDom(): void {
    const inputs = this.otpInputs?.toArray?.() || [];
    inputs.forEach((ref, i) => {
      ref.nativeElement.value = this.otpValues[i] ?? '';
    });
  }

  private fillOtpFromRegister(startIndex: number, digits: string): void {
    let i = startIndex;
    for (const ch of digits.replace(/\D/g, '')) {
      if (i > 5) break;
      this.otpValues[i] = ch;
      i++;
    }
    this.otpError = '';
    this.flushRegisterOtpDom();
    if (i <= 5) {
      this.otpInputs.toArray()[i]?.nativeElement?.focus();
    }
  }

  onOtpInput(event: Event, index: number): void {
    const el = event.target as HTMLInputElement;
    const raw = (el.value || '').replace(/\D/g, '');

    if (raw.length > 1) {
      this.fillOtpFromRegister(index, raw);
      return;
    }

    const ch = raw.length === 1 ? raw : '';
    this.otpValues[index] = ch;
    el.value = ch;
    this.otpError = '';

    if (ch && index < 5) {
      this.otpInputs.toArray()[index + 1]?.nativeElement?.focus();
    }
  }

  onOtpKeydown(event: KeyboardEvent, index: number): void {
    const key = event.key;

    if (key.length === 1 && !/^\d$/.test(key)) {
      event.preventDefault();
      return;
    }

    if (key === 'Backspace') {
      event.preventDefault();
      const inputs = this.otpInputs.toArray();
      if (this.otpValues[index]) {
        this.otpValues[index] = '';
        inputs[index] && (inputs[index].nativeElement.value = '');
      } else if (index > 0) {
        this.otpValues[index - 1] = '';
        const prev = inputs[index - 1]?.nativeElement;
        if (prev) prev.value = '';
        inputs[index - 1]?.nativeElement?.focus();
      }
    }
  }

  /** Dán 6 số (hoặc chuỗi bất kỳ) vào các ô từ đầu */
  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') || '';
    const digits = pasted.replace(/\D/g, '');
    if (!digits) return;

    this.fillOtpFromRegister(0, digits);
  }

  confirmOtpAndRegister(): void {
    this.error = '';
    this.message = '';
    this.otpError = '';

    const enteredOtp = this.otpValues.join('');
    if (enteredOtp.length !== 6) {
      this.otpError = 'Vui lòng nhập đủ 6 số OTP.';
      return;
    }

    if (this.passwordMismatch) {
      this.error = 'Mật khẩu xác nhận không khớp.';
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.otpInterval) {
      clearInterval(this.otpInterval);
      this.otpInterval = null;
    }

    const usernameVal = String(this.form.get('username')?.value || '').trim();
    const phoneVal = String(this.form.get('phone')?.value || '').trim();
    const passwordVal = String(this.form.get('password')?.value || '');

    const payload: any = {
      username: usernameVal,
      phone: phoneVal,
      password: passwordVal,
      role: 'user'
    };

    const emailVal = String(this.form.get('email')?.value || '').trim();
    if (emailVal) payload.email = emailVal;

    this.loading = true;

    this.http
      .post<RegisterRes>(`${this.API}/auth/register`, payload)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res) => {
          this.showOtp = false;
          this.message = res?.message || 'Đăng ký thành công!';
          this.error = '';

          // ✅ Lưu để trang Login tự điền
          sessionStorage.setItem(
            'prefill_login',
            JSON.stringify({ username: usernameVal, password: passwordVal })
          );

          // ✅ reset để quay lại register đăng ký cái khác vẫn trống
          this.resetRegisterForm();

          setTimeout(() => this.router.navigate(['/login']), 300);
        },
        error: (err: HttpErrorResponse) => {
          this.showOtp = false;
          this.error = err?.error?.message || 'Đăng ký thất bại!';
        }
      });
  }

  // ===== VALIDATION HELPERS =====
  showErr(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  errText(controlName: string): string {
    const control = this.form.get(controlName);
    if (!control) return '';

    if (controlName !== 'email' && control.errors?.['required']) {
      return 'Trường này là bắt buộc.';
    }

    if (controlName === 'username' && control.errors?.['minlength']) return 'Tên tài khoản tối thiểu 3 ký tự.';
    if (controlName === 'username' && control.errors?.['maxlength']) return 'Tên tài khoản tối đa 50 ký tự.';
    if (controlName === 'username' && control.errors?.['pattern']) return 'Tên tài khoản không được chỉ gồm chữ số.';

    if (controlName === 'phone' && control.errors?.['pattern']) return 'Số điện thoại không hợp lệ.';
    if (control.errors?.['email']) return 'Email không hợp lệ.';
    if (controlName === 'password' && control.errors?.['minlength']) return 'Mật khẩu tối thiểu 6 ký tự.';

    return '';
  }
}