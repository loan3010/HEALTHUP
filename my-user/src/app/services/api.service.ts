import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { map } from 'rxjs/operators';

export const API_BASE    = 'http://localhost:3000/api';
export const STATIC_BASE = 'http://localhost:3000';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ApiService {

  private _cartCount = new BehaviorSubject<number>(0);
  cartCount$ = this._cartCount.asObservable();

  private _wishlist = new BehaviorSubject<string[]>(this.loadWishlistFromStorage());
  wishlist$ = this._wishlist.asObservable();

  private _toasts = new BehaviorSubject<Toast[]>([]);
  toasts$ = this._toasts.asObservable();
  private _toastCounter = 0;

  // ✅ Stream unread count cho header badge
  private _unreadCount = new BehaviorSubject<number>(0);
  unreadCount$ = this._unreadCount.asObservable();

  constructor(private http: HttpClient) {
    this.refreshCartCount();
    this.refreshUnreadCount();
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Private helpers
  // ════════════════════════════════════════════════════════════════════════════

  private getUserId(): string {
    const direct = localStorage.getItem('userId');
    if (direct) return direct;
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user?.id || '';
    } catch { return ''; }
  }

  private cartHeaders(): HttpHeaders {
    return new HttpHeaders({ 'x-user-id': this.getUserId() });
  }

  private fixImages(p: any): any {
    const fixUrl = (img: string) =>
      img && img.startsWith('http') ? img : `${STATIC_BASE}${img}`;
    const fixedImages = (p.images || []).map(fixUrl);
    const id = p._id ? (typeof p._id === 'object' ? p._id.toString() : String(p._id)) : '';
    return { ...p, _id: id, images: fixedImages, image: fixedImages[0] || '' };
  }

  private loadWishlistFromStorage(): string[] {
    try {
      return JSON.parse(localStorage.getItem('healthup_wishlist') || '[]');
    } catch { return []; }
  }

  private saveWishlistToStorage(list: string[]): void {
    localStorage.setItem('healthup_wishlist', JSON.stringify(list));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Toast helpers
  // ════════════════════════════════════════════════════════════════════════════

  showToast(message: string, type: Toast['type'] = 'success', duration = 3000): void {
    const id = ++this._toastCounter;
    const current = this._toasts.getValue();
    this._toasts.next([...current, { id, message, type }]);
    setTimeout(() => this.dismissToast(id), duration);
  }

  dismissToast(id: number): void {
    this._toasts.next(this._toasts.getValue().filter(t => t.id !== id));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Wishlist helpers
  // ════════════════════════════════════════════════════════════════════════════

  getWishlist(): string[] { return this._wishlist.getValue(); }

  isWishlisted(id: string): boolean { return this._wishlist.getValue().includes(id); }

  toggleWishlist(id: string, productName?: string): void {
    const current = this._wishlist.getValue();
    const next = current.includes(id)
      ? current.filter(x => x !== id)
      : [...current, id];
    this._wishlist.next(next);
    this.saveWishlistToStorage(next);
    const added = next.includes(id);
    this.showToast(
      added
        ? `Đã thêm "${productName || 'sản phẩm'}" vào yêu thích`
        : `Đã xóa khỏi danh sách yêu thích`,
      added ? 'success' : 'info'
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Cart count helper
  // ════════════════════════════════════════════════════════════════════════════

  refreshCartCount(): void {
    if (!this.getUserId()) return;
    this.getCart().subscribe({
      next: (res) => {
        const items: any[] = res?.items || res?.cart?.items || [];
        const count = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
        this._cartCount.next(count);
      },
      error: () => {}
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Product APIs
  // ════════════════════════════════════════════════════════════════════════════

  getFeaturedProducts(): Observable<any[]> {
    return this.http.get<any[]>(`${API_BASE}/products/featured`).pipe(
      map(products => products.map(p => this.fixImages(p)))
    );
  }

  getProducts(filters: {
    cat?: string; minPrice?: number; maxPrice?: number; badge?: string;
    minRating?: number; sort?: string; page?: number; limit?: number; search?: string;
  } = {}): Observable<{ products: any[]; total: number; totalPages: number }> {
    let params = new HttpParams();
    if (filters.cat)                     params = params.set('cat',       filters.cat);
    if (filters.minPrice !== undefined)  params = params.set('minPrice',  filters.minPrice.toString());
    if (filters.maxPrice !== undefined)  params = params.set('maxPrice',  filters.maxPrice.toString());
    if (filters.badge)                   params = params.set('badge',     filters.badge);
    if (filters.minRating !== undefined) params = params.set('minRating', filters.minRating.toString());
    if (filters.sort)                    params = params.set('sort',      filters.sort);
    if (filters.page)                    params = params.set('page',      filters.page.toString());
    if (filters.limit)                   params = params.set('limit',     filters.limit.toString());
    if (filters.search)                  params = params.set('search',    filters.search);
    return this.http.get<any>(`${API_BASE}/products`, { params }).pipe(
      map(res => ({ ...res, products: (res.products || []).map((p: any) => this.fixImages(p)) }))
    );
  }

  getCategoryCounts(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${API_BASE}/products/category-counts`);
  }

  getProductById(id: string): Observable<any> {
    return this.http.get<any>(`${API_BASE}/products/${id}`).pipe(map(p => this.fixImages(p)));
  }

  getRelatedProducts(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${API_BASE}/products/${id}/related`).pipe(
      map(products => products.map(p => this.fixImages(p)))
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Review APIs
  // ════════════════════════════════════════════════════════════════════════════

  getReviews(productId: string, filters: {
    filter?: string; sort?: string; page?: number; limit?: number;
  } = {}): Observable<any> {
    let params = new HttpParams();
    if (filters.filter) params = params.set('filter', filters.filter);
    if (filters.sort)   params = params.set('sort',   filters.sort);
    if (filters.page)   params = params.set('page',   filters.page.toString());
    if (filters.limit)  params = params.set('limit',  filters.limit.toString());
    return this.http.get<any>(`${API_BASE}/reviews/product/${productId}`, { params });
  }

  submitReview(data: any): Observable<any> {
    return this.http.post<any>(`${API_BASE}/reviews`, data);
  }

  markHelpful(reviewId: string): Observable<any> {
    return this.http.patch<any>(`${API_BASE}/reviews/${reviewId}/helpful`, {});
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Blog APIs
  // ════════════════════════════════════════════════════════════════════════════

  getBlogs(limit?: number, tag?: string): Observable<any[]> {
    let params = new HttpParams();
    if (limit) params = params.set('limit', limit.toString());
    if (tag)   params = params.set('tag',   tag);
    return this.http.get<any[]>(`${API_BASE}/blogs`, { params });
  }

  getBlogById(id: string): Observable<any> {
    return this.http.get<any>(`${API_BASE}/blogs/${id}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Consulting / Q&A APIs
  // ════════════════════════════════════════════════════════════════════════════

  getConsultingQuestions(productId: string, filters: {
    filter?: string; page?: number; limit?: number;
  } = {}): Observable<any> {
    let params = new HttpParams();
    params = params.set('productId', productId);
    if (filters.filter && filters.filter !== 'all') params = params.set('status', filters.filter);
    if (filters.page)  params = params.set('page',  filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    return this.http.get<any>(`${API_BASE}/consulting`, { params });
  }

  submitConsultingQuestion(data: any): Observable<any> {
    return this.http.post<any>(`${API_BASE}/consulting`, data);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Cart APIs
  // ════════════════════════════════════════════════════════════════════════════

  addToCart(productId: string, quantity: number, productName?: string): Observable<any> {
    return this.http.post<any>(
      `${API_BASE}/carts/add`,
      { productId, quantity },
      { headers: this.cartHeaders() }
    ).pipe(
      tap(() => {
        this.refreshCartCount();
        this.showToast(
          productName ? `Đã thêm "${productName}" vào giỏ hàng` : 'Đã thêm sản phẩm vào giỏ hàng',
          'success'
        );
      })
    );
  }

  getCart(): Observable<any> {
    return this.http.get<any>(`${API_BASE}/carts`, { headers: this.cartHeaders() });
  }

  updateCartItem(productId: string, quantity: number): Observable<any> {
    return this.http.put<any>(
      `${API_BASE}/carts/update`,
      { productId, quantity },
      { headers: this.cartHeaders() }
    ).pipe(tap(() => this.refreshCartCount()));
  }

  removeCartItem(productId: string): Observable<any> {
    return this.http.delete<any>(
      `${API_BASE}/carts/remove/${productId}`,
      { headers: this.cartHeaders() }
    ).pipe(tap(() => this.refreshCartCount()));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Order APIs
  // ════════════════════════════════════════════════════════════════════════════

  getOrders(userId?: string): Observable<any[]> {
    const params = userId ? new HttpParams().set('userId', userId) : new HttpParams();
    return this.http.get<any[]>(`${API_BASE}/orders`, { params });
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

  // ════════════════════════════════════════════════════════════════════════════
  //  Notification APIs
  // ════════════════════════════════════════════════════════════════════════════

  refreshUnreadCount(): void {
    if (!this.getUserId()) return;
    this.getNotifications().subscribe({
      next: (res) => this._unreadCount.next(res.unreadCount || 0),
      error: () => {}
    });
  }

  getNotifications(): Observable<{ notifications: any[]; unreadCount: number }> {
    return this.http.get<any>(`${API_BASE}/notifications`, { headers: this.cartHeaders() });
  }

  markNotificationRead(id: string): Observable<any> {
    return this.http.patch(
      `${API_BASE}/notifications/${id}/read`, {}
    ).pipe(tap(() => this.refreshUnreadCount()));
  }

  markAllNotificationsRead(): Observable<any> {
    return this.http.patch(
      `${API_BASE}/notifications/read-all`, {},
      { headers: this.cartHeaders() }
    ).pipe(tap(() => this._unreadCount.next(0)));
  }

  createNotification(data: {
    userId: string;
    title: string;
    message: string;
    type?: string;
    orderId?: string;
  }): Observable<any> {
    return this.http.post(`${API_BASE}/notifications`, data).pipe(
      tap(() => this.refreshUnreadCount())
    );
  }
}