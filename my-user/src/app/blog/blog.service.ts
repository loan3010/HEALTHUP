import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Blog } from './blog.model';

@Injectable({
  providedIn: 'root'
})
export class BlogService {
  private apiUrl = 'http://localhost:3000/api/blogs';

  constructor(private http: HttpClient) {}

  /**
   * Lấy danh sách bài viết với các bộ lọc và sắp xếp
   * @param tag Danh mục bài viết (không bắt buộc)
   * @param limit Số lượng bài viết tối đa cần lấy (không bắt buộc)
   * @param sortBy Tiêu chí sắp xếp: 'newest', 'oldest', 'most-viewed' (không bắt buộc)
   */
  getBlogs(tag?: string, limit?: number, sortBy?: string): Observable<Blog[]> {
    let params = new HttpParams();
    
    if (tag && tag !== 'Tất cả') {
      params = params.set('tag', tag);
    }
    
    if (limit) {
      params = params.set('limit', limit.toString());
    }

    if (sortBy) {
      params = params.set('sortBy', sortBy);
    }

    return this.http.get<Blog[]>(this.apiUrl, { params });
  }

  /**
   * Lấy chi tiết một bài viết theo ID
   */
  getBlogById(id: string): Observable<Blog> {
    return this.http.get<Blog>(`${this.apiUrl}/${id}`);
  }

  /**
   * Hàm chuyên dụng lấy bài viết có lượt xem cao nhất (Nổi bật nhất)
   * Gọi API với limit=1 và sắp xếp theo 'most-viewed'
   */
  getTopViewedBlog(): Observable<Blog[]> {
    let params = new HttpParams()
      .set('limit', '1')
      .set('sortBy', 'most-viewed');
    
    return this.http.get<Blog[]>(this.apiUrl, { params });
  }
}