import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AccountDisabledService } from './account-disabled.service';

/**
 * Lớp phủ toàn viewport: pointer-events bắt toàn bộ click, nội dung app phía sau không tương tác được.
 */
@Component({
  selector: 'app-account-disabled-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './account-disabled-overlay.html',
  styleUrl: './account-disabled-overlay.css',
})
export class AccountDisabledOverlay {
  readonly svc = inject(AccountDisabledService);
  private readonly router = inject(Router);

  goLogin(): void {
    this.svc.dismissOverlay();
    void this.router.navigateByUrl('/login');
  }
}
