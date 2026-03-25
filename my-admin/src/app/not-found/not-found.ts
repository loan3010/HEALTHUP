import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule } from '@angular/router';

/**
 * Trang 404 cho admin: URL không khớp route.
 * Giọng điệu nhẹ nhàng, tránh cảm giác "lỗi hệ thống" quá cứng.
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './not-found.html',
  styleUrls: ['./not-found.css'],
})
export class NotFoundComponent {
  constructor(private location: Location) {}

  /** Đưa người dùng về trang trước trong history (nếu có). */
  goBack(): void {
    this.location.back();
  }
}
