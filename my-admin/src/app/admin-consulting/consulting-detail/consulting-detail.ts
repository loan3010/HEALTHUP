import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common'; // Quan trọng để hết lỗi ngClass

@Component({
  selector: 'app-consulting-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './consulting-detail.html',
  styleUrls: ['./consulting-detail.css']
})
export class ConsultingDetail {
  @Input() product: any; // Chốt chặn lỗi [product]
  @Output() goBack = new EventEmitter<void>(); // Chốt chặn lỗi goBack

  isModalOpen = false;
  isSuccessModalOpen = false;
  activeQuestion: any = null;

  // Dữ liệu mẫu câu hỏi
  questions = [
    { 
      status: 'pending', 
      content: 'Nên bảo quản khoai tây như thế nào', 
      user: 'HuyenNhu', 
      time: '2 phút trước',
      answer: ''
    }
  ];

  openModal(question: any) {
    this.activeQuestion = question;
    this.isModalOpen = true; // Mở modal trả lời
  }

  showSuccess() {
    this.isModalOpen = false;
    this.isSuccessModalOpen = true; // Hiện modal tích xanh thành công
    
    // Giả lập cập nhật trạng thái đã trả lời
    if (this.activeQuestion) {
      this.activeQuestion.status = 'answered';
      this.activeQuestion.answer = 'Bảo quản ở nơi khô ráo, thoáng khí...';
    }
  }

  closeAllModals() {
    this.isSuccessModalOpen = false;
    this.isModalOpen = false;
  }
}