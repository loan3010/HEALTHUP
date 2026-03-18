import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-profile-overview',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile-overview.html',
  styleUrls: ['./profile-overview.css'],
})
export class ProfileOverview implements OnInit {
  
  profileForm!: FormGroup;
  user: any = {};
  isLoading = false;
  message = '';
  error = false;

  private API = 'http://localhost:3000/api';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Lấy user từ localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        this.user = JSON.parse(userStr);
      } catch (error) {
        this.user = {};
      }
    }

    // Khởi tạo form
    this.profileForm = this.fb.group({
      username: [this.user.username || '', [Validators.required, Validators.minLength(3)]],
      email: [this.user.email || '', [Validators.email]],
      phone: [this.user.phone || '', [Validators.pattern(/^[0-9]{9,11}$/)]],
      dob: [this.user.dob || ''],
      gender: [this.user.gender || 'male'],
      address: [this.user.address || '']
    });
  }

  getInitials(): string {
    const name = this.user.username || '';
    if (!name) return 'U';
    
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  onSubmit(): void {
    if (this.profileForm.invalid) {
      this.error = true;
      this.message = 'Vui lòng kiểm tra lại thông tin!';
      return;
    }

    this.isLoading = true;
    this.message = '';

    const token = localStorage.getItem('token');
    const userId = this.user.id;

    // Gọi API cập nhật profile
    this.http
      .put(`${this.API}/users/${userId}`, this.profileForm.value, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .subscribe({
        next: (res: any) => {
          this.isLoading = false;
          this.error = false;
          this.message = 'Cập nhật thành công!';
          
          // Cập nhật localStorage
          const updatedUser = { ...this.user, ...this.profileForm.value };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          this.user = updatedUser;
        },
        error: (err: HttpErrorResponse) => {
          this.isLoading = false;
          this.error = true;
          this.message = err?.error?.message || 'Cập nhật thất bại!';
        }
      });
  }
}