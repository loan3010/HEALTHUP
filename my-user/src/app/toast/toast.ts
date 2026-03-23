import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ApiService, Toast } from '../services/api.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-wrap">
      <div *ngFor="let t of toasts; trackBy: trackById"
        class="toast-item"
        [class.t-success]="t.type==='success'"
        [class.t-error]="t.type==='error'"
        [class.t-info]="t.type==='info'"
        (click)="api.dismissToast(t.id)">
        <i class="bi"
          [class.bi-check-circle-fill]="t.type==='success'"
          [class.bi-x-circle-fill]="t.type==='error'"
          [class.bi-info-circle-fill]="t.type==='info'"></i>
        <span>{{ t.message }}</span>
      </div>
    </div>
  `,
  styles: [`
    .toast-wrap {
      position: fixed; 
      top: 100px; /* Né cái Header xanh của bà ra nè */
      right: 24px;
      z-index: 999999; 
      display: flex; 
      flex-direction: column; 
      gap: 8px;
      pointer-events: none;
    }
    .toast-item {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 18px; border-radius: 10px; min-width: 260px; max-width: 360px;
      font-size: 14px; font-weight: 500; cursor: pointer;
      pointer-events: all; 
      animation: slideIn .3s cubic-bezier(0, 0, 0.2, 1);
      background: #fff; border: 1px solid #e0e0e0;
      box-shadow: 0 8px 25px rgba(0,0,0,.15);
      color: #222; position: relative; overflow: hidden;
    }
    .toast-item::before {
      content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
    }
    .t-success::before { background: #2e7d32; }
    .t-error::before   { background: #c62828; }
    .t-info::before    { background: #1565c0; }
    
    .t-success .bi { color: #2e7d32; font-size: 17px; flex-shrink: 0; }
    .t-error   .bi { color: #c62828; font-size: 17px; flex-shrink: 0; }
    .t-info    .bi { color: #1565c0; font-size: 17px; flex-shrink: 0; }
    
    @keyframes slideIn {
      from { 
        transform: translateX(110%) translateY(-10px); 
        opacity: 0; 
      }
      to { 
        transform: translateX(0) translateY(0); 
        opacity: 1; 
      }
    }
  `]
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private sub!: Subscription;

  constructor(
    public api: ApiService,
    private cdr: ChangeDetectorRef // Dùng cái này để ép Angular "tỉnh giấc"
  ) {}

  ngOnInit() { 
    this.sub = this.api.toasts$.subscribe(t => {
      this.toasts = t;
      // Ép Angular vẽ lại giao diện ngay lập tức
      // Fix lỗi bấm thêm giỏ hàng lần đầu không hiện toast
      this.cdr.detectChanges(); 
    }); 
  }

  ngOnDestroy() { 
    if (this.sub) {
      this.sub.unsubscribe(); 
    }
  }

  trackById = (_: number, t: Toast) => t.id;
}