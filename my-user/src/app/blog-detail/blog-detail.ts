import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Blog } from '../blog/blog.model';
import { BlogService } from '../blog/blog.service';

@Component({
  selector: 'app-blog-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './blog-detail.html',
  styleUrls: ['./blog-detail.css']
})
export class BlogDetailComponent implements OnInit {

  blog: Blog | null = null;
  relatedBlogs: Blog[] = [];
  isLoading = true;
  notFound = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private blogService: BlogService,
    private cdr: ChangeDetectorRef   // ✅ thêm vào
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.isLoading = true;
        this.notFound  = false;
        this.blog      = null;
        this.loadBlog(id);
      }
    });
  }

  // Nếu content là plain text (không có tag HTML) thì tự wrap thành <p>
  formatContent(content: string): string {
    if (!content) return '';
    const isHtml = /<[a-z][\s\S]*>/i.test(content);
    if (isHtml) return content;
    // Split theo dòng trống hoặc dấu xuống dòng, wrap từng đoạn thành <p>
    return content
      .split(/\n{2,}/)
      .map(para => para.trim())
      .filter(para => para.length > 0)
      .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  loadBlog(id: string): void {
    this.blogService.getBlogById(id).subscribe({
      next: (data) => {
        // Format content nếu là plain text
        data.content = this.formatContent(data.content);
        this.blog      = data;
        this.isLoading = false;
        this.cdr.detectChanges();   // ✅ hiện content ngay
        this.loadRelated(data.tag, id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: () => {
        this.isLoading = false;
        this.notFound  = true;
        this.cdr.detectChanges();   // ✅ hiện not found ngay
      }
    });
  }

  loadRelated(tag: string, currentId: string): void {
    this.blogService.getBlogs(tag, 4).subscribe({
      next: (blogs) => {
        this.relatedBlogs = blogs.filter(b => b._id !== currentId).slice(0, 3);
        this.cdr.detectChanges();   // ✅ hiện related blogs ngay
      }
    });
  }

  getImageUrl(path: string): string {
    if (!path) return 'assets/images/placeholder.jpg';
    if (path.startsWith('http')) return path;
    return `http://localhost:3000/${path}`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  goBack(): void {
    this.router.navigate(['/blog']);
  }

  share(platform: string): void {
    const url  = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(this.blog?.title || '');
    const links: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      twitter:  `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
      copy:     window.location.href,
    };
    if (platform === 'copy') {
      navigator.clipboard.writeText(window.location.href);
    } else {
      window.open(links[platform], '_blank', 'width=600,height=400');
    }
  }
}