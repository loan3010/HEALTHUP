import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chatbot-knowledge-base',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chatbot-knowledge-base.html',
  styleUrl: './chatbot-knowledge-base.css'
})
export class ChatbotKnowledgeBase {
  // 1. KHAI BÁO CÁC BIẾN ĐỂ HẾT LỖI
  selectedCat: string = 'All'; // Biến lưu danh mục đang chọn
  categories: string[] = ['Granola', 'Trà thảo mộc', 'Trái cây sấy', 'Chính sách chung']; // Danh sách các chip

  // 2. PHÁT TÍN HIỆU SỬA CHO THẰNG CHA
  @Output() editRequest = new EventEmitter<any>();

  // Dữ liệu mẫu để hiển thị bảng
  faqList = [
    { question: 'Granola có giảm cân không?', category: 'Granola', variations: 4, answer: 'Chào bạn, Granola rất tốt cho sức khỏe...' },
    { question: 'Ship hàng bao lâu?', category: 'Chính sách chung', variations: 2, answer: 'Nội thành 1-2 ngày, ngoại thành 3-5 ngày ạ.' },
    { question: 'Trà thảo mộc có dễ ngủ không?', category: 'Trà thảo mộc', variations: 5, answer: 'Sản phẩm giúp an thần, ngủ ngon sâu giấc.' }
  ];

  onEdit(item: any) {
    this.editRequest.emit(item); // Gửi dữ liệu câu hỏi lên thằng cha để mở Modal
  }
}