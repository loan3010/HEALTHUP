import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chatbot-form-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot-form-editor.html',
  styleUrls: ['./chatbot-form-editor.css']
})
export class ChatbotFormEditor implements OnInit, OnChanges {
  // --- DỮ LIỆU ĐẦU VÀO TỪ HỆ THỐNG ---
  
  /** Thông tin câu hỏi cần chỉnh sửa (sẽ trống nếu là thêm mới) */
  @Input() data: any = null; 
  
  /** Danh sách các phân loại sản phẩm hiện có */
  @Input() categories: string[] = []; 

  /** Danh sách toàn bộ sản phẩm từ hệ thống HealthUp */
  @Input() allProducts: any[] = [];

  // --- TÍN HIỆU ĐẦU RA ---
  
  /** Yêu cầu đóng cửa sổ chỉnh sửa */
  @Output() close = new EventEmitter<void>(); 
  
  /** Gửi dữ liệu đã hoàn thiện về bộ phận quản trị để lưu trữ */
  @Output() save = new EventEmitter<any>();

  // --- QUẢN LÝ TRẠNG THÁI BIỂU MẪU ---
  
  /** Dữ liệu đang thao tác trên giao diện */
  editData: any = {
    question: '',
    answer: '',
    category: '',
    variations: [],
    relatedProducts: []
  };

  /** Nội dung tạm thời khi nhập thêm biến thể câu hỏi */
  newVariationInput: string = '';

  constructor() {}

  /** Khởi tạo dữ liệu ngay khi thành phần được nạp */
  ngOnInit(): void {
    this.initializeFormData();
  }

  /** Cập nhật lại dữ liệu mỗi khi thông tin từ cấp cha thay đổi */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data) {
      this.initializeFormData();
    }
  }

  /**
   * Truy xuất danh sách sản phẩm đã được lọc dựa trên danh mục của câu hỏi.
   * Giúp quản trị viên dễ dàng lựa chọn sản phẩm phù hợp.
   */
  get filteredProducts(): any[] {
    if (!this.editData.category || this.editData.category === 'Chính sách chung') {
      return [];
    }
    // Lọc sản phẩm dựa trên sự trùng khớp về tên danh mục
    return this.allProducts.filter(product => 
      product.category === this.editData.category || 
      (product.category && product.category.name === this.editData.category)
    );
  }

  /** Thiết lập dữ liệu cho biểu mẫu dựa trên thông tin đầu vào */
  private initializeFormData(): void {
    if (this.data) {
      // Tạo bản sao độc lập để tránh ảnh hưởng đến dữ liệu gốc trước khi xác nhận lưu
      this.editData = JSON.parse(JSON.stringify(this.data));
      
      // Đảm bảo các mảng dữ liệu luôn được khởi tạo đúng cách
      if (!this.editData.variations) this.editData.variations = [];
      if (!this.editData.relatedProducts) this.editData.relatedProducts = [];
    } else {
      this.resetForm();
    }
  }

  // --- QUẢN LÝ BIẾN THỂ CÂU HỎI ---

  /** Thêm một cách đặt câu hỏi mới vào danh sách huấn luyện */
  addVariation(): void {
    const value = this.newVariationInput.trim();
    if (value) {
      if (!this.editData.variations) this.editData.variations = [];
      
      // Chỉ thêm nếu nội dung này chưa tồn tại
      if (!this.editData.variations.includes(value)) {
        this.editData.variations.push(value);
        this.newVariationInput = ''; 
      }
    }
  }

  /** Loại bỏ một biến thể câu hỏi khỏi danh sách */
  removeVariation(index: number): void {
    if (this.editData.variations) {
      this.editData.variations.splice(index, 1);
    }
  }

  // --- QUẢN LÝ THẺ SẢN PHẨM ĐÍNH KÈM (CHẾ ĐỘ CHỌN NHIỀU) ---

  /**
   * Đảo ngược trạng thái lựa chọn của sản phẩm (Tick/Untick)
   * @param product Đối tượng sản phẩm được thao tác
   */
  toggleProduct(product: any): void {
    if (!this.editData.relatedProducts) {
      this.editData.relatedProducts = [];
    }

    const index = this.editData.relatedProducts.findIndex((p: any) => 
      (typeof p === 'string' ? p : p._id) === product._id
    );

    if (index > -1) {
      // Nếu đã tồn tại thì loại bỏ khỏi danh sách đính kèm
      this.editData.relatedProducts.splice(index, 1);
    } else {
      // Nếu chưa tồn tại thì thêm mới vào danh sách
      this.editData.relatedProducts.push(product);
    }
  }

  /**
   * Kiểm tra xem một sản phẩm cụ thể có đang được lựa chọn hay không
   * @param productId Mã định danh sản phẩm
   */
  isProductSelected(productId: string): boolean {
    if (!this.editData.relatedProducts) return false;
    return this.editData.relatedProducts.some((p: any) => 
      (typeof p === 'string' ? p : p._id) === productId
    );
  }

  // --- XỬ LÝ GỬI DỮ LIỆU ---

  /** Kiểm tra tính hợp lệ và gửi dữ liệu về hệ thống để lưu trữ */
  submitForm(): void {
    const isQuestionValid = this.editData.question && this.editData.question.trim().length > 0;
    const isAnswerValid = this.editData.answer && this.editData.answer.trim().length > 0;
    const isCategoryValid = this.editData.category && this.editData.category !== '';

    if (isQuestionValid && isAnswerValid && isCategoryValid) {
      
      /** * BƯỚC LÀM SẠCH DỮ LIỆU: 
       * Nếu là Chính sách chung, tuyệt đối không được đính kèm sản phẩm 
       */
      let finalProducts = this.editData.relatedProducts.map((p: any) => typeof p === 'string' ? p : p._id);
      
      if (this.editData.category === 'Chính sách chung') {
        finalProducts = []; // Ép rỗng để đảm bảo sạch sẽ dữ liệu
      }

      /**
       * Chuẩn hóa dữ liệu trước khi gửi:
       * Chuyển đổi danh sách sản phẩm từ dạng đối tượng sang dạng mảng mã định danh (IDs)
       */
      const outputData = {
        ...this.editData,
        relatedProducts: finalProducts
      };
      
      this.save.emit(outputData);
    } else {
      this.hienThiThongBaoLoi();
    }
  }

  /** Thông báo chi tiết các thông tin còn thiếu trong biểu mẫu */
  private hienThiThongBaoLoi(): void {
    let thongDiep = 'Vui lòng hoàn thiện các nội dung sau trước khi thực hiện lưu trữ:\n';
    if (!this.editData.category) thongDiep += '- Phân loại danh mục sản phẩm.\n';
    if (!this.editData.question) thongDiep += '- Nội dung câu hỏi chính.\n';
    if (!this.editData.answer) thongDiep += '- Nội dung phản hồi của Trợ lý ảo.\n';
    
    alert(thongDiep);
  }

  /** Thiết lập lại toàn bộ biểu mẫu về trạng thái rỗng */
  private resetForm(): void {
    this.editData = {
      question: '',
      answer: '',
      category: '',
      variations: [],
      relatedProducts: []
    };
  }
}