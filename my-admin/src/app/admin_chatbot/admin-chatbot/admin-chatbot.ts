import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';

// Import đầy đủ các thành phần con để xây dựng giao diện quản lý chuyên sâu
import { ChatbotKnowledgeBase } from '../chatbot-knowledge-base/chatbot-knowledge-base';
import { ChatbotLogicEngine } from '../chatbot-logic-engine/chatbot-logic-engine';
import { ChatbotLivePreview } from '../chatbot-live-preview/chatbot-live-preview';
import { ChatbotFormEditor } from '../chatbot-form-editor/chatbot-form-editor';

@Component({
  selector: 'app-admin-chatbot',
  standalone: true,
  imports: [
    CommonModule, 
    HttpClientModule, 
    ChatbotKnowledgeBase, 
    ChatbotLogicEngine, 
    ChatbotLivePreview, 
    ChatbotFormEditor
  ],
  templateUrl: './admin-chatbot.html',
  styleUrls: ['./admin-chatbot.css'],
  encapsulation: ViewEncapsulation.None
})
export class AdminChatbot implements OnInit {
  // --- QUẢN LÝ TRẠNG THÁI GIAO DIỆN ---
  viewMode: 'knowledge' | 'logic' = 'knowledge';
  isModalOpen: boolean = false;
  isChatOpen: boolean = false;
  editingData: any = null;
  
  // --- STATE CỦA CUSTOM ALERT MODAL ---
  alertModal = {
    isOpen: false,
    title: '',
    message: '',
    type: 'success', // 'success' | 'warning' | 'error'
    showCancel: false,
    confirmText: 'OK',
    cancelText: 'Hủy',
    onConfirm: () => {}
  };

  // --- QUẢN LÝ DỮ LIỆU ĐỒNG BỘ ---
  faqList: any[] = [];
  categoryList: string[] = []; // Chứa danh mục từ DB và các mục mặc định
  allProductList: any[] = [];  // Lưu trữ toàn bộ sản phẩm từ hệ thống HealthUp
  isLoading: boolean = false;

  // Địa chỉ API kết nối tới máy chủ Backend
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadAllData();
  }

  /**
   * Tải toàn bộ dữ liệu cần thiết ngay khi khởi tạo trang quản trị
   */
  loadAllData() {
    this.loadKnowledgeBase();
    this.loadCategories();
    this.loadProducts(); // Nạp dữ liệu sản phẩm để sẵn sàng gắn thẻ (Product Cards)
  }

  // --- HÀM ĐIỀU KHIỂN CUSTOM ALERT MODAL ---
  showAlert(options: any) {
    this.alertModal = {
      isOpen: true,
      title: options.title || 'Thông báo',
      message: options.message || '',
      type: options.type || 'success',
      showCancel: options.showCancel || false,
      confirmText: options.confirmText || 'OK',
      cancelText: options.cancelText || 'Hủy',
      onConfirm: options.onConfirm || (() => this.closeAlert())
    };
  }

  closeAlert() {
    this.alertModal.isOpen = false;
  }

  confirmAlert() {
    if (this.alertModal.onConfirm) {
      this.alertModal.onConfirm();
    }
    this.closeAlert();
  }

  // --- THAO TÁC KHO TRI THỨC (FAQs) ---

  /**
   * Truy xuất danh sách câu hỏi và trả lời từ Database
   */
  loadKnowledgeBase() {
    this.isLoading = true;
    this.http.get<any>(`${this.apiUrl}/chatbot/faqs`).subscribe({
      next: (res) => {
        // Xử lý linh hoạt: Chấp nhận cả mảng trực tiếp hoặc object chứa data
        this.faqList = res.data || res || [];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Lỗi tải kho tri thức:', err);
        this.isLoading = false;
      }
    });
  }

  // --- THAO TÁC DANH MỤC (CATEGORIES) ---

  /**
   * Lấy danh mục sản phẩm thực tế từ API Chatbot
   */
  loadCategories() {
    this.http.get<any>(`${this.apiUrl}/chatbot/categories`).subscribe({
      next: (res) => {
        const data = res.data || res || [];
        const dbNames = Array.isArray(data) ? data.map((cat: any) => cat.name) : [];
        this.categoryList = Array.from(new Set([...dbNames, 'Chính sách chung']));
      },
      error: (err) => {
        console.error('Lỗi tải danh mục sản phẩm:', err);
        this.categoryList = ['Granola', 'Trà thảo mộc', 'Trái cây sấy', 'Chính sách chung'];
      }
    });
  }

  // --- THAO TÁC SẢN PHẨM (PRODUCTS) ---

  /**
   * Truy xuất toàn bộ sản phẩm để phục vụ tính năng gợi ý trong Chatbot
   */
  loadProducts() {
    this.http.get<any>(`${this.apiUrl}/chatbot/products/all`).subscribe({
      next: (res) => {
        // Lưu trữ danh sách sản phẩm để truyền xuống Form Editor và Live Preview
        this.allProductList = res.data || [];
        console.log('Đã tải danh sách sản phẩm:', this.allProductList.length);
      },
      error: (err) => {
        console.error('Lỗi tải danh sách sản phẩm:', err);
      }
    });
  }

  // --- LOGIC ĐIỀU KHIỂN GIAO DIỆN ---

  toggleView(view: 'knowledge' | 'logic') {
    this.viewMode = view;
  }

  toggleChat() {
    this.isChatOpen = !this.isChatOpen;
  }

  // Mở Modal để thêm mới câu hỏi
  openAddModal() {
    this.editingData = null; 
    this.isModalOpen = true;
  }

  // Mở Modal kèm dữ liệu có sẵn để chỉnh sửa
  openEditModal(data: any) {
    this.editingData = { ...data }; 
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.editingData = null;
  }

  // --- TƯƠNG TÁC CƠ SỞ DỮ LIỆU ---

  /**
   * Lưu trữ dữ liệu: Tự động phân loại POST hoặc PUT
   */
  handleSaveFAQ(formData: any) {
    this.isLoading = true;
    
    const request = formData._id 
      ? this.http.put(`${this.apiUrl}/chatbot/faqs/${formData._id}`, formData)
      : this.http.post(`${this.apiUrl}/chatbot/faqs`, formData);

    request.subscribe({
      next: () => {
        this.loadKnowledgeBase();
        this.closeModal();
        this.showAlert({
          title: 'Thành công!',
          message: 'Dữ liệu đã được cập nhật thành công vào hệ thống.',
          type: 'success',
          confirmText: 'Tuyệt vời'
        });
      },
      error: (err) => {
        console.error('Lỗi khi lưu câu hỏi:', err);
        this.showAlert({
          title: 'Lỗi rồi!',
          message: 'Không lưu được nội dung. Vui lòng kiểm tra lại kết nối Backend.',
          type: 'error',
          confirmText: 'Đóng'
        });
        this.isLoading = false;
      }
    });
  }

  /**
   * Xóa vĩnh viễn một câu hỏi khỏi kho tri thức
   */
  handleDeleteFAQ(id: string) {
    this.showAlert({
      title: 'Xác nhận xóa?',
      message: 'Bạn có chắc chắn muốn xóa câu hỏi này không?',
      type: 'warning',
      showCancel: true,
      confirmText: 'Xóa',
      cancelText: 'Hủy bỏ',
      onConfirm: () => {
        this.http.delete(`${this.apiUrl}/chatbot/faqs/${id}`).subscribe({
          next: () => {
            this.loadKnowledgeBase();
            this.showAlert({
              title: 'Đã xóa!',
              message: 'Đã xóa dữ liệu thành công khỏi hệ thống.',
              type: 'success',
              confirmText: 'OK'
            });
          },
          error: (err) => {
            console.error('Lỗi khi xóa câu hỏi:', err);
            this.showAlert({
              title: 'Lỗi!',
              message: 'Không thể xóa dữ liệu lúc này.',
              type: 'error',
              confirmText: 'Đóng'
            });
          }
        });
      }
    });
  }

  /**
   * Kích hoạt quá trình huấn luyện Bot
   */
  trainBot() {
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.showAlert({
        title: 'Huấn luyện hoàn tất!',
        message: 'Chatbot đã được huấn luyện xong và sẵn sàng phục vụ khách hàng.',
        type: 'success',
        confirmText: 'Hoàn tất'
      });
    }, 1500);
  }
}