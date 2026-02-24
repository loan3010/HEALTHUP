import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-promotion-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './promotion-form.html',
  styleUrls: ['./promotion-form.css']
})
export class PromotionForm implements OnInit {
  // KHAI BÁO INPUT ĐỂ HẾT LỖI NG8002
  @Input() mode: 'add' | 'edit' = 'add';
  @Input() promoData: any = null;
  @Output() goBack = new EventEmitter<void>();

  formData: any = {
    name: '',
    code: '',
    status: 'upcoming',
    start: '',
    end: '',
    limit: 100,
    description: ''
  };

  ngOnInit(): void {
    // Nếu là edit, đổ dữ liệu cũ vào form
    if (this.mode === 'edit' && this.promoData) {
      this.formData = { ...this.promoData };
    } else {
      // Nếu là add, để mặc định
      this.formData = {
        name: '',
        code: '',
        status: 'upcoming',
        start: '2026-02-15',
        end: '2026-03-15',
        limit: 100,
        description: ''
      };
    }
  }

  onSave(): void {
    console.log('Lưu khuyến mãi:', this.formData);
    this.goBack.emit();
  }
}