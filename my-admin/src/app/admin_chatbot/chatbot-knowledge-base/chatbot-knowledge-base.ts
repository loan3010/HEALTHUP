import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chatbot-knowledge-base',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chatbot-knowledge-base.html',
  styleUrl: './chatbot-knowledge-base.css'
})
export class ChatbotKnowledgeBase {
  // --- NHẬN DỮ LIỆU TỪ COMPONENT CHA (AdminChatbot) ---
  
  // Danh sách toàn bộ câu hỏi lấy từ Database
  @Input() faqs: any[] = []; 
  
  // Danh sách các danh mục sản phẩm + Chính sách chung
  @Input() categories: string[] = []; 

  // --- PHÁT TÍN HIỆU RA BÊN NGOÀI ---
  
  // Tín hiệu yêu cầu chỉnh sửa câu hỏi
  @Output() editRequest = new EventEmitter<any>();
  
  // Tín hiệu yêu cầu xóa câu hỏi (gửi kèm _id)
  @Output() deleteRequest = new EventEmitter<string>();

  // --- LOGIC XỬ LÝ NỘI BỘ ---

  // Biến lưu trữ danh mục đang được chọn để lọc (Mặc định là 'All')
  selectedCat: string = 'All';

  /**
   * Getter này tự động tính toán và trả về danh sách câu hỏi đã được lọc.
   * Giúp giao diện Admin cập nhật ngay lập tức khi bà bấm vào các Chip danh mục.
   */
  get filteredFaqs() {
    if (this.selectedCat === 'All') {
      return this.faqs;
    }
    // Lọc những câu hỏi có trường category trùng với danh mục đang chọn
    return this.faqs.filter(faq => faq.category === this.selectedCat);
  }

  /**
   * Khi bấm nút Sửa: Gửi object câu hỏi lên cha để mở Modal Form
   */
  onEdit(item: any) {
    this.editRequest.emit(item);
  }

  /**
   * Khi bấm nút Xóa: Gửi ID của câu hỏi lên cha để thực hiện lệnh DELETE API
   */
  onDelete(id: string) {
    if (id) {
      this.deleteRequest.emit(id);
    }
  }

  /**
   * Thay đổi danh mục lọc khi Admin bấm vào các Chip
   */
  selectCategory(cat: string) {
    this.selectedCat = cat;
  }
}