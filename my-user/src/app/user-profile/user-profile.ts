import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';

// ✅ Map tất cả các tên field có thể có từ backend → label hiển thị
const RANK_LABEL: Record<string, string> = {
  // Tiếng Anh phổ biến
  bronze:   'Đồng',
  silver:   'Bạc',
  gold:     'Vàng',
  platinum: 'Bạch Kim',
  diamond:  'Kim Cương',
  vip:      'VIP',
  // Tiếng Việt
  'thanh vien': 'Thành viên',
  'dong':       'Đồng',
  'bac':        'Bạc',
  'vang':       'Vàng',
  // Số
  '0': 'Thành viên',
  '1': 'Đồng',
  '2': 'Bạc',
  '3': 'Vàng',
  '4': 'Bạch Kim',
};

const API_BASE = 'http://localhost:3000/api';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-profile.html',
  styleUrls: ['./user-profile.css'],
})
export class UserProfile implements OnInit {

  userName    = '';
  memberRank  = 'Thành viên'; // ✅ default fallback

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadFromLocalStorage();
    this.fetchFreshUserData();
  }

  // ── Bước 1: Hiển thị ngay từ localStorage (không chờ API) ──
  private loadFromLocalStorage(): void {
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    try {
      const user = JSON.parse(userStr);
      this.userName   = user.username || user.email || user.phone || 'User';
      this.memberRank = this.resolveRank(user);
    } catch {
      this.userName = 'User';
    }
  }

  // ── Bước 2: Gọi API lấy data mới nhất, cập nhật rank ──
  private fetchFreshUserData(): void {
    const token  = localStorage.getItem('token');
    const userId = this.getUserId();
    if (!token || !userId) return;

    this.http.get<any>(`${API_BASE}/users/${userId}`, {
      headers: new HttpHeaders({ Authorization: `Bearer ${token}` })
    }).subscribe({
      next: (user) => {
        this.userName   = user.username || user.email || user.phone || this.userName;
        this.memberRank = this.resolveRank(user);

        // ✅ Cập nhật lại localStorage để lần sau dùng được
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...stored, ...user }));
      },
      error: () => {} // giữ nguyên giá trị từ localStorage nếu lỗi
    });
  }

  // ── Đọc rank từ nhiều field có thể có ──
  private resolveRank(user: any): string {
    // Thử lần lượt các field phổ biến
    const raw =
      user?.rank           ??
      user?.membershipTier ??
      user?.membership     ??
      user?.tier           ??
      user?.level          ??
      user?.memberRank     ??
      '';

    if (!raw && raw !== 0) return 'Thành viên';

    const key = String(raw).toLowerCase().trim();
    return RANK_LABEL[key] ?? String(raw); // fallback: hiện nguyên giá trị từ backend
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

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    this.router.navigate(['/']);
  }
}