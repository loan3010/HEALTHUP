import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  QueryList,
  ViewChildren,
  OnInit,
  OnDestroy,
  inject
} from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { interval, Subscription } from 'rxjs';

const REGISTER_OTP_TTL = 60;

type RegisterRes = { message: string; id?: string; token?: string; user?: any; };

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class Register implements OnInit, OnDestroy {
  private fb     = inject(FormBuilder);
  private router = inject(Router);
  private http   = inject(HttpClient);
  private cdr    = inject(ChangeDetectorRef);

  form!: FormGroup;

  loading = false;
  message = '';
  error   = '';

  showOtp        = false;
  otpError       = '';
  otpSecondsLeft = REGISTER_OTP_TTL;
  demoOtpDisplay = '';       // mã hiện như SMS bubble

  private countdownSub: Subscription | null = null;
  otpValues: string[] = ['', '', '', '', '', ''];

  @ViewChildren('otpInput')
  otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  private API = 'http://localhost:3000/api';

  constructor() {
    this.form = new FormBuilder().group({
      username: ['', [
        Validators.required, Validators.minLength(3), Validators.maxLength(50),
        Validators.pattern(/^(?!\d+$)[\p{L}\d\s]+$/u)
      ]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{9,11}$/)]],
      email: ['', [Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    });
  }

  ngOnInit(): void { setTimeout(() => this.resetRegisterForm(), 0); }

  ngOnDestroy(): void { this.clearCountdown(); }

  get passwordMismatch(): boolean {
    return this.form.get('password')?.value !== this.form.get('confirmPassword')?.value;
  }

  // ── RESET ──
  private resetOtpUI(): void {
    this.otpValues     = ['', '', '', '', '', ''];
    this.otpError      = '';
    this.demoOtpDisplay = '';
    const inputs = this.otpInputs?.toArray?.() ?? [];
    inputs.forEach(el => (el.nativeElement.value = ''));
  }

  private resetRegisterForm(): void {
    this.form.reset();
    this.form.markAsPristine();
    this.form.markAsUntouched();
    Object.keys(this.form.controls).forEach(k => this.form.get(k)?.setErrors(null));
    this.resetOtpUI();
    this.message = '';
    this.error   = '';
  }

  closeOtpPopup(): void {
    this.showOtp = false;
    this.clearCountdown();
    this.resetOtpUI();
  }

  // ── MỞ POPUP + GỌI API LẤY OTP ──
  openOtpPopup(): void {
    this.error   = '';
    this.message = '';
    this.otpError = '';

    if (this.form.invalid || this.passwordMismatch) {
      this.form.markAllAsTouched();
      if (this.passwordMismatch) this.error = 'Mật khẩu xác nhận không khớp.';
      return;
    }

    const phoneVal = String(this.form.get('phone')?.value || '').trim();
    this.loading = true;

    // Gọi endpoint lấy OTP (dùng chung với forgotpw hoặc route riêng)
    this.http
      .post<{ demoOtp?: string; expiresInSeconds?: number }>(
        `${this.API}/auth/register/request-otp`,
        { phone: phoneVal }
      )
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res) => {
          const code = String(res?.demoOtp || '').replace(/\D/g, '');
          if (!/^\d{6}$/.test(code)) {
            this.error = 'Không nhận được mã OTP từ server. Thử lại sau.';
            return;
          }

          this.demoOtpDisplay = code;
          this.showOtp = true;
          this.resetOtpUI();
          this.demoOtpDisplay = code;   // gán lại sau reset

          const sec = Math.min(
            Math.max(1, Number(res?.expiresInSeconds) || REGISTER_OTP_TTL),
            REGISTER_OTP_TTL
          );
          this.startCountdown(sec);
          setTimeout(() => this.otpInputs?.first?.nativeElement?.focus(), 0);
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.error = err?.error?.message ||
            (err.status === 409 ? 'Số điện thoại đã được đăng ký.' : 'Không gửi được mã OTP. Thử lại.');
        }
      });
  }

  // ── ĐẾM NGƯỢC ──
  private startCountdown(seconds: number): void {
    this.otpSecondsLeft = seconds;
    this.clearCountdown();

    this.countdownSub = interval(1000).subscribe(() => {
      this.otpSecondsLeft--;
      this.cdr.detectChanges();

      if (this.otpSecondsLeft <= 0) {
        this.clearCountdown();
        this.showOtp = false;
        this.demoOtpDisplay = '';
        this.otpError = '';
        this.message = 'Mã OTP đã hết hạn. Vui lòng bấm Đăng ký lại để nhận mã mới.';
        this.cdr.detectChanges();
      }
    });
  }

  private clearCountdown(): void {
    if (this.countdownSub) { this.countdownSub.unsubscribe(); this.countdownSub = null; }
  }

  // ── OTP INPUT HANDLERS ──
  private flushOtpDom(): void {
    const inputs = this.otpInputs?.toArray?.() ?? [];
    inputs.forEach((ref, i) => (ref.nativeElement.value = this.otpValues[i] ?? ''));
  }

  private fillOtpFrom(startIndex: number, digits: string): void {
    let i = startIndex;
    for (const ch of digits.replace(/\D/g, '')) {
      if (i > 5) break;
      this.otpValues[i] = ch;
      i++;
    }
    this.otpError = '';
    this.flushOtpDom();
    if (i <= 5) this.otpInputs.toArray()[i]?.nativeElement?.focus();
  }

  onOtpInput(event: Event, index: number): void {
    const el  = event.target as HTMLInputElement;
    const raw = (el.value || '').replace(/\D/g, '');

    if (raw.length > 1) { this.fillOtpFrom(index, raw); return; }

    const ch = raw.length === 1 ? raw : '';
    this.otpValues[index] = ch;
    el.value = ch;
    this.otpError = '';
    if (ch && index < 5) this.otpInputs.toArray()[index + 1]?.nativeElement?.focus();
  }

  onOtpKeydown(event: KeyboardEvent, index: number): void {
    const key = event.key;
    if (key.length === 1 && !/^\d$/.test(key)) { event.preventDefault(); return; }

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

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const digits = (event.clipboardData?.getData('text') || '').replace(/\D/g, '');
    if (!digits) return;
    this.fillOtpFrom(0, digits);
  }

  // ── XÁC NHẬN OTP + ĐĂNG KÝ ──
  confirmOtpAndRegister(): void {
    this.error   = '';
    this.message = '';
    this.otpError = '';

    const enteredOtp = this.otpValues.join('');
    if (enteredOtp.length !== 6) { this.otpError = 'Vui lòng nhập đủ 6 số OTP.'; return; }
    if (this.passwordMismatch)   { this.error = 'Mật khẩu xác nhận không khớp.'; return; }
    if (this.form.invalid)       { this.form.markAllAsTouched(); return; }

    this.clearCountdown();

    const usernameVal = String(this.form.get('username')?.value || '').trim();
    const phoneVal    = String(this.form.get('phone')?.value    || '').trim();
    const passwordVal = String(this.form.get('password')?.value || '');
    const emailVal    = String(this.form.get('email')?.value    || '').trim();

    const payload: any = { username: usernameVal, phone: phoneVal, password: passwordVal, role: 'user', otp: enteredOtp };
    if (emailVal) payload.email = emailVal;

    this.loading = true;
    this.http
      .post<RegisterRes>(`${this.API}/auth/register`, payload)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res) => {
          this.showOtp = false;
          this.message = res?.message || 'Đăng ký thành công!';
          this.error   = '';

          sessionStorage.setItem(
            'prefill_login',
            JSON.stringify({ username: usernameVal, password: passwordVal })
          );

          this.resetRegisterForm();
          setTimeout(() => this.router.navigate(['/login']), 300);
        },
        error: (err: HttpErrorResponse) => {
          this.showOtp  = false;
          this.error    = err?.error?.message || 'Đăng ký thất bại!';
        }
      });
  }

  // ── VALIDATION ──
  showErr(controlName: string): boolean {
    const c = this.form.get(controlName);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  errText(controlName: string): string {
    const c = this.form.get(controlName);
    if (!c) return '';
    if (controlName !== 'email' && c.errors?.['required']) return 'Trường này là bắt buộc.';
    if (controlName === 'username' && c.errors?.['minlength']) return 'Tên tài khoản tối thiểu 3 ký tự.';
    if (controlName === 'username' && c.errors?.['maxlength']) return 'Tên tài khoản tối đa 50 ký tự.';
    if (controlName === 'username' && c.errors?.['pattern'])   return 'Tên tài khoản không được chỉ gồm chữ số.';
    if (controlName === 'phone'    && c.errors?.['pattern'])   return 'Số điện thoại không hợp lệ.';
    if (c.errors?.['email'])                                   return 'Email không hợp lệ.';
    if (controlName === 'password' && c.errors?.['minlength']) return 'Mật khẩu tối thiểu 6 ký tự.';
    return '';
  }
}