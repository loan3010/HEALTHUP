import { Component, Input, Output, EventEmitter, OnInit, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-blog-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './blog-form.html',
  styleUrls: ['./blog-form.css']
})
export class BlogForm implements OnInit, AfterViewInit {
  @Input() mode: 'add' | 'edit' = 'add';
  @Input() postData: any = null;
  @Output() goBack = new EventEmitter<void>();

  @ViewChild('editor') editor!: ElementRef;

  formData: any = {
    title: '',
    author: '',
    tag: '',
    excerpt: '',
    content: '',
    updatedAt: '' // Biến hiển thị ngày trên giao diện
  };

  selectedFile: File | null = null;
  imagePreview: string | null = null;
  
  currentColor: string = '#000000';
  currentBgColor: string = '#ffffff';
  
  presetColors: string[] = [
    '#000000', '#444444', '#666666', '#999999', '#cccccc', '#ffffff',
    '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#9900ff', '#ff00ff',
    '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#34495e'
  ];

  customRecentColors: string[] = []; 

  // --- LOGIC CHỔI QUÉT ĐỊNH DẠNG ---
  isFormatPainterActive: boolean = false;
  storedFormat: any = {
    foreColor: '#000000',
    hiliteColor: 'transparent',
    fontSize: '3',
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false
  };

  // --- QUẢN LÝ ẢNH & CỬA SỔ TÙY CHỈNH ---
  selectedImage: HTMLImageElement | null = null;
  showResizeModal: boolean = false;
  tempImageWidth: string = '';

  // --- QUẢN LÝ CỬA SỔ THÔNG BÁO ---
  showNotifyModal: boolean = false;
  notifyConfig: any = {
    type: 'success', // success, error, confirm, warning
    title: '',
    message: '',
    btnText: 'Đóng',
    action: null
  };

  private apiUrl = 'http://localhost:3000/api/blogs';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    if (this.mode === 'edit' && this.postData) {
      // 1. Gán dữ liệu hiện có
      this.formData = { ...this.postData };
      
      // 2. HIỂN THỊ ĐÚNG NGÀY TRONG DỮ LIỆU
      if (this.postData.date) {
        this.formData.updatedAt = this.postData.date;
      } else if (this.postData.createdAt) {
        const dateRaw = this.postData.createdAt.$date || this.postData.createdAt;
        this.formData.updatedAt = new Date(dateRaw).toLocaleDateString('vi-VN');
      }

      // 3. ĐẢM BẢO HIỆN ĐÚNG DANH MỤC (TAG)
      this.formData.tag = this.postData.tag || '';

      // 4. XỬ LÝ ẢNH BÌA
      if (this.formData.coverImage) {
        const path = this.formData.coverImage.startsWith('/') 
          ? this.formData.coverImage 
          : '/' + this.formData.coverImage;
        this.imagePreview = `http://localhost:3000${path}`;
      }
    } else {
      // --- CHẾ ĐỘ THÊM MỚI ---
      const info = localStorage.getItem('admin_info');
      let adminDisplayName = 'Quản trị viên'; 

      if (info) {
        try {
          const admin = JSON.parse(info);
          const fullName = admin.name || '';
          if (fullName.trim()) {
            const nameParts = fullName.trim().split(' ');
            adminDisplayName = nameParts.length >= 2 ? nameParts.slice(-2).join(' ') : fullName;
          }
        } catch (e) {
          console.error('Không thể truy xuất thông tin quản trị viên.');
        }
      }

      this.formData.author = `${adminDisplayName} (Admin)`; 
      this.formData.tag = ''; 
      this.formData.excerpt = '';
      this.formData.updatedAt = new Date().toLocaleDateString('vi-VN');
    }
  }

  ngAfterViewInit(): void {
    if (this.editor && this.formData.content) {
      this.editor.nativeElement.innerHTML = this.formData.content;
    }
  }

  @HostListener('document:selectionchange')
  onSelectionChange() {
    this.syncToolbar();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (this.selectedImage && (event.key === 'Backspace' || event.key === 'Delete')) {
      event.preventDefault(); 
      this.selectedImage.remove();
      this.selectedImage = null;
      this.updateContentFromEditor();
    }
  }

  showNotify(type: 'success'|'error'|'confirm'|'warning', title: string, message: string, btnText: string = 'Xác nhận', action: any = null) {
    this.notifyConfig = { type, title, message, btnText, action };
    this.showNotifyModal = true;
  }

  closeNotify() {
    this.showNotifyModal = false;
  }

  handleNotifyAction() {
    if (this.notifyConfig.action) {
      this.notifyConfig.action();
    }
    this.closeNotify();
  }

  syncToolbar() {
    if (!this.editor) return;
    try {
      this.currentColor = this.rgbToHex(document.queryCommandValue('foreColor')) || '#000000';
      let bg = document.queryCommandValue('hiliteColor') || document.queryCommandValue('backColor');
      this.currentBgColor = this.rgbToHex(bg) || '#ffffff';
    } catch (e) {}
  }

  private rgbToHex(rgb: any): string {
    if (!rgb || typeof rgb !== 'string') return '';
    if (!rgb.startsWith('rgb')) return rgb;
    const match = rgb.match(/\d+/g);
    if (!match) return '';
    const [r, g, b] = match.map(Number);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  formatDoc(command: string, value: any = ''): void {
    const editorEl = this.editor.nativeElement;
    editorEl.focus(); 
    document.execCommand('styleWithCSS', false, command === 'fontSize' ? "false" : "true");
    document.execCommand(command, false, value);
    this.updateContentFromEditor();
    this.syncToolbar();
  }

  /**
   * Xử lý khi chọn màu từ Color Picker (Hộp màu đầy đủ)
   */
  onCustomColorPick(command: string, event: any): void {
    const color = event.target.value;
    
    // 1. Áp dụng định dạng cho nội dung
    this.formatDoc(command, color);

    // 2. Lưu màu vào danh sách "Màu tự chọn" để tái sử dụng
    const normalizedColor = color.toLowerCase();
    const isPreset = this.presetColors.some(p => p.toLowerCase() === normalizedColor);
    const isAlreadyInRecent = this.customRecentColors.some(r => r.toLowerCase() === normalizedColor);

    if (!isPreset && !isAlreadyInRecent) {
      // Đưa màu mới lên đầu danh sách
      this.customRecentColors.unshift(color);
      
      // Giới hạn tối đa 10 màu tự chọn cho giao diện gọn gàng
      if (this.customRecentColors.length > 10) {
        this.customRecentColors.pop();
      }
    }
  }

  toggleFormatPainter(): void {
    if (!this.isFormatPainterActive) {
      this.syncToolbar();
      this.storedFormat = {
        foreColor: this.currentColor,
        hiliteColor: this.currentBgColor,
        fontSize: document.queryCommandValue('fontSize'),
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough')
      };
      this.isFormatPainterActive = true;
    } else {
      this.isFormatPainterActive = false;
    }
  }

  handleEditorMouseUp(): void {
    if (this.isFormatPainterActive) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && selection.toString().length > 0) {
        const selectedText = selection.toString();
        const sizeMap: any = { '1': '10px', '2': '13px', '3': '16px', '4': '18px', '5': '24px', '6': '32px', '7': '48px' };
        const fSize = sizeMap[this.storedFormat.fontSize] || '16px';
        const styledHTML = `<span style="color: ${this.storedFormat.foreColor}; background-color: ${this.storedFormat.hiliteColor}; font-size: ${fSize}; font-weight: ${this.storedFormat.bold ? 'bold' : 'normal'}; font-style: ${this.storedFormat.italic ? 'italic' : 'normal'}; text-decoration: ${((this.storedFormat.underline ? 'underline ' : '') + (this.storedFormat.strikeThrough ? 'line-through' : '')).trim()};">${selectedText}</span>`;
        document.execCommand('insertHTML', false, styledHTML);
        this.updateContentFromEditor();
      }
    }
  }

  handleEditorClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    this.editor.nativeElement.querySelectorAll('img').forEach((img: any) => img.classList.remove('img-selected'));
    if (target.tagName === 'IMG') {
      this.selectedImage = target as HTMLImageElement;
      this.selectedImage.classList.add('img-selected');
      window.getSelection()?.removeAllRanges();
    } else {
      this.selectedImage = null;
    }
  }

  setImageAlignment(align: 'left' | 'center' | 'right'): void {
    if (!this.selectedImage) return;
    const img = this.selectedImage;
    img.style.display = 'block';
    img.style.margin = '20px 0';
    if (align === 'left') { img.style.marginLeft = '0'; img.style.marginRight = 'auto'; }
    else if (align === 'center') { img.style.margin = '20px auto'; }
    else if (align === 'right') { img.style.marginLeft = 'auto'; img.style.marginRight = '0'; }
    this.updateContentFromEditor();
  }

  openResizeModal(): void {
    if (!this.selectedImage) return;
    this.tempImageWidth = this.selectedImage.style.width || '100%';
    this.showResizeModal = true;
  }

  applyImageResize(): void {
    if (this.selectedImage && this.tempImageWidth) {
      this.selectedImage.style.width = this.tempImageWidth;
      this.selectedImage.style.height = 'auto'; 
      this.updateContentFromEditor();
    }
    this.showResizeModal = false;
  }

  insertLocalImage(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const uploadData = new FormData();
      uploadData.append('inlineImage', file);
      this.http.post<any>(`${this.apiUrl}/upload-inline`, uploadData).subscribe({
        next: (res) => {
          const imgHtml = `<img src="${res.url}" class="blog-content-img" style="width: 100%; height: auto; cursor: pointer; display: block; margin: 20px auto;">`;
          document.execCommand('insertHTML', false, imgHtml);
          this.updateContentFromEditor();
          event.target.value = ''; 
        },
        error: () => this.showNotify('error', 'Lỗi hệ thống', 'Không thể tải hình ảnh lên máy chủ vào lúc này.')
      });
    }
  }

  insertLink(): void {
    const url = prompt('Nhập địa chỉ liên kết (URL):', 'https://');
    if (url) this.formatDoc('createLink', url);
  }

  onContentChange(): void {
    this.updateContentFromEditor();
  }

  private updateContentFromEditor(): void {
    if (this.editor) {
      this.formData.content = this.editor.nativeElement.innerHTML;
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = () => this.imagePreview = reader.result as string;
      reader.readAsDataURL(file);
    }
  }

  onSave(event?: Event): void {
    // 1. Chặn đứng hành vi gây nhảy cuộn trang
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // 2. Ép trình duyệt thoát tiêu điểm khỏi Editor ngay lập tức
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    this.updateContentFromEditor();
    
    if (!this.formData.title || !this.formData.title.trim()) {
      this.showNotify('warning', 'Thiếu thông tin', 'Vui lòng nhập tiêu đề bài viết trước khi thực hiện lưu.');
      return;
    }

    if (!this.formData.tag) {
      this.showNotify('warning', 'Thiếu thông tin', 'Vui lòng chọn danh mục phù hợp cho bài viết.');
      return;
    }

    if (!this.formData.excerpt || !this.formData.excerpt.trim()) {
      this.showNotify('warning', 'Thiếu thông tin', 'Vui lòng nhập mô tả ngắn gọn cho bài viết.');
      return;
    }

    const uploadData = new FormData();
    uploadData.append('title', this.formData.title);
    uploadData.append('author', this.formData.author);
    uploadData.append('tag', this.formData.tag);
    uploadData.append('excerpt', this.formData.excerpt);
    uploadData.append('content', this.formData.content);

    const nowStr = new Date().toLocaleDateString('vi-VN');
    uploadData.append('date', nowStr);

    if (this.selectedFile) {
      uploadData.append('coverImage', this.selectedFile);
    }

    const action = this.mode === 'add' 
      ? this.http.post(this.apiUrl, uploadData)
      : this.http.put(`${this.apiUrl}/${this.formData._id}`, uploadData);

    action.subscribe({
      next: () => {
        const msg = this.mode === 'add' ? 'Bài viết đã được đăng tải thành công.' : 'Thông tin bài viết đã được cập nhật thành công.';
        this.showNotify('success', 'Thành công', msg, 'Đóng', () => {
          this.goBack.emit();
        });
      },
      error: (err) => {
        console.error('Lỗi API:', err);
        this.showNotify('error', 'Lỗi hệ thống', 'Đã xảy ra lỗi trong quá trình lưu dữ liệu. Vui lòng thử lại sau.');
      }
    });
  }

  onDelete(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.showNotify(
      'confirm', 
      'Xác nhận xóa bài viết', 
      'Hành động này sẽ xóa vĩnh viễn bài viết và không thể khôi phục. Bạn có chắc chắn muốn thực hiện?', 
      'Xác nhận xóa', 
      () => {
        this.http.delete(`${this.apiUrl}/${this.formData._id}`).subscribe({
          next: () => {
            this.showNotify('success', 'Thành công', 'Bài viết đã được xóa thành công khỏi hệ thống.', 'Đóng', () => {
              this.goBack.emit();
            });
          },
          error: (err) => {
            console.error(err);
            this.showNotify('error', 'Lỗi hệ thống', 'Không thể thực hiện yêu cầu xóa vào lúc này.');
          }
        });
      }
    );
  }

  onCancel(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.goBack.emit();
  }
}