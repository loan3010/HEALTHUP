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
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login implements OnInit {

  emailOrPhone = '';
  password     = '';
  isLoading    = false;
  errorMsg     = '';

  // ✅ MỚI: kiểm soát popup thành công
  showSuccessPopup = false;
  loggedInName     = '';

  private API = 'http://localhost:3000/api';

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit(): void {
    const raw = sessionStorage.getItem('prefill_login');
    if (raw) {
      try {
        const data = JSON.parse(raw);
        this.emailOrPhone = data?.username || '';
        this.password     = data?.password || '';
      } catch {}
      sessionStorage.removeItem('prefill_login');
    }
  }

  onLogin(): void {
    this.errorMsg = '';
    if (!this.emailOrPhone || !this.password) {
      this.errorMsg = 'Vui lòng nhập tên tài khoản và mật khẩu!';
      return;
    }

    this.isLoading = true;

    this.http.post<LoginRes>(`${this.API}/auth/login`, {
      username: this.emailOrPhone.trim(),
      password: this.password
    }).subscribe({
      next: (res) => {
        localStorage.setItem('token',  res.token);
        localStorage.setItem('user',   JSON.stringify(res.user));
        localStorage.setItem('userId', res.user.id);

        this.isLoading    = false;
        this.loggedInName = res.user.username || res.user.email || res.user.phone || 'bạn';

        // ✅ Hiện popup thành công → sau 1.8s tự điều hướng
        this.showSuccessPopup = true;
        setTimeout(() => {
          this.showSuccessPopup = false;
          if (res.user.role === 'admin') {
            this.router.navigate(['/admin']).then(() => window.location.reload());
          } else {
            this.router.navigate(['/']).then(() => window.location.reload());
          }
        }, 1800);
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;
        this.errorMsg  = err?.error?.message || 'Sai tên tài khoản hoặc mật khẩu!';
      }
    });
  }
}