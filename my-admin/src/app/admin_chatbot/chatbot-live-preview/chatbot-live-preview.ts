import { Component, Output, EventEmitter, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

/** Cấu trúc dữ liệu cho một tin nhắn trong khung kiểm thử */
interface TestMessage {
  type: 'user' | 'bot';
  text: string;
  time: string;
  products?: any[]; // Danh sách sản phẩm đính kèm (nếu có)
  analysis?: {
    intent: string;
    score: number;
    keywords: string;
  };
}

@Component({
  selector: 'app-chatbot-live-preview',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './chatbot-live-preview.html',
  styleUrl: './chatbot-live-preview.css'
})
export class ChatbotLivePreview implements AfterViewChecked {
  // --- KHAI BÁO CÁC THUỘC TÍNH ---
  @Output() closeChat = new EventEmitter<void>();
  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  /** Địa chỉ máy chủ Backend để tải hình ảnh sản phẩm */
  readonly serverUrl = 'http://localhost:3000';

  /** ĐỊA CHỈ APP NGƯỜI DÙNG (USER APP)
   * Bà chạy song song ng serve bên User (thường là port 4201) mới xem được trang nhé!
   */
  readonly userAppUrl = 'http://localhost:4201'; 

  /** ĐỒNG BỘ TÊN VÀ LOGO VỚI CLIENT */
  botName = 'HealthUp Assistant';

  botAvatar = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="24" fill="#36873A"/>
      <text x="24" y="30" text-anchor="middle" font-size="22" font-family="sans-serif">🌿</text>
    </svg>
  `)}`;

  userAvatar = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="24" fill="#D4A017"/>
      <text x="24" y="30" text-anchor="middle" font-size="22" font-family="sans-serif">👤</text>
    </svg>
  `)}`;

  testInput: string = '';
  isTyping: boolean = false;
  
  /** Lịch sử các tin nhắn trong phiên kiểm tra hiện tại */
  testMessages: TestMessage[] = [
    {
      type: 'bot',
      text: 'Chào bạn! Hệ thống Trợ lý ảo HealthUp đã sẵn sàng. Bạn vui lòng nhập câu hỏi để kiểm tra độ nhạy và tính chính xác của tôi nhé! 🤖',
      time: this.getCurrentTime()
    }
  ];

  // Đường dẫn API xử lý câu hỏi của Bot
  private apiUrl = 'http://localhost:3000/api/chatbot/ask';

  constructor(private http: HttpClient) {}

  /** Tự động cuộn xuống cuối danh sách mỗi khi có nội dung mới xuất hiện */
  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  // --- LOGIC XỬ LÝ TƯƠNG TÁC ---

  /**
   * Gửi tin nhắn kiểm thử và nhận phản hồi từ hệ thống AI
   */
  sendTestMessage() {
    const query = this.testInput.trim();
    if (!query || this.isTyping) return;

    // 1. Ghi nhận tin nhắn từ phía Quản trị viên
    this.testMessages.push({
      type: 'user',
      text: query,
      time: this.getCurrentTime()
    });

    this.testInput = '';
    this.isTyping = true;

    // 2. Gọi API Backend để phân tích và tìm kiếm câu trả lời
    this.http.post<any>(this.apiUrl, { message: query }).subscribe({
      next: (res) => {
        this.isTyping = false;
        
        /** * --- XỬ LÝ XUỐNG DÒNG (BẢN FIX) ---
         * Biến đổi các ký tự xuống dòng (\n) thành thẻ <br> 
         * để HTML có thể hiểu và hiển thị đúng định dạng.
         */
        const formattedAnswer = (res.answer || '').replace(/\n/g, '<br>');

        // 3. Hiển thị phản hồi từ Bot kèm theo phân tích kỹ thuật và sản phẩm gợi ý
        this.testMessages.push({
          type: 'bot',
          text: formattedAnswer, 
          time: this.getCurrentTime(),
          products: res.products || [], // Nhận mảng sản phẩm đính kèm từ Backend
          analysis: {
            intent: res.intent || 'Không xác định',
            score: res.score || 0,
            keywords: this.extractKeywords(query)
          }
        });
      },
      error: (err) => {
        console.error('Lỗi kết nối hệ thống kiểm thử:', err);
        this.isTyping = false;
        this.testMessages.push({
          type: 'bot',
          text: '❌ Không thể kết nối với máy chủ Backend. Bạn vui lòng kiểm tra lại dịch vụ.',
          time: this.getCurrentTime()
        });
      }
    });
  }

  /**
   * Chuyển hướng đến trang chi tiết sản phẩm phía USER
   * Mở tab mới để không làm gián đoạn việc quản trị bên Admin
   */
  goToProductDetail(productId: string) {
    if (!productId) return;
    
    // Tạo link tuyệt đối sang App User
    const fullUrl = `${this.userAppUrl}/product-detail-page/${productId}`;
    
    // Mở trang ở tab mới
    window.open(fullUrl, '_blank');
  }

  /**
   * Làm mới toàn bộ nội dung trò chuyện để bắt đầu quy trình kiểm thử mới
   */
  clearChat() {
    this.testMessages = [
      {
        type: 'bot',
        text: 'Dữ liệu hội thoại đã được làm mới. Bạn có thể bắt đầu quá trình kiểm tra từ đầu. ✨',
        time: this.getCurrentTime()
      }
    ];
  }

  // --- CÁC PHƯƠNG THỨC HỖ TRỢ ---

  /** Lấy thời gian hiện tại theo định dạng HH:mm */
  private getCurrentTime(): string {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' +
           now.getMinutes().toString().padStart(2, '0');
  }

  /** Điều khiển thanh cuộn luôn nằm ở vị trí tin nhắn mới nhất */
  private scrollToBottom(): void {
    try {
      if (this.chatContainer) {
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      // Bỏ qua lỗi nếu phần tử chưa sẵn sàng
    }
  }

  /**
   * Trích xuất các từ khóa chính từ câu hỏi của người dùng để hỗ trợ phân tích
   */
  private extractKeywords(text: string): string {
    const stopWords = ['có', 'không', 'là', 'bao', 'nhiêu', 'giúp', 'cho', 'cái', 'làm', 'với'];
    return text.toLowerCase()
               .split(' ')
               .filter(word => word.length > 2 && !stopWords.includes(word))
               .join(', ');
  }
}