import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TrackOrderModal } from '../track-order-modal/track-order-modal';

// Import TrackOrderModal nếu bạn muốn dùng modal (option 1)
// Hoặc có thể bỏ qua và dùng alert/navigate trực tiếp (option 2)

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, TrackOrderModal],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class Header implements OnInit {

  isLoggedIn = false;
  userName = '';
  showDropdown = false;
  menuOpen = false;
  showTrackOrderModal = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Kiểm tra trạng thái đăng nhập từ localStorage
    this.checkLoginStatus();
  }

  checkLoginStatus(): void {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        this.isLoggedIn = true;
        // Ưu tiên username, nếu không có thì dùng email hoặc phone
        this.userName = user.username || user.email || user.phone || 'Người dùng';
      } catch (error) {
        this.isLoggedIn = false;
        this.userName = '';
      }
    } else {
      this.isLoggedIn = false;
      this.userName = '';
    }
  }

  getInitials(): string {
    if (!this.userName) return 'U';
    
    const words = this.userName.trim().split(' ');
    if (words.length >= 2) {
      // Nếu có 2 từ trở lên, lấy chữ cái đầu của 2 từ đầu
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    // Nếu chỉ 1 từ, lấy 2 chữ cái đầu
    return this.userName.substring(0, 2).toUpperCase();
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu() {
    this.menuOpen = false;
  }

  toggleDropdown() {
    this.showDropdown = !this.showDropdown;
  }

  closeDropdown() {
    this.showDropdown = false;
  }

  // Đóng dropdown khi click ra ngoài
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) {
      this.showDropdown = false;
    }
  }

  openTrackOrder() {
    // OPTION 1: Mở modal (nếu bạn đã import TrackOrderModal component)
    this.showTrackOrderModal = true;
    
    // OPTION 2: Navigate đến trang tra cứu (nếu bạn có trang riêng)
    // this.router.navigate(['/track-order']);
    
    // OPTION 3: Alert đơn giản (để test)
    // alert('Chức năng tra cứu đơn hàng đang được phát triển!');
  }

  closeTrackOrderModal() {
    this.showTrackOrderModal = false;
  }

  logout() {
    // Xóa thông tin đăng nhập
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    this.isLoggedIn = false;
    this.userName = '';
    this.showDropdown = false;
    
    // Redirect về trang chủ
    this.router.navigate(['/']);
  }
}