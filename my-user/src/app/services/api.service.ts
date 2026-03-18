import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export const API_BASE    = 'http://localhost:3000/api';
export const STATIC_BASE = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  private fixImages(p: any): any {
    const fixUrl = (img: string) =>
      img && img.startsWith('http') ? img : `${STATIC_BASE}${img}`;
    const fixedImages = (p.images || []).map(fixUrl);

    const id = p._id ? (typeof p._id === 'object' ? p._id.toString() : String(p._id)) : '';

    return {
      ...p,
      _id: id,
      images: fixedImages,
      image: fixedImages[0] || '',
    };
  }

  getFeaturedProducts(): Observable<any[]> {
    return this.http.get<any[]>(`${API_BASE}/products/featured`).pipe(
      map(products => products.map(p => this.fixImages(p)))
    );
  }

  getProducts(filters: any = {}): Observable<any> {
    let params = new HttpParams();
    if (filters.cat)                     params = params.set('cat', filters.cat);
    if (filters.minPrice !== undefined)  params = params.set('minPrice', filters.minPrice.toString());
    if (filters.maxPrice !== undefined)  params = params.set('maxPrice', filters.maxPrice.toString());
    if (filters.badge)                   params = params.set('badge', filters.badge);
    if (filters.minRating !== undefined) params = params.set('minRating', filters.minRating.toString());
    if (filters.sort)                    params = params.set('sort', filters.sort);
    if (filters.page)                    params = params.set('page', filters.page.toString());
    if (filters.limit)                   params = params.set('limit', filters.limit.toString());

    return this.http.get<any>(`${API_BASE}/products`, { params }).pipe(
      map(res => ({
        ...res,
        products: (res.products || []).map((p: any) => this.fixImages(p))
      }))
    );
  }

  getCategoryCounts(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${API_BASE}/products/category-counts`);
  }

  getProductById(id: string): Observable<any> {
    return this.http.get<any>(`${API_BASE}/products/${id}`).pipe(
      map(p => this.fixImages(p))
    );
  }

  getRelatedProducts(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${API_BASE}/products/${id}/related`).pipe(
      map(products => products.map(p => this.fixImages(p)))
    );
  }

  getReviews(productId: string, filters: any = {}): Observable<any> {
    let params = new HttpParams();
    if (filters.filter) params = params.set('filter', filters.filter);
    if (filters.sort)   params = params.set('sort', filters.sort);
    if (filters.page)   params = params.set('page', filters.page.toString());
    if (filters.limit)  params = params.set('limit', filters.limit.toString());
    return this.http.get<any>(`${API_BASE}/reviews/product/${productId}`, { params });
  }

  submitReview(data: any): Observable<any> {
    return this.http.post<any>(`${API_BASE}/reviews`, data);
  }

  markHelpful(reviewId: string): Observable<any> {
    return this.http.patch<any>(`${API_BASE}/reviews/${reviewId}/helpful`, {});
  }

  // ===== BLOG =====
  getBlogs(limit?: number, tag?: string): Observable<any[]> {
    let params = new HttpParams();
    if (limit) params = params.set('limit', limit.toString());
    if (tag)   params = params.set('tag', tag);
    return this.http.get<any[]>(`${API_BASE}/blogs`, { params });
  }

  getBlogById(id: string): Observable<any> {
    return this.http.get<any>(`${API_BASE}/blogs/${id}`);
  }

  // ===== CART =====
  addToCart(data: any) {
    const headers = new HttpHeaders({
      'x-user-id': '507f1f77bcf86cd799439011'
    });
    return this.http.post(`${API_BASE}/cart/add`, data, { headers });
  }

  // ===== ORDER =====
  getOrders(): Observable<any[]> {
    return this.http.get<any[]>(`${API_BASE}/orders`);
  }

  getOrderById(id: string): Observable<any> {
    return this.http.get<any>(`${API_BASE}/orders/${id}`);
  }

  updateOrderStatus(id: string, status: string): Observable<any> {
    return this.http.patch(`${API_BASE}/orders/${id}/status`, { status });
  }

  cancelOrder(id: string): Observable<any> {
    return this.http.patch(`${API_BASE}/orders/${id}/status`, { status: 'cancelled' });
  }

  deleteOrder(id: string): Observable<any> {
    return this.http.delete(`${API_BASE}/orders/${id}`);
  }

  // ===== CONSULTING =====
  getConsultingQuestions(productId: string, filters: any = {}): Observable<any> {
    let params = new HttpParams();
    params = params.set('productId', productId);
    if (filters.filter && filters.filter !== 'all') params = params.set('status', filters.filter);
    if (filters.page)  params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    return this.http.get<any>(`${API_BASE}/consulting`, { params });
  }

  submitConsultingQuestion(data: any): Observable<any> {
    return this.http.post<any>(`${API_BASE}/consulting`, data);
  }
}