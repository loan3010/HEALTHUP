import { Component, OnInit, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'; // Import thêm Sanitizer
import { Blog } from '../blog/blog.model';
import { BlogService } from '../blog/blog.service';

@Component({
  selector: 'app-blog-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './blog-detail.html',
  styleUrls: ['./blog-detail.css'],
  // Cho phép CSS trong blog-detail.css tác động trực tiếp vào [innerHTML]
  encapsulation: ViewEncapsulation.None 
})
export class BlogDetailComponent implements OnInit {

  blog: Blog | null = null;
  relatedBlogs: Blog[] = [];
  isLoading = true;
  notFound = false;
  safeContent: SafeHtml = ''; // Biến chứa nội dung HTML an toàn đã được xử lý

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private blogService: BlogService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer // Inject Sanitizer để xử lý bảo mật Angular
  ) {}

  ngOnInit(): void {
    // Lắng nghe sự thay đổi của ID trên URL để tải lại bài khi nhấn vào "Bài viết liên quan"
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.resetState();
        this.loadBlog(id);
      }
    });
  }

  // Làm sạch trạng thái trước khi tải bài mới
  private resetState(): void {
    this.isLoading = true;
    this.notFound = false;
    this.blog = null;
    this.relatedBlogs = [];
    this.safeContent = '';
  }

  /**
   * Xử lý định dạng nội dung bài viết
   */
  formatContent(content: string): string {
    if (!content) return '';
    
    // Kiểm tra xem nội dung có chứa các thẻ HTML không
    const hasHtml = /<[a-z][\s\S]*>/i.test(content);
    if (hasHtml) return content;

    // Nếu là văn bản thuần (plain text), tự động chia đoạn và bọc thẻ <p>
    return content
      .split(/\n{2,}/)
      .map(para => para.trim())
      .filter(para => para.length > 0)
      .map(para => `<p style="margin-bottom: 1.2rem;">${para.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  // Tải chi tiết bài viết từ Backend
  loadBlog(id: string): void {
    this.blogService.getBlogById(id).subscribe({
      next: (data) => {
        // Bước 1: Format nội dung (xử lý plain text nếu có)
        const rawContent = this.formatContent(data.content);
        
        // Bước 2: Dùng Sanitizer để Angular không xóa thuộc tính style="width: ..."
        this.safeContent = this.sanitizer.bypassSecurityTrustHtml(rawContent);
        
        this.blog = data;
        this.isLoading = false;
        
        // Tải các bài viết liên quan dựa trên tag
        this.loadRelated(data.tag, id);
        
        // Cuộn lên đầu trang mượt mà
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi khi tải bài viết:', err);
        this.isLoading = false;
        this.notFound = true;
        this.cdr.detectChanges();
      }
    });
  }

  // Tải bài viết liên quan (tối đa 3 bài, loại bỏ bài hiện tại)
  loadRelated(tag: string, currentId: string): void {
    if (!tag) return;
    
    this.blogService.getBlogs(tag, 4).subscribe({
      next: (blogs) => {
        this.relatedBlogs = blogs
          .filter(b => b._id !== currentId)
          .slice(0, 3);
        this.cdr.detectChanges();
      }
    });
  }

  // Xử lý đường dẫn ảnh từ Backend
  getImageUrl(path: string): string {
    if (!path) return 'assets/images/placeholder.jpg';
    if (path.startsWith('http')) return path;
    return `http://localhost:3000/${path}`;
  }

  // Định dạng ngày tháng (Ngày tháng năm)
  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit', 
      month: 'long', 
      year: 'numeric'
    });
  }

  /**
   * Định dạng ngày đầy đủ cho Meta bài viết (Dạng chuỗi hoặc ISO)
   */
  formatFullDate(dateInput: any): string {
    if (!dateInput) return '---';
    
    if (typeof dateInput === 'string' && dateInput.includes('/')) {
      return dateInput;
    }

    const d = new Date(dateInput);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  // goBack(): void {
  //   this.router.navigate(['/blog']);
  // }
  goBack(): void {
  window.scrollTo({ top: 0, behavior: 'instant' });
  // giữ nguyên logic navigate cũ của bạn, ví dụ:
  this.router.navigate(['/blog']);
  // hoặc: this.location.back();
}

  // Chức năng chia sẻ bài viết lên mạng xã hội
  share(platform: string): void {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(this.blog?.title || 'HEALTHUP Blog');
    
    const shareLinks: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
    };

    if (platform === 'copy') {
      navigator.clipboard.writeText(window.location.href).then(() => {
        alert('Đã sao chép liên kết bài viết!');
      });
    } else if (shareLinks[platform]) {
      window.open(shareLinks[platform], '_blank', 'width=600,height=400');
    }
  }
}