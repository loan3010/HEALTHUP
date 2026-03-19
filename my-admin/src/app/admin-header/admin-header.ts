import { Component, Output, EventEmitter, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-header.html',
  styleUrls: ['./admin-header.css']
})
export class AdminHeader implements OnInit {
  @Output() toggleSidebarEvent = new EventEmitter<void>();

  adminName: string = 'Quản trị viên';
  adminFullName: string = '';
  adminID: string = '';
  showDropdown: boolean = false; // Biến điều khiển ẩn hiện menu

  constructor(private router: Router) {}

  ngOnInit() {
    // Lấy thông tin từ localStorage khi trang vừa load
    const info = localStorage.getItem('admin_info');
    if (info) {
      const admin = JSON.parse(info);
      this.adminFullName = admin.name;
      this.adminID = admin.id || 'N/A';
      this.adminName = this.getShortName(admin.name); // Lấy 2 chữ cuối
    }
  }

  // Hàm cắt lấy 2 chữ cuối (Ví dụ: Lê Thị Thúy Ngân -> Thúy Ngân)
  getShortName(fullName: string): string {
    if (!fullName) return 'Admin';
    const parts = fullName.trim().split(' ');
    return parts.length > 1 ? parts.slice(-2).join(' ') : parts[0];
  }

  onToggleClick() {
    this.toggleSidebarEvent.emit();
  }

  toggleMenu(event: Event) {
    event.stopPropagation(); // Ngăn sự kiện click lan ra ngoài
    this.showDropdown = !this.showDropdown;
  }

  // Click ra ngoài thì đóng menu
  // Bà chỉ cần xóa cái ['$event'] đi là xong nhé
  @HostListener('document:click')
  onDocumentClick() {
    this.showDropdown = false;
  }

  onLogout() {
    // Xóa sạch dấu vết quản trị viên
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_info');
    // Quay về trang đăng nhập
    this.router.navigate(['/login']);
  }
}