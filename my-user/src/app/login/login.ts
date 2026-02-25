import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';


type LoginRes = {
  token: string;
  user: { id: string; email: string; role: 'user' | 'admin' };
};

@Component({
  selector: 'app-login',
  standalone: true, 
  imports: [FormsModule, RouterModule],  
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {

  email: string = '';
  password: string = '';
  isLoading: boolean = false;

  // ✅ Đổi port nếu backend bạn chạy port khác
  private API = 'http://localhost:3000/api';

  constructor(private router: Router, private http: HttpClient) {}

  onLogin() {
    if (!this.email || !this.password) {
      alert('Vui lòng nhập email và mật khẩu!');
      return;
    }

    this.isLoading = true;

    this.http.post<LoginRes>(`${this.API}/auth/login`, {
      email: this.email,
      password: this.password
    }).subscribe({
      next: (res) => {
        // ✅ Lưu để dùng cho admin các phần sau
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));

        alert('Đăng nhập thành công!');

        // ✅ Điều hướng theo role (tuỳ route bạn đặt)
        if (res.user.role === 'admin') {
          this.router.navigate(['/admin']); // đổi nếu bạn dùng route khác
        } else {
          this.router.navigate(['/home']);
        }

        this.isLoading = false;
      },
      error: (err: HttpErrorResponse) => {
        alert(err?.error?.message || 'Sai email hoặc mật khẩu!');
        this.isLoading = false;
      }
    });
  }
}