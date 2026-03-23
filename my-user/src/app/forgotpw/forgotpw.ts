import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  QueryList,
  ViewChildren,
  inject,
  OnDestroy,
  AfterViewInit,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { interval, Subscription } from 'rxjs';

/** Lưu JWT reset tạm (30p) sau bước OTP demo — không phải token đăng nhập */
const FORGOTPW_RESET_TOKEN_KEY = 'HEALTHUP_FORGOTPW_RESET_TOKEN';

/** Đồng bộ với backend: mã OTP có hiệu lực 60 giây */
const FORGOT_OTP_TTL_SECONDS = 60;

@Component({
  selector: 'app-forgotpw',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgotpw.html',
  styleUrls: ['./forgotpw.css'],
})
export class Forgotpw implements OnInit, OnDestroy, AfterViewInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private http = inject(HttpClient);
  /** Bắt buộc refresh view mỗi giây — setInterval/interval đôi khi không kích hoạt CD (UI chỉ cập nhật khi click) */
  private cdr = inject(ChangeDetectorRef);

  private API = 'http://localhost:3000/api';

  loading = false;
  message = '';
  error = '';

  /** Sau OTP thành công: hiện form đặt MK + banner demo (không SMS thật) */
  showNewPasswordStep = false;
  /** Nội dung banner giải thích demo — luôn có khi vào bước đặt MK */
  otpDemoBanner = '';

  showOtp = false;
  otpError = '';
  otpSecondsLeft = FORGOT_OTP_TTL_SECONDS;
  /** Đếm ngược bằng RxJS interval + detectChanges — chạy mượt, không phụ thuộc click */
  private countdownSub: Subscription | null = null;

  /** 6 số server trả về — hiển thị như “tin nhắn” thay SMS (demo) */
  demoOtpDisplay = '';

  /** Mỗi ô đúng 1 ký tự — không bind [value] vào template để tránh lệch DOM/Angular (bug 1,1,2) */
  otpValues: string[] = ['', '', '', '', '', ''];

  @ViewChildren('otpInput')
  otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  trackByIndex = (i: number) => i;

  form = this.fb.group({
    phone: ['', [Validators.required, Validators.pattern(/^(0|\+84)\d{9,10}$/)]],
  });

  /** Form bước 2: mật khẩu mới */
  resetPwdForm = this.fb.group({
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  });

  ngOnInit(): void {
    // F5 giữa chừng: còn token reset thì cho tiếp tục nhập MK
    if (sessionStorage.getItem(FORGOTPW_RESET_TOKEN_KEY)) {
      this.showNewPasswordStep = true;
      this.otpDemoBanner =
        'Phiên đặt lại mật khẩu vẫn còn hiệu lực. Nhập mật khẩu mới bên dưới, hoặc chọn làm lại từ đầu.';
    }
  }

  ngAfterViewInit(): void {
    this.otpInputs?.changes.subscribe(() => {
      if (this.showOtp) setTimeout(() => this.focusOtp(0), 0);
    });
  }

  closeOtp(): void {
    this.showOtp = false;
    this.otpError = '';
    this.demoOtpDisplay = '';
    this.clearOtpInterval();
  }

  /** Xóa phiên reset và quay lại nhập SĐT */
  restartFromPhoneStep(): void {
    sessionStorage.removeItem(FORGOTPW_RESET_TOKEN_KEY);
    this.showNewPasswordStep = false;
    this.otpDemoBanner = '';
    this.demoOtpDisplay = '';
    this.resetPwdForm.reset();
    this.error = '';
    this.message = '';
  }

  /**
   * Gọi API tạo OTP 6 số ngẫu nhiên trên server — chỉ mở modal khi thành công.
   * Mã hiện trên màn hình (demo thay SMS); user phải nhập đúng mã đó.
   */
  openOtpPopup(): void {
    this.error = '';
    this.message = '';
    this.otpError = '';
    this.demoOtpDisplay = '';

    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error = 'Vui lòng nhập số điện thoại hợp lệ.';
      return;
    }

    const phoneVal = String(this.form.controls.phone.value || '').trim();
    this.loading = true;

    this.http
      .post<{
        demoOtp?: string;
        expiresInSeconds?: number;
      }>(`${this.API}/auth/forgotpw/request-otp`, { phone: phoneVal })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res) => {
          const code = String(res?.demoOtp || '').replace(/\D/g, '');
          if (!/^\d{6}$/.test(code)) {
            this.error = 'Không nhận được mã OTP từ server. Thử lại sau.';
            return;
          }
          this.demoOtpDisplay = code;
          this.message =
            '(Demo) Dưới đây là mã thay tin nhắn SMS — trên thật chỉ hiện trên điện thoại.';

          this.showOtp = true;
          this.resetOtp();
          const sec = Math.min(
            Math.max(1, Number(res?.expiresInSeconds) || FORGOT_OTP_TTL_SECONDS),
            FORGOT_OTP_TTL_SECONDS
          );
          this.startCountdown(sec);

          setTimeout(() => this.focusOtp(0), 0);
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          const msg = err?.error?.message;
          this.error =
            msg ||
            (err.status === 404
              ? 'Số điện thoại chưa đăng ký.'
              : 'Không gửi được mã OTP. Vui lòng thử lại.');
        },
      });
  }

  /**
   * Đếm ngược từng giây. Hết giờ → gọi API cấp mã mới (xoay OTP 60s) thay vì đóng modal.
   * detectChanges() mỗi tick: tránh lỗi số giây chỉ nhảy khi có sự kiện (click) trên một số môi trường.
   */
  private startCountdown(seconds: number): void {
    this.otpSecondsLeft = seconds;
    this.clearOtpInterval();

    this.countdownSub = interval(1000).subscribe(() => {
      this.otpSecondsLeft--;
      this.cdr.detectChanges();

      if (this.otpSecondsLeft <= 0) {
        this.clearOtpInterval();
        this.rotateOtpInModal();
      }
    });
  }

  /** Hết 60s: xin mã mới từ server, xóa ô nhập, bắt đầu đếm lại */
  private rotateOtpInModal(): void {
    if (!this.showOtp) return;

    const phoneVal = String(this.form.controls.phone.value || '').trim();
    if (!phoneVal) {
      this.closeOtp();
      return;
    }

    this.http
      .post<{
        demoOtp?: string;
        expiresInSeconds?: number;
      }>(`${this.API}/auth/forgotpw/request-otp`, { phone: phoneVal })
      .subscribe({
        next: (res) => {
          if (!this.showOtp) return;

          const code = String(res?.demoOtp || '').replace(/\D/g, '');
          if (!/^\d{6}$/.test(code)) {
            this.otpError = 'Không nhận được mã mới. Đóng và bấm «Gửi mã OTP» lại.';
            this.cdr.detectChanges();
            return;
          }

          this.demoOtpDisplay = code;
          this.otpSecondsLeft = Math.min(
            Math.max(1, Number(res?.expiresInSeconds) || FORGOT_OTP_TTL_SECONDS),
            FORGOT_OTP_TTL_SECONDS
          );
          this.resetOtp();
          this.otpError =
            'Mã cũ đã hết hiệu lực. Đã có mã mới — xem trong khung tin nhắn bên trên.';
          this.startCountdown(this.otpSecondsLeft);
          this.cdr.detectChanges();
        },
        error: () => {
          if (!this.showOtp) return;
          this.showOtp = false;
          this.demoOtpDisplay = '';
          this.message =
            'Không làm mới mã OTP. Bấm «Gửi mã OTP» để thử lại.';
          this.cdr.detectChanges();
        },
      });
  }

  private clearOtpInterval(): void {
    if (this.countdownSub) {
      this.countdownSub.unsubscribe();
      this.countdownSub = null;
    }
  }

  private resetOtp(): void {
    this.otpValues = ['', '', '', '', '', ''];
    this.otpError = '';
    setTimeout(() => this.flushOtpDom(), 0);
  }

  /** Đồng bộ từ mảng → từng ô input (vì không dùng [value]) */
  private flushOtpDom(): void {
    const inputs = this.otpInputs?.toArray() ?? [];
    inputs.forEach((ref, i) => {
      const el = ref.nativeElement;
      el.value = this.otpValues[i] ?? '';
    });
  }

  private focusOtp(index: number): void {
    const inputs = this.otpInputs?.toArray() ?? [];
    const el = inputs[index]?.nativeElement;
    if (!el) return;

    el.focus();
    try {
      el.setSelectionRange(0, el.value.length);
    } catch {
      /* IE */
    }
  }

  /**
   * Một ô chỉ nhận đúng 1 chữ số: nếu trình duyệt/IME nhồi "12" vào một ô,
   * chỉ giữ ký tự cuối; nếu nhiều số thì phân vào các ô kế tiếp.
   */
  onOtpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const raw = (input.value ?? '').replace(/\D/g, '');

    if (raw.length > 1) {
      this.fillOtpFrom(index, raw);
      return;
    }

    const ch = raw.length === 1 ? raw : '';
    this.otpValues[index] = ch;
    input.value = ch;
    this.otpError = '';

    if (ch) {
      if (index < 5) this.focusOtp(index + 1);
      else this.tryAutoSubmit();
    }
  }

  onOtpKeydown(event: KeyboardEvent, index: number): void {
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
      const inputs = this.otpInputs?.toArray() ?? [];
      if (this.otpValues[index]) {
        this.otpValues[index] = '';
        inputs[index] && (inputs[index].nativeElement.value = '');
      } else if (index > 0) {
        this.otpValues[index - 1] = '';
        const prev = inputs[index - 1]?.nativeElement;
        if (prev) prev.value = '';
        this.focusOtp(index - 1);
      }
    }
  }

  onOtpPaste(event: ClipboardEvent, index: number): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') ?? '';
    const digits = text.replace(/\D/g, '');
    if (!digits) return;

    this.fillOtpFrom(index, digits);
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

    if (i <= 5) this.focusOtp(i);
    else this.tryAutoSubmit();
  }

  private tryAutoSubmit(): void {
    const otp = this.otpValues.join('');
    if (otp.length === 6) this.confirmOtp();
  }

  /** OTP demo: chỉ cần đủ 6 số; server kiểm tra SĐT và cấp resetToken */
  confirmOtp(): void {
    this.error = '';
    this.otpError = '';

    const otp = this.otpValues.join('');
    const phoneVal = String(this.form.controls.phone.value || '').trim();

    if (!/^\d{6}$/.test(otp)) {
      this.otpError = 'Vui lòng nhập đủ 6 số OTP.';
      return;
    }

    this.loading = true;
    this.http
      .post<any>(`${this.API}/auth/forgotpw/verify`, { phone: phoneVal, otp })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res) => {
          if (!res?.resetToken) {
            this.otpError = 'Không nhận được mã đặt lại mật khẩu. Thử lại sau.';
            return;
          }

          this.clearOtpInterval();
          sessionStorage.setItem(FORGOTPW_RESET_TOKEN_KEY, res.resetToken);

          this.showOtp = false;
          this.demoOtpDisplay = '';
          this.showNewPasswordStep = true;
          this.otpDemoBanner =
            'Mã OTP đúng. Nhập mật khẩu mới bên dưới để hoàn tất.';

          this.resetPwdForm.reset();
        },
        error: (err: HttpErrorResponse) => {
          const msg = err?.error?.message;
          this.otpError =
            msg ||
            (err.status === 404
              ? 'Số điện thoại chưa đăng ký.'
              : 'Không xác thực được. Vui lòng thử lại.');
        },
      });
  }

  submitNewPassword(): void {
    this.error = '';
    this.message = '';

    const token = sessionStorage.getItem(FORGOTPW_RESET_TOKEN_KEY);
    if (!token) {
      this.error = 'Phiên đặt lại đã hết hạn. Vui lòng nhập SĐT và OTP lại từ đầu.';
      this.showNewPasswordStep = false;
      return;
    }

    this.resetPwdForm.markAllAsTouched();
    if (this.resetPwdForm.invalid) {
      this.error = 'Vui lòng nhập mật khẩu hợp lệ (tối thiểu 6 ký tự) và xác nhận.';
      return;
    }

    const pw = String(this.resetPwdForm.get('newPassword')?.value || '');
    const cfm = String(this.resetPwdForm.get('confirmPassword')?.value || '');
    if (pw !== cfm) {
      this.error = 'Mật khẩu xác nhận không khớp.';
      return;
    }

    this.loading = true;
    this.http
      .post<{ message?: string }>(`${this.API}/auth/forgotpw/set-password`, {
        resetToken: token,
        newPassword: pw,
      })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: () => {
          sessionStorage.removeItem(FORGOTPW_RESET_TOKEN_KEY);
          this.router.navigate(['/login'], { queryParams: { pwdReset: '1' } });
        },
        error: (err: HttpErrorResponse) => {
          this.error = err?.error?.message || 'Đặt mật khẩu thất bại. Thử lại.';
        },
      });
  }

  showErr(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return !!(c.touched && c.invalid);
  }

  errText(name: keyof typeof this.form.controls): string {
    const c = this.form.controls[name];
    if (c.errors?.['required']) return 'Trường này không được để trống.';
    if (c.errors?.['pattern']) return 'Số điện thoại không hợp lệ.';
    return 'Kiểm tra lại số điện thoại.';
  }

  showResetErr(name: 'newPassword' | 'confirmPassword'): boolean {
    const c = this.resetPwdForm.get(name);
    return !!(c && c.touched && c.invalid);
  }

  ngOnDestroy(): void {
    this.clearOtpInterval();
  }
}
