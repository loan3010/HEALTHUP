// src/app/blog/blog.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BlogList } from '../blog-list/blog-list';
import { BlogForm } from '../blog-form/blog-form'; // Đảm bảo đường dẫn này đúng

@Component({
  selector: 'app-admin-blog',
  standalone: true,
  // Phải import BlogForm vào đây thì HTML mới nhận ra thẻ <app-blog-form>
  imports: [CommonModule, BlogList, BlogForm], 
  templateUrl: './admin-blog.html',
  styleUrls: ['./admin-blog.css']
})
export class AdminBlog {
  viewMode: 'list' | 'form' = 'list';
  formMode: 'add' | 'edit' = 'add';
  selectedPost: any = null;

  get breadcrumbActiveText(): string {
    if (this.viewMode === 'list') return 'Danh sách bài viết';
    return this.formMode === 'add' ? 'Thêm bài viết mới' : 'Chi tiết bài viết';
  }

  handleGoEdit(post: any) {
    this.selectedPost = post;
    this.formMode = 'edit';
    this.viewMode = 'form';
  }

  handleGoAdd() {
    this.selectedPost = null;
    this.formMode = 'add';
    this.viewMode = 'form';
  }

  // CẦN KHAI BÁO HÀM NÀY ĐỂ SỬA LỖI TS2339
  handleBack() {
    this.viewMode = 'list';
    this.selectedPost = null;
  }
}