import { Component, ElementRef, QueryList, ViewChildren } from '@angular/core';
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
export class Register {
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
      username: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{9,11}$/)]],
      email: ['', [Validators.email]], // email optional
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    });
  }

  get passwordMismatch(): boolean {
    return this.form.get('password')?.value !== this.form.get('confirmPassword')?.value;
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

  onOtpInput(event: any, index: number): void {
    const value = (event.target.value || '').replace(/[^0-9]/g, '');
    event.target.value = value;
    this.otpValues[index] = value;
    this.otpError = '';

    if (value && index < 5) {
      this.otpInputs.toArray()[index + 1]?.nativeElement?.focus();
    }
  }

  onOtpKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.otpValues[index] && index > 0) {
      this.otpInputs.toArray()[index - 1]?.nativeElement?.focus();
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text') || '';
    const digits = pasted.replace(/\D/g, '');

    if (digits.length === 6) {
      this.otpValues = digits.split('');
      const inputs = this.otpInputs.toArray();
      inputs.forEach((input, i) => (input.nativeElement.value = this.otpValues[i]));
      inputs[5]?.nativeElement?.focus();
    }
    event.preventDefault();
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

    const payload: any = {
      username: String(this.form.get('username')?.value || '').trim(),
      phone: String(this.form.get('phone')?.value || '').trim(),
      password: String(this.form.get('password')?.value || ''),
      role: 'user'
    };

    const emailVal = String(this.form.get('email')?.value || '').trim();
    if (emailVal) payload.email = emailVal;

    console.log('[REGISTER] payload =>', payload);

    this.loading = true;

    this.http
      .post<RegisterRes>(`${this.API}/auth/register`, payload)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res) => {
          console.log('[REGISTER] response =>', res);

          this.showOtp = false;
          this.message = res?.message || 'Đăng ký thành công!';
          this.error = '';

          // nếu backend trả token thì lưu luôn (tuỳ bạn)
          if (res?.token) localStorage.setItem('token', res.token);
          if (res?.user) localStorage.setItem('user', JSON.stringify(res.user));

          setTimeout(() => this.router.navigate(['/login']), 800);
        },
        error: (err: HttpErrorResponse) => {
          console.log('[REGISTER] error =>', err);
          this.showOtp = false;
          this.error = err?.error?.message || 'Đăng ký thất bại!';
        }
      });
  }

  // ===== VALIDATION HELPERS (PHẢI CÓ VÌ HTML ĐANG DÙNG) =====
showErr(controlName: string): boolean {
  const control = this.form.get(controlName);
  return !!(control && control.invalid && (control.dirty || control.touched));
}

errText(controlName: string): string {
  const control = this.form.get(controlName);
  if (!control) return '';

  // email KHÔNG bắt buộc
  if (controlName !== 'email' && control.errors?.['required']) {
    return 'Trường này là bắt buộc.';
  }

  if (control.errors?.['email']) return 'Email không hợp lệ.';
  if (control.errors?.['pattern']) return 'Số điện thoại không hợp lệ.';
  if (control.errors?.['minlength']) return 'Mật khẩu tối thiểu 6 ký tự.';

  return '';
}
}