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

  // Trạng thái điều khiển Modal Xác nhận xóa
  isDeleteModalOpen = false;
  pendingDeleteId: string = '';

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
        // Chuẩn hóa định dạng thời gian cho câu hỏi và phản hồi của quản trị viên
        // Đồng thời ánh xạ thêm 2 trường đánh giá (Like/Dislike)
        this.questions = (res.questions || []).map((q: any) => ({
          ...q,
          time: q.createdAt ? new Date(q.createdAt).toLocaleString('vi-VN') : 'N/A',
          answerTime: q.answerAt ? new Date(q.answerAt).toLocaleString('vi-VN') : null,
          helpfulCount: q.helpfulCount || 0,
          unhelpfulCount: q.unhelpfulCount || 0
        }));
        
        this.stats = res.stats || { total: 0, pending: 0, answered: 0 };
        this.applyFilters(); // Cập nhật danh sách hiển thị
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

    // 1. Lọc dữ liệu theo từ khóa (Nội dung câu hỏi hoặc tên khách hàng)
    const term = this.searchText.toLowerCase().trim();
    if (term) {
      temp = temp.filter(q => 
        (q.content && q.content.toLowerCase().includes(term)) || 
        (q.user && q.user.toLowerCase().includes(term))
      );
    }

    // 2. Sắp xếp danh sách theo tiêu chí thời gian được chọn
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
   * Xác nhận và gửi nội dung phản hồi kèm thông tin người trả lời về hệ thống máy chủ
   */
  confirmReply(): void {
    if (!this.replyText.trim() || !this.activeQuestion) return;

    // Truyền this.currentAdminName để lấy linh động tên Admin
    this.api.replyConsultingQuestion(this.activeQuestion._id, this.replyText.trim(), this.currentAdminName).subscribe({
      next: (res: any) => {
        this.isModalOpen = false;
        this.isSuccessModalOpen = true;
        this.loadQuestions(); // Đồng bộ lại toàn bộ danh sách để cập nhật thông tin mới nhất
      },
      error: (err: any) => {
        console.error('Lỗi xử lý gửi phản hồi:', err);
        this.api.showToast('Gửi phản hồi thất bại. Vui lòng kiểm tra kết nối mạng.', 'error');
      }
    });
  }

  /**
   * Mở Modal xác nhận xóa và lưu giữ định danh câu hỏi cần xử lý
   */
  openDeleteModal(id: string): void {
    if (!id) return;
    this.pendingDeleteId = id;
    this.isDeleteModalOpen = true;
    this.cdr.detectChanges();
  }

  /**
   * Thực hiện lệnh xóa vĩnh viễn dữ liệu câu hỏi sau khi có xác nhận cuối cùng
   */
  confirmDelete(): void {
    if (!this.pendingDeleteId) {
      console.warn('Yêu cầu không hợp lệ: Không tìm thấy ID dữ liệu.');
      return;
    }

    this.api.deleteConsultingQuestion(this.pendingDeleteId).subscribe({
      next: (res: any) => {
        this.isDeleteModalOpen = false;
        this.pendingDeleteId = '';
        this.api.showToast('Đã xóa dữ liệu thành công.', 'success');
        this.loadQuestions(); // Cập nhật lại chỉ số thống kê và danh sách câu hỏi
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
    this.pendingDeleteId = '';
    this.cdr.detectChanges();
  }
}