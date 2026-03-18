import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

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
  imports: [FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {

  emailOrPhone: string = '';
  password: string = '';
  isLoading: boolean = false;

  private API = 'http://localhost:3000/api';

  constructor(private router: Router, private http: HttpClient) {

    // ⭐ tự điền sau khi register
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

        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));

        if (res.user.role === 'admin') {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/home']);
        }

        this.isLoading = false;
      },

      error: (err: HttpErrorResponse) => {
        alert(err?.error?.message || 'Sai tên tài khoản hoặc mật khẩu!');
        this.isLoading = false;
      }

    });

  }
}