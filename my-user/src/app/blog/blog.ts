import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Blog } from './blog.model';

@Component({
  selector: 'app-blog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './blog.html',
  styleUrls: ['./blog.css']
})
export class BlogComponent implements OnInit {

  allBlogs: Blog[] = [];
  filteredBlogs: Blog[] = [];
  featuredBlog: Blog | null = null;
  displayedBlogs: Blog[] = [];

  tags: string[] = [];
  selectedTag: string = 'Tất cả';
  searchQuery: string = '';

  pageSize: number = 6;
  currentCount: number = 6;
  loading: boolean = true;

  private apiUrl = 'http://localhost:3000/api/blogs';

  constructor(private http: HttpClient) {}

  // ngOnInit(): void {
  //   console.log("BlogComponent init");

  //   this.loading = true;

  //   this.http.get<Blog[]>(this.apiUrl).subscribe({
  //     next: (data) => {
  //       console.log("API DATA:", data);

  //       // 🔥 đảm bảo data luôn là mảng
  //       const blogs = Array.isArray(data) ? data : [];

  //       this.allBlogs = blogs;
  //       this.featuredBlog = blogs.length > 0 ? blogs[0] : null;

  //       const tagSet = new Set<string>(
  //         blogs
  //           .map((b) => b.tag)
  //           .filter((tag): tag is string => !!tag)
  //       );

  //       this.tags = ['Tất cả', ...Array.from(tagSet)];

  //       this.applyFilter();

  //       this.loading = false; // ✅ chắc chắn tắt loading
  //     },
  //     error: (err) => {
  //       console.error('Lỗi tải blog:', err);
  //       this.loading = false; // ✅ không bao giờ kẹt spinner
  //     }
  //   });
  // }
  ngOnInit(): void {
  console.log('INIT BLOG COMPONENT');
  this.loading = true;

  this.http.get<Blog[]>(this.apiUrl).subscribe({
    next: (data) => {
      console.log('API RETURNED', data);

      const blogs = Array.isArray(data) ? data : [];

      this.allBlogs = blogs;
      this.featuredBlog = blogs[0] ?? null;

      const tagSet = new Set(
        blogs
          .map(b => b.tag)
          .filter((t): t is string => !!t)
      );

      this.tags = ['Tất cả', ...Array.from(tagSet)];

      this.applyFilter();
    },
    error: (err) => {
      console.error('Lỗi tải blog:', err);
    },
    complete: () => {
      console.log('REQUEST COMPLETE');
      this.loading = false;   // 🔥 đảm bảo luôn tắt
    }
  });
}

  selectTag(tag: string): void {
    this.selectedTag = tag;
    this.currentCount = this.pageSize;
    this.applyFilter();
  }

  onSearch(): void {
    this.currentCount = this.pageSize;
    this.applyFilter();
  }

  applyFilter(): void {
    let result = this.allBlogs.length > 0 ? this.allBlogs.slice(1) : [];

    if (this.selectedTag !== 'Tất cả') {
      result = result.filter((b) => b.tag === this.selectedTag);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter((b) =>
        (b.title || '').toLowerCase().includes(q) ||
        (b.excerpt || '').toLowerCase().includes(q)
      );
    }

    this.filteredBlogs = result;
    this.displayedBlogs = result.slice(0, this.currentCount);
  }

  loadMore(): void {
    this.currentCount += this.pageSize;
    this.displayedBlogs = this.filteredBlogs.slice(0, this.currentCount);
  }

  get hasMore(): boolean {
    return this.displayedBlogs.length < this.filteredBlogs.length;
  }

  getImageUrl(path: string): string {
    if (!path) return 'assets/images/placeholder.jpg';
    if (path.startsWith('http')) return path;
    return `http://localhost:3000/${path}`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
}