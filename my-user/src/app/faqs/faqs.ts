import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatbotToggleService } from '../services/chatbot-toggle.service';
import { STORE_ZALO_PHONE, buildZaloMeUrl } from '../constants/store-contact.constants';

@Component({
  selector: 'app-faqs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './faqs.html',
  styleUrls: ['./faqs.css']
})
export class Faqs {
  activeTab = 'brand'; // Mặc định mở tab Thương hiệu
  searchTerm = '';
  
  // ✅ Cấu hình phân trang cố định 3 câu hỏi mỗi lượt
  currentPage = 0;
  readonly pageSize = 4;

  categories = [
    {
      id: 'brand',
      name: 'Thương hiệu',
      icon: 'bi-patch-check',
      items: [
        { 
          q: 'HealthUp có ý nghĩa gì?', 
          a: 'HealthUp là sự kết hợp giữa Health (Sức khỏe) và Up (Nâng cao). Chúng tôi mong muốn đồng hành cùng bạn nâng tầm chất lượng sống thông qua từng lựa chọn ăn uống thông minh và lành mạnh hơn mỗi ngày.', 
          open: false 
        },
        { 
          q: 'Giá trị cốt lõi của HealthUp là gì?', 
          a: 'Chúng tôi hoạt động dựa trên 4 giá trị cốt lõi: Lành mạnh (ưu tiên tự nhiên), Minh bạch (nguồn gốc rõ ràng), Tiện lợi (mua sắm nhanh chóng) và Tin cậy (đặt trải nghiệm của bạn lên hàng đầu).', 
          open: false 
        },
        { 
          q: 'Sản phẩm HealthUp có chứng nhận an toàn thực phẩm không?', 
          a: 'Tất cả sản phẩm tại HealthUp đều có giấy chứng nhận ATTP theo quy định của cơ quan chức năng. Các sản phẩm nhập khẩu đều có giấy phép và công bố chất lượng hợp lệ. Bạn có thể yêu cầu xem chứng nhận qua email healthup@gmail.com.', 
          open: false 
        },
        { 
          q: 'Làm sao để liên hệ trực tiếp với HealthUp?', 
          a: 'Bạn có thể gọi đến Hotline 0335 512 275 hoặc gửi email về địa chỉ healthup@gmail.com. Đội ngũ hỗ trợ của chúng tôi luôn sẵn sàng lắng nghe và giải đáp mọi thắc mắc của bạn.', 
          open: false 
        },
        { 
          q: 'Tại sao nên tin tưởng lựa chọn sản phẩm của chúng tôi?', 
          a: 'Chúng tôi không chỉ cung cấp thực phẩm, mà mang đến giải pháp dinh dưỡng minh bạch về thành phần, không chất bảo quản và cam kết đồng hành cùng sức khỏe của bạn.', 
          open: false 
        }
      ]
    },
    {
      id: 'products',
      name: 'Dinh dưỡng & Sản phẩm',
      icon: 'bi-egg-fried',
      items: [
        { q: '[Granola] Granola HealthUp khác gì so với thị trường?', a: 'Dòng Granola của chúng tôi có tỷ lệ hạt cao (trên 60%), sử dụng yến mạch nguyên cám và vị ngọt thanh nhẹ từ mật ong hoa cà phê, hoàn toàn không dùng đường tinh luyện.', open: false },
        { q: 'Sản phẩm có phù hợp với người ăn chay không?', a: 'Nhiều sản phẩm của chúng tôi phù hợp với người ăn chay. Bạn có thể kiểm tra chi tiết thành phần trong mô tả sản phẩm hoặc sử dụng bộ lọc "Ăn chay" trên website để lựa chọn.', open: false },
        { q: 'Hạn sử dụng sản phẩm được tính như thế nào?', a: 'HSD được in trên bao bì. Chúng tôi cam kết giao hàng với HSD còn ít nhất 50%. Nếu nhận hàng thấy HSD dưới mức này, bạn vui lòng chụp ảnh và phản hồi để được hỗ trợ đổi trả.', open: false },
        { q: 'Cách bảo quản sản phẩm sau khi mở gói?', a: 'Trái cây sấy/Đồ ăn vặt: Buộc kín túi, để nơi khô thoáng, dùng trong 7-14 ngày. Ngũ cốc/Granola: Cho vào hũ thủy tinh kín, tránh ẩm, dùng trong 2-4 tuần.', open: false },
        { q: '[Trà thảo mộc] Phụ nữ mang thai có sử dụng được trà không?', a: 'Các dòng trà như Hoa cúc, Đậu đen rất lành tính. Tuy nhiên, để đảm bảo an toàn tuyệt đối, bạn nên tham khảo ý kiến bác sĩ trước khi dùng.', open: false },
        { q: '[Trái cây sấy] Công nghệ sấy nào được áp dụng?', a: 'Chúng tôi sử dụng công nghệ sấy lạnh hiện đại giúp giữ lại đến 95% vitamin, màu sắc và hương vị tự nhiên của trái cây tươi mà không cần đường hóa học.', open: false }
      ]
    },
    {
      id: 'order',
      name: 'Đơn hàng & Giao nhận',
      icon: 'bi-truck',
      items: [
        { 
          q: 'Tôi có thể theo dõi đơn hàng ở đâu?', 
          a: 'Để theo dõi đơn hàng: Nếu bạn mua hàng có đăng nhập, vui lòng vào mục "Theo dõi đơn hàng" trong tài khoản. Nếu bạn mua hàng không đăng nhập (khách vãng lai), vui lòng sử dụng mã đơn hàng để xem tại mục "Tra cứu đơn hàng".', 
          open: false 
        },
        { 
          q: 'HealthUp có giao hàng toàn quốc không?', 
          a: 'Có, chúng tôi giao hàng đến 63 tỉnh thành thông qua các đối tác vận chuyển uy tín như GHN và GHTK để đảm bảo hàng hóa đến tay bạn nhanh nhất.', 
          open: false 
        },
        { 
          q: 'Tôi có thể hủy đơn hàng không?', 
          a: 'Bạn có thể hủy khi đơn ở trạng thái "Chờ xác nhận". Sau khi đơn đã chuyển sang "Chờ giao hàng", vui lòng liên hệ hotline 0335 512 275 để được hỗ trợ kịp thời.', 
          open: false 
        },
        { 
          q: 'Thay đổi địa chỉ giao hàng sau khi đặt được không?', 
          a: 'Bạn chỉ có thể thay đổi địa chỉ khi đơn chưa được bàn giao cho shipper. Hãy liên hệ ngay Hotline kèm mã đơn hàng để nhân viên hỗ trợ xử lý.', 
          open: false 
        },
  
      ]
    },
    {
      id: 'payment',
      name: 'Thanh toán & Khuyến mãi',
      icon: 'bi-credit-card',
      items: [
        { 
          q: 'HealthUp hỗ trợ những hình thức thanh toán nào?', 
          a: 'Chúng tôi cung cấp các phương thức thanh toán linh hoạt bao gồm: Thanh toán khi nhận hàng (COD), Ví điện tử MoMo và thanh toán qua cổng VNPAY.', 
          open: false 
        },
        { 
          q: 'Làm sao để được miễn phí vận chuyển (Freeship)?', 
          a: 'Chúng tôi thường xuyên phát hành nhiều mã khuyến mãi phí vận chuyển khác nhau. Bạn có thể kiểm tra và áp dụng các mã này tại bước thanh toán để nhận ưu đãi tốt nhất.', 
          open: false 
        },
        { 
          q: 'Tôi là người mới, có ưu đãi gì đặc biệt không?', 
          a: 'Tại phần "Áp dụng mã khuyến mãi" khi Checkout, các mã ưu đãi dành riêng cho người mới sẽ tự động hiển thị. Hệ thống sẽ đề xuất lựa chọn tốt nhất, bạn chỉ cần chọn mã phù hợp để áp dụng cho đơn hàng đầu tiên.', 
          open: false 
        },
        { 
          q: 'Tôi được hoàn tiền như thế nào khi đổi trả?', 
          a: 'Tiền sẽ được hoàn về tài khoản gốc (Ngân hàng/MoMo/VNPAY) trong 3-7 ngày làm việc tùy thuộc vào quy trình của ngân hàng sau khi yêu cầu đổi trả được xác nhận.', 
          open: false 
        }
      ]
    }
  ];


  constructor(private chatService: ChatbotToggleService) {}

  /**
   * Lấy toàn bộ danh sách câu hỏi đã lọc (theo tab hoặc tìm kiếm)
   */
  get allFilteredItems() {
    if (!this.searchTerm.trim()) {
      const category = this.categories.find(c => c.id === this.activeTab);
      return category ? category.items : [];
    }
    const term = this.searchTerm.toLowerCase();
    return this.categories
      .flatMap(cat => cat.items)
      .filter(item => item.q.toLowerCase().includes(term) || item.a.toLowerCase().includes(term));
  }

  /**
   * ✅ Hiển thị danh sách câu hỏi theo trang (Cố định 3 câu/lượt)
   */
  get visibleFAQs() {
    const start = this.currentPage * this.pageSize;
    return this.allFilteredItems.slice(start, start + this.pageSize);
  }

  /**
   * Tính tổng số trang dựa trên danh sách đã lọc
   */
  get totalPages() {
    return Math.ceil(this.allFilteredItems.length / this.pageSize);
  }

  /**
   * Chuyển đổi giữa các danh mục câu hỏi
   */
  setTab(id: string) {
    this.activeTab = id;
    this.searchTerm = '';
    this.currentPage = 0; // Reset về trang đầu
    this.closeAllAccordions();
  }

  /**
   * Xử lý khi người dùng nhập liệu vào ô tìm kiếm
   */
  onSearchChange() {
    this.currentPage = 0; // Reset về trang đầu khi tìm kiếm
    this.closeAllAccordions();
  }

  /**
   * Đóng/Mở câu trả lời
   */
  toggleItem(item: any) {
    item.open = !item.open;
  }

  /**
   * Điều hướng trang tiếp theo
   */
  nextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.closeAllAccordions();
    }
  }

  /**
   * Điều hướng trang trước đó
   */
  prevPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.closeAllAccordions();
    }
  }

  /**
   * Đảm bảo các nội dung sổ xuống được đóng lại khi chuyển trang/tab
   */
  private closeAllAccordions() {
    this.categories.forEach(cat => {
      cat.items.forEach(item => item.open = false);
    });
  }

  /**
   * Mở khung Chatbot hỗ trợ thông qua Service
   */
  openBot() {
    this.chatService.openChat();
  }

  /**
   * Lấy đường dẫn liên kết đến Zalo chat
   */
  getZaloUrl() {
    return buildZaloMeUrl(STORE_ZALO_PHONE);
  }
}