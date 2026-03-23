import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';

const API_BASE = 'http://localhost:3000/api';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-profile.html',
  styleUrls: ['./user-profile.css'],
})
export class UserProfile implements OnInit {

  userName   = '';
  memberRank = 'member';
  totalSpent = 0;

  readonly VIP_THRESHOLD = 5_000_000;

  get memberRankLabel(): string {
<<<<<<< HEAD
    return this.memberRank === 'vip' ? 'VIP' : 'Thành viên';
=======
    return this.memberRank === 'vip' ? ' VIP' : 'Thành viên';
>>>>>>> 3f147eeab9493f389de9259be4ebb3bb041013ce
  }

  get rankProgressPercent(): number {
    return Math.min(100, Math.round((this.totalSpent / this.VIP_THRESHOLD) * 100));
  }

  get rankProgressRemain(): number {
    return Math.max(0, this.VIP_THRESHOLD - this.totalSpent);
  }

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadFromLocalStorage();
    this.fetchFreshUserData();
  }

  private loadFromLocalStorage(): void {
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    try {
      const user      = JSON.parse(userStr);
      this.userName   = user.username || user.email || user.phone || 'User';
      this.memberRank = user.memberRank || 'member';
      this.totalSpent = user.totalSpent || 0;
    } catch {
      this.userName = 'User';
    }
  }

  private fetchFreshUserData(): void {
    const token  = localStorage.getItem('token');
    const userId = this.getUserId();
    if (!token || !userId) return;

    this.http.get<any>(`${API_BASE}/users/${userId}`, {
      headers: new HttpHeaders({ Authorization: `Bearer ${token}` })
    }).subscribe({
      next: (user) => {
        this.userName   = user.username || user.email || user.phone || this.userName;
        this.memberRank = user.memberRank || 'member';
        this.totalSpent = user.totalSpent || 0;

        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...stored, ...user }));
      },
      error: () => {}
    });
  }

  private getUserId(): string {
    const direct = localStorage.getItem('userId');
    if (direct) return direct;
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user?._id || user?.id || '';
    } catch { return ''; }
  }

  getInitials(): string {
    if (!this.userName) return 'U';
    const words = this.userName.trim().split(' ');
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return this.userName.substring(0, 2).toUpperCase();
  }

  vnd(n: number): string {
    return n.toLocaleString('vi-VN') + '₫';
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    this.router.navigate(['/']);
  }
}