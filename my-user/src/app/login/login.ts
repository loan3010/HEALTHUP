import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

type LoginRes = {
  token: string;
  user: {
    id: string;
    username?: string;
    email?: string;
    phone?: string;
    role: 'user' | 'admin';
  };
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login implements OnInit {

  emailOrPhone: string = '';
  password: string = '';
  isLoading: boolean = false;

  /** Thông báo khi tài khoản bị khóa (403 từ API) */
  loginBanMessage = '';
  /** Lý do admin nhập — hiển thị cùng thông báo khóa */
  loginBanReason = '';

  private API = 'http://localhost:3000/api';

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit(): void {
    const raw = sessionStorage.getItem('prefill_login');

    if (raw) {
      try {
        const data = JSON.parse(raw);
        this.emailOrPhone = data?.username || '';
        this.password = data?.password || '';
      } catch {}

      sessionStorage.removeItem('prefill_login');
    }
  }

  onLogin() {

    if (!this.emailOrPhone || !this.password) {
      alert('Vui lòng nhập tên tài khoản và mật khẩu!');
      return;
    }

    this.isLoading = true;

    this.http.post<LoginRes>(`${this.API}/auth/login`, {
      username: this.emailOrPhone.trim(),
      password: this.password
    })
    .subscribe({

      next: (res) => {

        // ✅ giữ code của bạn
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));

        // ✅ thêm nhẹ từ GitHub (không phá logic)
        localStorage.setItem('userId', res.user.id);

        // ✅ giữ flow điều hướng của bạn
        if (res.user.role === 'admin') {
          this.router.navigate(['/admin']).then(() => window.location.reload());
        } else {
          this.router.navigate(['/']).then(() => window.location.reload());
        }

        this.isLoading = false;
      },

      error: (err: HttpErrorResponse) => {
        const body = err.error as { message?: string; deactivationReason?: string } | null;
        // Tài khoản user bị vô hiệu hóa: API trả 403 + lý do để khách hiểu
        if (err.status === 403) {
          this.loginBanMessage = body?.message || 'Tài khoản của bạn đã bị vô hiệu hóa.';
          this.loginBanReason = String(body?.deactivationReason || '').trim();
        } else {
          alert(body?.message || 'Sai tên tài khoản hoặc mật khẩu!');
        }
        this.isLoading = false;
      }

    });

  }
}