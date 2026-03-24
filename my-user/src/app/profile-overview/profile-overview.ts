import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';

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

  memberRank    = 'member';
  totalSpent    = 0;
  recentSpent   = 0; // chi tiêu 3 tháng gần nhất — dùng cho progress bar
  isLoadingRank = true;

  // FIX: ngưỡng VIP = 2.000.000₫ (3 tháng gần nhất)
  readonly VIP_THRESHOLD = 2_000_000;

  get memberRankLabel(): string {
    return this.memberRank === 'vip' ? ' VIP' : 'Thành viên';
  }

  // FIX: progress tính từ recentSpent / 2.000.000
  get rankProgressPercent(): number {
    return Math.min(100, Math.round((this.recentSpent / this.VIP_THRESHOLD) * 100));
  }

  get rankProgressRemain(): number {
    return Math.max(0, this.VIP_THRESHOLD - this.recentSpent);
  }

  private readonly API = 'http://localhost:3000/api';

  constructor(private fb: FormBuilder, private http: HttpClient) {}

  ngOnInit(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try { this.user = JSON.parse(userStr); } catch { this.user = {}; }
    }

    this.profileForm = this.fb.group({
      username: [this.user.username || '', [Validators.required, Validators.minLength(3)]],
      email:    [this.user.email    || '', [Validators.email]],
      phone:    [this.user.phone    || '', [Validators.pattern(/^[0-9]{9,11}$/)]],
      dob:      [this.user.dob      || ''],
      gender:   [this.user.gender   || 'male'],
      address:  [this.user.address  || '']
    });

    this.fetchRank();
  }

  private fetchRank(): void {
    const token  = localStorage.getItem('token');
    const userId = this.user.id || this.user._id;
    if (!token || !userId) { this.isLoadingRank = false; return; }

    this.http.get<any>(`${this.API}/users/${userId}`, {
      headers: new HttpHeaders({ Authorization: `Bearer ${token}` })
    }).subscribe({
      next: (u) => {
        this.memberRank  = u.memberRank  || 'member';
        this.totalSpent  = u.totalSpent  || 0;
        this.recentSpent = u.recentSpent || 0; // FIX: lấy từ API
        this.isLoadingRank = false;

        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({
          ...stored,
          memberRank:  this.memberRank,
          totalSpent:  this.totalSpent,
          recentSpent: this.recentSpent,
        }));
      },
      error: () => { this.isLoadingRank = false; }
    });
  }

  getInitials(): string {
    const name = this.user.username || '';
    if (!name) return 'U';
    const words = name.trim().split(' ');
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }

  vnd(n: number): string {
    return n.toLocaleString('vi-VN') + '₫';
  }

  onSubmit(): void {
    if (this.profileForm.invalid) {
      this.error = true;
      this.message = 'Vui lòng kiểm tra lại thông tin!';
      return;
    }

    this.isLoading = true;
    this.message = '';

    const token  = localStorage.getItem('token');
    const userId = this.user.id || this.user._id;

    this.http.put(`${this.API}/users/${userId}`, this.profileForm.value, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.error = false;
        this.message = 'Cập nhật thành công!';
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