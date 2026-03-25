import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule } from '@angular/router';

/**
 * Trang 404 cho app khách: URL không tồn tại.
 * Giao diện đồng bộ admin (kem + xanh #2d7a2d); nút chính về trang chủ thay vì đăng nhập.
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

  goBack(): void {
    this.location.back();
  }
}
