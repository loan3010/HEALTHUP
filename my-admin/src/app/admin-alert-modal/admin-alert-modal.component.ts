import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminAlertModalService } from './admin-alert-modal.service';

/**
 * Gắn một lần trong admin-layout. Mọi chỗ gọi AdminAlertModalService.show() sẽ hiện đây.
 */
@Component({
  selector: 'app-admin-alert-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ng-container *ngIf="alert.open$ | async as p">
      <div class="aad-backdrop" (click)="alert.close()" role="presentation"></div>
      <div class="aad-dialog" role="alertdialog" [attr.aria-labelledby]="'aad-title'">
        <h3 id="aad-title" class="aad-title" [class.aad-err]="p.isError">{{ p.title }}</h3>
        <p class="aad-body">{{ p.message }}</p>
        <button type="button" class="aad-btn" (click)="alert.close()">Đóng</button>
      </div>
    </ng-container>
  `,
  styles: [
    `
      .aad-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 20000;
      }
      .aad-dialog {
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(400px, calc(100vw - 32px));
        background: #fff;
        border-radius: 12px;
        padding: 20px 22px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
        border: 1px solid #e8e8e8;
        z-index: 20001;
      }
      .aad-title {
        margin: 0 0 10px;
        font-size: 1.05rem;
        font-weight: 800;
        color: #1a1a1a;
      }
      .aad-title.aad-err {
        color: #b91c1c;
      }
      .aad-body {
        margin: 0 0 18px;
        font-size: 0.92rem;
        line-height: 1.45;
        color: #444;
        white-space: pre-wrap;
      }
      .aad-btn {
        border: none;
        border-radius: 8px;
        padding: 10px 18px;
        font-weight: 700;
        cursor: pointer;
        background: #2fa333;
        color: #fff;
      }
      .aad-btn:hover {
        filter: brightness(1.05);
      }
    `,
  ],
})
export class AdminAlertModalComponent {
  constructor(readonly alert: AdminAlertModalService) {}
}
