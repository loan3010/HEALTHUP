import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectorRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-consulting-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './consulting-detail.html',
  styleUrls: ['./consulting-detail.css']
})
export class ConsultingDetail implements OnInit {
  @Input() product: any; // Thông tin sản phẩm nhận từ trang quản lý danh sách
  @Output() goBack = new EventEmitter<void>();

  // Quản lý dữ liệu câu hỏi
  questions: any[] = []; 
  filteredQuestions: any[] = []; 
  isLoading: boolean = true;
  
  // Điều kiện lọc và tìm kiếm
  searchText: string = '';
  sortBy: 'newest' | 'oldest' = 'newest';
  showSortDropdown: boolean = false;

  // Trạng thái điều khiển Modal Phản hồi
  isModalOpen = false;
  isSuccessModalOpen = false;
  activeQuestion: any = null;
  replyText: string = '';

  // --- LOGIC XÓA KÈM LÝ DO ---
  isDeleteModalOpen = false;
  pendingDeleteQuestion: any = null; // Lưu nguyên object để lấy userId và nội dung
  selectedDeleteReason: string = ''; // Lý do Admin chọn
  
  // Danh sách các nhãn lý do xóa có sẵn
  readonly deleteReasons = [
    'Ngôn từ thô tục / Không phù hợp',
    'Nội dung Spam / Quảng cáo',
    'Hỏi không liên quan đến sản phẩm',
    'Vi phạm chính sách bảo mật (SĐT, địa chỉ...)',
    'Câu hỏi trùng lặp / Đã có câu trả lời',
    'Nội dung sai lệch về y khoa'
  ];

  // Thống kê chỉ số tư vấn cho sản phẩm
  stats = {
    total: 0,
    pending: 0,
    answered: 0
  };

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  // --- LẤY TÊN ADMIN (CHUẨN 100% THEO FILE ADMIN-LOGIN) ---
  get currentAdminName(): string {
    try {
      const adminData = localStorage.getItem('admin_info');
      if (adminData) {
        const adminObj = JSON.parse(adminData);
        if (adminObj && adminObj.name) {
          return `${adminObj.name} (Admin)`;
        }
      }
    } catch (e) {
      console.error('Lỗi lấy tên admin:', e);
    }
    return 'Hệ thống (Admin)';
  }

  ngOnInit(): void {
    if (this.product && this.product._id) {
      this.loadQuestions();
    }
  }

  /**
   * Khi admin mở sản phẩm khác từ chuông thông báo (cùng tab chi tiết) — tải lại câu hỏi.
   */
  ngOnChanges(changes: SimpleChanges): void {
    const p = changes['product'];
    if (!p || p.isFirstChange()) return;
    const prevId = p.previousValue?._id != null ? String(p.previousValue._id) : '';
    const curId = p.currentValue?._id != null ? String(p.currentValue._id) : '';
    if (curId && curId !== prevId) {
      this.searchText = '';
      this.loadQuestions();
    }
  }

  /**
   * Xử lý đóng các menu lựa chọn khi người dùng nhấn ngoài vùng tương tác
   */
  @HostListener('document:click', ['$event'])
  clickout(event: any) {
    if (!event.target.closest('.custom-dropdown-container')) {
      this.showSortDropdown = false;
    }
  }

  /**
   * Tải danh sách câu hỏi và cập nhật trạng thái thống kê từ máy chủ
   */
  loadQuestions(): void {
    this.isLoading = true;
    this.api.getConsultingQuestions(this.product._id, { filter: 'all' }).subscribe({
      next: (res: any) => {
        this.questions = (res.questions || []).map((q: any) => ({
          ...q,
          time: q.createdAt ? new Date(q.createdAt).toLocaleString('vi-VN') : 'N/A',
          answerTime: q.answerAt ? new Date(q.answerAt).toLocaleString('vi-VN') : null,
          helpfulCount: q.helpfulCount || 0,
          unhelpfulCount: q.unhelpfulCount || 0
        }));
        
        this.stats = res.stats || { total: 0, pending: 0, answered: 0 };
        this.applyFilters(); 
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Lỗi truy xuất dữ liệu câu hỏi:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Áp dụng tìm kiếm theo từ khóa và sắp xếp danh sách theo thời gian
   */
  applyFilters(): void {
    let temp = [...this.questions];

    const term = this.searchText.toLowerCase().trim();
    if (term) {
      temp = temp.filter(q => 
        (q.content && q.content.toLowerCase().includes(term)) || 
        (q.user && q.user.toLowerCase().includes(term))
      );
    }

    temp.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return this.sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

    this.filteredQuestions = temp;
    this.cdr.detectChanges();
  }

  /**
   * Cập nhật tiêu chí sắp xếp và làm mới danh sách hiển thị
   */
  selectSort(mode: 'newest' | 'oldest'): void {
    this.sortBy = mode;
    this.showSortDropdown = false;
    this.applyFilters();
  }

  /**
   * Khởi tạo giao diện soạn thảo nội dung phản hồi
   */
  openModal(question: any): void {
    this.activeQuestion = question;
    this.replyText = question.answer || ''; 
    this.isModalOpen = true;
    this.cdr.detectChanges();
  }

  /**
   * Xác nhận và gửi nội dung phản hồi
   */
  confirmReply(): void {
    if (!this.replyText.trim() || !this.activeQuestion) return;

    this.api.replyConsultingQuestion(this.activeQuestion._id, this.replyText.trim(), this.currentAdminName).subscribe({
      next: (res: any) => {
        this.isModalOpen = false;
        this.isSuccessModalOpen = true;
        this.loadQuestions(); 
      },
      error: (err: any) => {
        console.error('Lỗi xử lý gửi phản hồi:', err);
        this.api.showToast('Gửi phản hồi thất bại. Vui lòng kiểm tra kết nối mạng.', 'error');
      }
    });
  }

  /**
   * Mở Modal xác nhận xóa kèm chọn lý do
   */
  openDeleteModal(question: any): void {
    if (!question) return;
    this.pendingDeleteQuestion = question;
    this.selectedDeleteReason = this.deleteReasons[0]; // Mặc định chọn lý do đầu tiên
    this.isDeleteModalOpen = true;
    this.cdr.detectChanges();
  }

  /**
   * Thực hiện lệnh xóa vĩnh viễn và gửi thông báo lý do cho khách hàng
   */
  confirmDelete(): void {
    if (!this.pendingDeleteQuestion) return;

    // CẬP NHẬT: Thêm productId vào payload để gửi sang API
    const payload = {
      questionId: this.pendingDeleteQuestion._id,
      userId: this.pendingDeleteQuestion.userId, 
      productName: this.product.name || 'Sản phẩm',
      reason: this.selectedDeleteReason,
      productId: this.product._id // <--- TRƯỜNG QUAN TRỌNG NHẤT ĐỂ CHUYỂN TRANG
    };

    this.api.deleteConsultingQuestion(payload).subscribe({
      next: (res: any) => {
        this.isDeleteModalOpen = false;
        this.pendingDeleteQuestion = null;
        this.api.showToast('Đã xóa câu hỏi và gửi thông báo cho khách!', 'success');
        this.loadQuestions(); 
      },
      error: (err: any) => {
        console.error('Lỗi khi thực hiện xóa dữ liệu:', err);
        this.api.showToast('Thao tác xóa thất bại. Vui lòng thử lại sau.', 'error');
      }
    });
  }

  /**
   * Đóng tất cả các Modal và thiết lập lại các trạng thái điều khiển tạm thời
   */
  closeAllModals(): void {
    this.isSuccessModalOpen = false;
    this.isModalOpen = false;
    this.isDeleteModalOpen = false;
    this.activeQuestion = null;
    this.replyText = '';
    this.pendingDeleteQuestion = null;
    this.selectedDeleteReason = '';
    this.cdr.detectChanges();
  }
}