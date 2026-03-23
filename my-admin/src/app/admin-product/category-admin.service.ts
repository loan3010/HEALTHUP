import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** Một dòng danh mục từ GET /api/admin/categories (có productCount tính từ Product.cat). */
export interface AdminCategoryRow {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  order: number;
  isActive: boolean;
  deactivatedAt?: string | null;
  productCount: number;
}

const BASE = 'http://localhost:3000/api/admin/categories';

@Injectable({ providedIn: 'root' })
export class CategoryAdminService {
  constructor(private http: HttpClient) {}

  list(): Observable<AdminCategoryRow[]> {
    return this.http.get<AdminCategoryRow[]>(BASE);
  }

  create(body: { name: string; slug?: string; description?: string; order?: number }): Observable<AdminCategoryRow> {
    return this.http.post<AdminCategoryRow>(BASE, body);
  }

  deactivate(id: string): Observable<AdminCategoryRow> {
    return this.http.patch<AdminCategoryRow>(`${BASE}/${id}/deactivate`, {});
  }

  restore(id: string): Observable<AdminCategoryRow> {
    return this.http.patch<AdminCategoryRow>(`${BASE}/${id}/restore`, {});
  }

  delete(id: string): Observable<{ message: string; id: string }> {
    return this.http.delete<{ message: string; id: string }>(`${BASE}/${id}`);
  }
}
