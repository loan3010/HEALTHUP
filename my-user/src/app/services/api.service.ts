import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, of } from 'rxjs';
import { map } from 'rxjs/operators';

export const API_BASE    = 'http://localhost:3000/api';
export const STATIC_BASE = 'http://localhost:3000';

/** Đồng bộ với backend header x-guest-cart-id (UUID v4). */
export const GUEST_CART_STORAGE_KEY = 'healthup_guest_cart_id';

export interface CartItem {
  productId: string;
  variantId?: string | null;
  variantLabel?: string;
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

  // ── Cart count stream ──────────────────────────────────────────────────────
  private _cartCount = new BehaviorSubject<number>(0);
  cartCount$ = this._cartCount.asObservable();

  // ── Wishlist stream ────────────────────────────────────────────────────────
  private _wishlist = new BehaviorSubject<string[]>(this.loadWishlistFromStorage());
  wishlist$ = this._wishlist.asObservable();

  private _toasts = new BehaviorSubject<Toast[]>([]);
  toasts$ = this._toasts.asObservable();
  private _toastCounter = 0;

  // ✅ Cache cho getProducts: key = JSON.stringify(filters), TTL 20s
  private _productsCache = new Map<string, { data: any; ts: number }>();
  private readonly _PRODUCTS_TTL = 20_000;

  // Stream unread count cho header badge
  private _unreadCount = new BehaviorSubject<number>(0);
  unreadCount$ = this._unreadCount.asObservable();

  constructor(private http: HttpClient) {
    this.refreshCartCount();
    this.refreshUnreadCount();
    this.refreshWishlist();

    // ✅ Tự động refresh unread count mỗi 30 giây
    // để badge cập nhật khi admin đổi trạng thái đơn hàng
    setInterval(() => {
      if (this.getUserId() && this.getToken()) {
        this.refreshUnreadCount();
      }
    }, 30000);

    // Khi quay lại tab: đồng bộ chuông (socket có thể bỏ lỡ sự kiện).
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.getUserId() && this.getToken()) {
          this.refreshUnreadCount();
        }
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Private helpers
  // ════════════════════════════════════════════════════════════════════════════

  private getUserId(): string {
    const direct = localStorage.getItem('userId');
    if (direct) return direct;
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user?._id || user?.id || '';
    } catch { return ''; }
  }

  private getToken(): string {
    return localStorage.getItem('token') || '';
  }

  /**
   * Phiên giỏ khách (chưa đăng nhập): UUID lưu localStorage, gửi qua x-guest-cart-id.
   * Không dùng chung với checkout cart_v1 — đây là giỏ trên MongoDB.
   */
  private getOrCreateGuestCartSessionId(): string {
    const genUuidV4 = (): string => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };
    // Phải khớp chuẩn UUID (giống backend cartIdentity) — id cũ sai định dạng thì tạo mới.
    const isUuidShape = (v: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
    try {
      let id = localStorage.getItem(GUEST_CART_STORAGE_KEY);
      if (id && isUuidShape(id.trim())) return id.trim();
      id = genUuidV4();
      localStorage.setItem(GUEST_CART_STORAGE_KEY, id);
      return id;
    } catch {
      return genUuidV4();
    }
  }

  /** Header giỏ: user đăng nhập → x-user-id; khách → x-guest-cart-id. */
  private cartHeaders(): HttpHeaders {
    const uid = String(this.getUserId() || '').trim();
    if (uid && /^[a-f0-9]{24}$/i.test(uid)) {
      return new HttpHeaders({ 'x-user-id': uid });
    }
    return new HttpHeaders({ 'x-guest-cart-id': this.getOrCreateGuestCartSessionId() });
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.getToken()}` });
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
    this._toasts.next([...this._toasts.getValue(), { id, message, type }]);
    setTimeout(() => this.dismissToast(id), duration);
  }

  dismissToast(id: number): void {
    this._toasts.next(this._toasts.getValue().filter(t => t.id !== id));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Wishlist API
  // ════════════════════════════════════════════════════════════════════════════

  refreshWishlist(): void {
    const userId = this.getUserId();
    if (!userId || !this.getToken()) return;
    this.http.get<any>(`${API_BASE}/users/${userId}/wishlist`, {
      headers: this.authHeaders()
    }).subscribe({
      next: (res) => {
        const items: any[] = res?.wishlist || [];
        const ids = items.map((p: any) =>
          typeof p === 'string' ? p : String(p._id || p)
        );
        this._wishlist.next(ids);
        this.saveWishlistToStorage(ids);
      },
      error: () => {}
    });
  }

  getWishlist(): string[] { return this._wishlist.getValue(); }

  isWishlisted(id: string): boolean { return this._wishlist.getValue().includes(id); }

  toggleWishlist(productId: string, productName?: string): void {
    const userId  = this.getUserId();
    const current = this._wishlist.getValue();
    const isAdded = current.includes(productId);

    if (!userId || !this.getToken()) {
      this.showToast('Vui lòng đăng nhập để thêm yêu thích', 'info');
      return;
    }

    if (isAdded) {
      const next = current.filter(id => id !== productId);
      this._wishlist.next(next);
      this.saveWishlistToStorage(next);
      this.showToast('Đã xóa khỏi danh sách yêu thích', 'info');
      this.http.delete(`${API_BASE}/users/${userId}/wishlist/${productId}`, {
        headers: this.authHeaders()
      }).subscribe({
        error: () => {
          this._wishlist.next([...this._wishlist.getValue(), productId]);
          this.saveWishlistToStorage([...this._wishlist.getValue(), productId]);
          this.showToast('Không thể xóa yêu thích. Thử lại!', 'error');
        }
      });
    } else {
      const next = [...current, productId];
      this._wishlist.next(next);
      this.saveWishlistToStorage(next);
      this.showToast(`Đã thêm "${productName || 'sản phẩm'}" vào yêu thích ❤️`, 'success');
      this.http.post(`${API_BASE}/users/${userId}/wishlist`, { productId }, {
        headers: this.authHeaders()
      }).subscribe({
        error: () => {
          const rollback = this._wishlist.getValue().filter(id => id !== productId);
          this._wishlist.next(rollback);
          this.saveWishlistToStorage(rollback);
          this.showToast('Không thể thêm yêu thích. Thử lại!', 'error');
        }
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Cart count helper
  // ════════════════════════════════════════════════════════════════════════════

  refreshCartCount(): void {
    this.getCart().subscribe({
      next: (res) => {
        const items: any[] = res?.items || res?.cart?.items || [];
        const count = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
        this._cartCount.next(count);
      },
      error: () => {
        this._cartCount.next(0);
      },
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

    // ✅ Cache: trả ngay nếu cùng filters trong vòng 20 giây
    const cacheKey = JSON.stringify(filters);
    const cached = this._productsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this._PRODUCTS_TTL) {
      return of(cached.data);
    }

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
      map(res => ({ ...res, products: (res.products || []).map((p: any) => this.fixImages(p)) })),
      tap(result => {
        this._productsCache.set(cacheKey, { data: result, ts: Date.now() });
      })
    );
  }

  // ✅ Gọi khi thêm/sửa/xóa sản phẩm để cache không stale
  clearProductsCache(): void {
    this._productsCache.clear();
  }

  getCategoryCounts(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${API_BASE}/products/category-counts`);
  }

  getProductById(id: string, isAdmin = false): Observable<any> {
    const params = isAdmin ? new HttpParams().set('isAdmin', 'true') : new HttpParams();
    return this.http.get<any>(`${API_BASE}/products/${id}`, { params }).pipe(
      map(p => this.fixImages(p))
    );
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

  uploadReviewImages(files: File[]): Observable<{ urls: string [] }> {
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));
    return this.http.post<{ urls: string[] }>(`${API_BASE}/reviews/upload-images`, formData);
  }

  updateReview(reviewId: string, data: {
    rating: number; text: string; tags?: string[]; variant?: string; imgs?: string[];
  }): Observable<any> {
    return this.http.put<any>(`${API_BASE}/reviews/${reviewId}`, data);
  }

  deleteReview(reviewId: string): Observable<any> {
    return this.http.delete<any>(`${API_BASE}/reviews/${reviewId}`);
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
  //  Consulting APIs (Hỏi & Đáp)
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Lấy danh sách câu hỏi của một sản phẩm (Có phân trang & lọc)
   */
  getConsultingQuestions(productId: string, filters: {
    filter?: string; page?: number; limit?: number;
  } = {}): Observable<any> {
    let params = new HttpParams();
    if (filters.filter && filters.filter !== 'all') params = params.set('filter', filters.filter);
    if (filters.page)  params = params.set('page',  filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    
    return this.http.get<any>(`${API_BASE}/consulting/product/${productId}`, { params });
  }

  /**
   * Khách hàng gửi câu hỏi mới
   */
  /**
   * Gửi câu hỏi tư vấn. Nếu đã đăng nhập — gửi kèm Bearer để backend lưu userId (nhận thông báo khi admin trả lời).
   */
  submitConsultingQuestion(data: { productId: string; content: string; user: string }): Observable<any> {
    const token = this.getToken();
    const headers = token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
    return this.http.post<any>(`${API_BASE}/consulting`, data, { headers });
  }

  /**
   * KHÁCH HÀNG: Đánh giá câu trả lời hữu ích hoặc không hữu ích (Like/Dislike)
   */
  voteConsultingQuestion(id: string, type: 'up' | 'down'): Observable<any> {
    return this.http.put(`${API_BASE}/consulting/${id}/vote`, { type });
  }

  // --- ADMIN METHODS ---

  /**
   * ADMIN: Lấy tóm tắt câu hỏi của tất cả sản phẩm
   */
  getConsultingSummary(): Observable<any[]> {
    return this.http.get<any[]>(`${API_BASE}/consulting/admin/summary`);
  }

  /**
   * ADMIN: Trả lời câu hỏi (kèm tên Admin thực hiện)
   */
  replyConsultingQuestion(questionId: string, answer: string, answeredBy: string): Observable<any> {
    return this.http.put(`${API_BASE}/consulting/${questionId}/reply`, { answer, answeredBy });
  }

  /**
   * ADMIN: Xóa câu hỏi tư vấn
   */
  deleteConsultingQuestion(id: string): Observable<any> {
    return this.http.delete(`${API_BASE}/consulting/${id}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Banner APIs
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Truy xuất danh sách banner đang hoạt động để hiển thị Slider
   */
  getBanners(): Observable<any[]> {
    return this.http.get<any[]>(`${API_BASE}/banners/active`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Cart APIs
  // ════════════════════════════════════════════════════════════════════════════

  addToCart(
    productId: string, quantity: number, productName?: string,
    variantId?: string | null, variantLabel?: string
  ): Observable<any> {
    return this.http.post<any>(
      `${API_BASE}/carts/add`,
      { productId, quantity, variantId: variantId || null, variantLabel: variantLabel || '' },
      { headers: this.cartHeaders() }
    ).pipe(
      tap(() => {
        this.refreshCartCount();
        this.showToast(
          productName ? `Đã thêm "${productName}" vào giỏ hàng 🛒` : 'Đã thêm vào giỏ hàng',
          'success'
        );
      })
    );
  }

  getCart(): Observable<any> {
    return this.http.get<any>(`${API_BASE}/carts`, { headers: this.cartHeaders() });
  }

  updateCartItem(productId: string, quantity: number, variantId?: string | null): Observable<any> {
    return this.http.put<any>(
      `${API_BASE}/carts/update`,
      { productId, quantity, variantId: variantId || null },
      { headers: this.cartHeaders() }
    ).pipe(tap(() => this.refreshCartCount()));
  }

  removeCartItem(productId: string, variantId?: string | null): Observable<any> {
    const query = variantId ? `?variantId=${encodeURIComponent(variantId)}` : '';
    return this.http.delete<any>(
      `${API_BASE}/carts/remove/${productId}${query}`,
      { headers: this.cartHeaders() }
    ).pipe(tap(() => this.refreshCartCount()));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Order APIs
  // ════════════════════════════════════════════════════════════════════════════

  getOrders(userId?: string): Observable<any[]> {
    if (!userId) return of([]);
    const params = new HttpParams().set('userId', userId);
    return this.http.get<any[]>(`${API_BASE}/orders`, { params });
  }

  getOrderById(id: string): Observable<any> {
    return this.http.get<any>(`${API_BASE}/orders/${id}`);
  }

  /** Tra cứu đơn không cần đăng nhập (SĐT + mã đơn ORD...). */
  guestLookupOrder(phone: string, orderCode: string): Observable<{ order: any }> {
    return this.http.post<{ order: any }>(`${API_BASE}/orders/guest-lookup`, {
      phone: String(phone || '').trim(),
      orderCode: String(orderCode || '').trim(),
    });
  }

  /** Yêu cầu đổi trả khi không đăng nhập — xác minh SĐT + mã đơn trong FormData. */
  guestRequestReturn(
    orderId: string,
    data: {
      phone: string;
      orderCode: string;
      reason: string;
      note?: string;
      items?: any[];
      images?: File[];
    }
  ): Observable<any> {
    const formData = new FormData();
    formData.append('phone', data.phone);
    formData.append('orderCode', data.orderCode);
    formData.append('reason', data.reason);
    if (data.note) formData.append('note', data.note);
    if (data.items?.length) {
      formData.append('items', JSON.stringify(data.items));
    }
    (data.images || []).forEach((f) => formData.append('images', f));
    return this.http.patch<any>(
      `${API_BASE}/orders/${orderId}/guest-request-return`,
      formData
    );
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

  // ── Return APIs ────────────────────────────────────────────────────────────

  requestReturn(orderId: string, data: {
    reason: string;
    note?: string;
    items?: any[];
    images?: File[];
  }): Observable<any> {
    const formData = new FormData();
    formData.append('reason', data.reason);
    if (data.note) formData.append('note', data.note);
    if (data.items && data.items.length > 0) {
      formData.append('items', JSON.stringify(data.items));
    }
    if (data.images && data.images.length > 0) {
      data.images.forEach(file => formData.append('images', file));
    }
    const headers = new HttpHeaders({ Authorization: `Bearer ${this.getToken()}` });
    return this.http.patch<any>(
      `${API_BASE}/orders/${orderId}/request-return`,
      formData,
      { headers }
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  Notification APIs
  // ════════════════════════════════════════════════════════════════════════════

  refreshUnreadCount(): void {
    if (!this.getUserId() || !this.getToken()) return;
    this.getNotifications().subscribe({
      next: (res) => this._unreadCount.next(res.unreadCount || 0),
      error: () => {}
    });
  }

  getNotifications(): Observable<{ notifications: any[]; unreadCount: number }> {
    return this.http.get<any>(`${API_BASE}/notifications`, { headers: this.authHeaders() });
  }

  markNotificationRead(id: string): Observable<any> {
    return this.http.patch(
      `${API_BASE}/notifications/${id}/read`, {}
    ).pipe(tap(() => this.refreshUnreadCount()));
  }

  markAllNotificationsRead(): Observable<any> {
    return this.http.patch(
      `${API_BASE}/notifications/read-all`, {},
      { headers: this.authHeaders() }
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

  deleteNotification(id: string): Observable<any> {
    return this.http.delete(`${API_BASE}/notifications/${id}`, { headers: this.authHeaders() });
  }

  deleteAllNotifications(): Observable<any> {
    return this.http.delete(`${API_BASE}/notifications`, { headers: this.authHeaders() });
  }
}