import { Component, Output, EventEmitter, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
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

  // --- ẢNH DỰ PHÒNG XỊN SÒ (BASE64) ---
  fallbackImage = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
      <rect width="150" height="150" fill="#f8f9fa"/>
      <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="bold" fill="#adb5bd">HealthUp</text>
      <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#ced4da">No Image</text>
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

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef // Thuốc đặc trị để UI cập nhật tức thì
  ) {}

  /** Tự động cuộn xuống cuối danh sách mỗi khi có nội dung mới xuất hiện */
  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  // --- LOGIC XỬ LÝ TƯƠNG TÁC ---

  /** * HÀM TÌM ẢNH SIÊU CẤP (Bản Admin)
   * Giúp xử lý ảnh sản phẩm mượt mà không bị lỗi
   */
  getFullImageUrl(data: any): string {
    if (!data) return this.fallbackImage;

    let imgName = '';
    if (typeof data === 'object' && !Array.isArray(data)) {
      imgName = data.image || data.thumbnail || data.imageUrl || (data.images?.[0]);
    } else if (Array.isArray(data) && data.length > 0) {
      imgName = data[0];
    } else if (typeof data === 'string') {
      imgName = data;
    }

    if (!imgName || typeof imgName !== 'string' || imgName.trim() === '') return this.fallbackImage;
    if (imgName.startsWith('http')) return imgName;

    let fileName = imgName.trim();
    if (fileName.startsWith('/')) fileName = fileName.substring(1);

    if (!fileName.includes('images/products/')) {
      return `${this.serverUrl}/images/products/${fileName}`;
    }
    return `${this.serverUrl}/${fileName}`;
  }

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
    this.cdr.detectChanges(); // Vẽ lại UI để hiện dòng chat user

    // 2. Gọi API Backend để phân tích
    this.http.post<any>(this.apiUrl, { message: query }).subscribe({
      next: (res) => {
        // Đã sửa: Đợi 2 giây để "diễn" hiệu ứng đang trả lời
        setTimeout(() => {
          this.isTyping = false;
          
          /** XỬ LÝ XUỐNG DÒNG: Biến đổi \n thành <br> */
          const formattedAnswer = (res.answer || '').replace(/\n/g, '<br>');

          // 3. Hiển thị phản hồi từ Bot kèm theo bảng PHÂN TÍCH KỸ THUẬT
          this.testMessages.push({
            type: 'bot',
            text: formattedAnswer, 
            time: this.getCurrentTime(),
            products: res.products || [],
            analysis: {
              intent: res.intent || (res.score > 0 ? 'Tìm kiếm FAQ' : 'AI Suy luận'),
              score: res.score || 0,
              keywords: this.extractKeywords(query) // Lấy keywords từ câu hỏi
            }
          });
          
          this.cdr.detectChanges(); // Ép cập nhật giao diện
        }, 2000); 
      },
      error: (err) => {
        console.error('Lỗi kết nối hệ thống kiểm thử:', err);
        this.isTyping = false;
        this.testMessages.push({
          type: 'bot',
          text: '❌ Không thể kết nối với máy chủ Backend. Bạn vui lòng kiểm tra lại dịch vụ.',
          time: this.getCurrentTime()
        });
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Chuyển hướng đến trang chi tiết sản phẩm phía USER
   */
  goToProductDetail(productId: string) {
    if (!productId) return;
    const fullUrl = `${this.userAppUrl}/product-detail-page/${productId}`;
    window.open(fullUrl, '_blank');
  }

  /**
   * Làm mới toàn bộ nội dung trò chuyện
   */
  clearChat() {
    this.testMessages = [
      {
        type: 'bot',
        text: 'Dữ liệu hội thoại đã được làm mới. Bạn có thể bắt đầu quá trình kiểm tra từ đầu. ✨',
        time: this.getCurrentTime()
      }
    ];
    this.cdr.detectChanges();
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
    } catch (err) {}
  }

  /**
   * Trích xuất các từ khóa chính từ câu hỏi của người dùng để hỗ trợ phân tích
   */
  private extractKeywords(text: string): string {
    const stopWords = ['có', 'không', 'là', 'bao', 'nhiêu', 'giúp', 'cho', 'cái', 'làm', 'với', 'tư', 'vấn', 'tìm', 'giùm'];
    const filtered = text.toLowerCase()
                .split(' ')
                .filter(word => word.length > 2 && !stopWords.includes(word));
    
    // Trả về chuỗi keywords ngăn cách bởi dấu phẩy
    return filtered.length > 0 ? filtered.join(', ') : 'Không lọc được từ khóa';
  }
}