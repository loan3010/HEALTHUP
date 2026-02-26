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

  getBlogs(tag?: string, limit?: number): Observable<Blog[]> {
    let params = new HttpParams();
    if (tag) params = params.set('tag', tag);
    if (limit) params = params.set('limit', limit.toString());
    return this.http.get<Blog[]>(this.apiUrl, { params });
  }

  getBlogById(id: string): Observable<Blog> {
    return this.http.get<Blog>(`${this.apiUrl}/${id}`);
  }
}