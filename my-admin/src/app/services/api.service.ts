import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';


/**
 * Cấu hình tham số kết nối hệ thống Backend
 */
export const API_BASE = 'http://localhost:3000/api';
export const STATIC_BASE = 'http://localhost:3000';


@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = API_BASE;


  // Quản lý trạng thái danh sách yêu thích (Wishlist) trong toàn bộ ứng dụng
  private wishlist = new BehaviorSubject<string[]>(this.getWishlistFromStorage());
  wishlist$ = this.wishlist.asObservable();


  constructor(private http: HttpClient) {}


  // ==========================================
  // 1. PHÂN HỆ: QUẢN LÝ SẢN PHẨM
  // ==========================================


  /**
   * Truy xuất thông tin chi tiết của một sản phẩm theo ID
   */
  getProductById(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/products/${id}`);
  }


  /**
   * Lấy danh sách sản phẩm liên quan dựa trên sản phẩm hiện tại
   */
  getRelatedProducts(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/products/${id}/related`);
  }


  /**
   * Tải danh sách các danh mục sản phẩm từ cơ sở dữ liệu
   */
  getCategories(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/categories`);
  }




  // ==========================================
  // 2. PHÂN HỆ: QUẢN LÝ TƯ VẤN (CONSULTING)
  // ==========================================


  /**
   * KHÁCH HÀNG: Gửi yêu cầu tư vấn hoặc câu hỏi mới
   * @param data { productId, content, user }
   */
  submitConsultingQuestion(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/consulting`, data);
  }


  /**
   * Truy xuất danh sách câu hỏi của một sản phẩm (Hỗ trợ phân trang và bộ lọc)
   */
  getConsultingQuestions(productId: string, params: any): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/consulting/product/${productId}`, { params });
  }


  /**
   * KHÁCH HÀNG: Đánh giá câu trả lời hữu ích hoặc không hữu ích
   */
  voteConsultingQuestion(id: string, type: 'up' | 'down'): Observable<any> {
    return this.http.put(`${this.baseUrl}/consulting/${id}/vote`, { type });
  }


  /**
   * QUẢN TRỊ VIÊN: Lấy dữ liệu tóm tắt trạng thái tư vấn của toàn bộ sản phẩm
   */
  getConsultingSummary(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/consulting/admin/summary`);
  }


  /**
   * QUẢN TRỊ VIÊN: Gửi nội dung phản hồi hoặc cập nhật câu trả lời kèm tên người thực hiện
   */
  replyConsultingQuestion(questionId: string, answer: string, answeredBy: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/consulting/${questionId}/reply`, { answer, answeredBy });
  }


  /**
   * QUẢN TRỊ VIÊN: Xóa câu hỏi và tự động gửi thông báo lý do cho khách hàng.
   * CẬP NHẬT: Thêm productId vào payload để tạo link điều hướng cho khách.
   */
  deleteConsultingQuestion(data: {
    questionId: string;
    userId?: string;
    productName: string;
    reason: string;
    productId: string;
  }): Observable<any> {
    // Nếu có khách hàng và lý do, gửi thông báo qua hệ thống trước
    if (data.userId && data.reason) {
      this.createNotification({
        userId: data.userId,
        title: 'Câu hỏi của bạn đã bị gỡ bỏ',
        message: `Câu hỏi về sản phẩm "${data.productName}" đã bị xóa. Lý do: ${data.reason}`,
        type: 'consulting',
        productId: data.productId // Truyền ID sản phẩm vào thông báo
      }).subscribe();
    }
    return this.http.delete(`${this.baseUrl}/consulting/${data.questionId}`);
  }




  // ==========================================
  // 3. PHÂN HỆ: THÔNG BÁO (NOTIFICATIONS)
  // ==========================================


  /**
   * Tạo thông báo mới cho người dùng
   * CẬP NHẬT: Nhận thêm productId để khách hàng có thể click điều hướng
   */
  createNotification(data: {
    userId: string;
    title: string;
    message: string;
    type?: string;
    productId?: string;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/notifications`, data);
  }




  // ==========================================
  // 4. PHÂN HỆ: TIỆN ÍCH VÀ DỊCH VỤ HỆ THỐNG
  // ==========================================


  /**
   * Lấy dữ liệu danh sách yêu thích đã lưu trữ từ LocalStorage
   */
  private getWishlistFromStorage(): string[] {
    const data = localStorage.getItem('wishlist_v1');
    return data ? JSON.parse(data) : [];
  }


  /**
   * Kiểm tra xem sản phẩm đã tồn tại trong danh sách yêu thích hay chưa
   */
  isWishlisted(productId: string): boolean {
    return this.wishlist.value.includes(productId);
  }


  /**
   * Chuyển đổi trạng thái yêu thích của sản phẩm
   */
  toggleWishlist(productId: string, productName: string): void {
    let current = [...this.wishlist.value];
    if (current.includes(productId)) {
      current = current.filter(id => id !== productId);
      this.showToast(`Đã gỡ bỏ "${productName}" khỏi danh sách yêu thích`, 'info');
    } else {
      current.push(productId);
      this.showToast(`Đã thêm "${productName}" vào danh sách yêu thích`, 'success');
    }
    this.wishlist.next(current);
    localStorage.setItem('wishlist_v1', JSON.stringify(current));
  }


  /**
   * Hiển thị thông báo trạng thái hệ thống (Toast Notification)
   */
  showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    // Log ghi nhận hoạt động hệ thống
    console.log(`[SYSTEM LOG - ${type.toUpperCase()}]: ${message}`);
  }


  /**
   * Xử lý yêu cầu thêm sản phẩm vào giỏ hàng
   */
  addToCart(productId: string, qty: number, name: string, variantId: string | null = null, variantLabel: string = '') {
    return this.http.post(`${this.baseUrl}/carts/add`, {
      productId,
      quantity: qty,
      variantId,
      variantLabel
    });
  }


  // ==========================================
  // 5. PHÂN HỆ: QUẢN LÝ ĐÁNH GIÁ (REVIEWS)
  // ==========================================

  /**
   * ADMIN: Lấy danh sách tất cả đánh giá
   */
  getAllReviews(params: {
    page?: number;
    limit?: number;
    search?: string;
    hasReply?: string;
    /** Lọc đúng một đánh giá (từ thông báo admin). */
    reviewId?: string;
    /** Lọc theo sản phẩm (productId lưu dạng string trong Review). */
    productId?: string;
  }): Observable<any> {
    let query = `?page=${params.page || 1}&limit=${params.limit || 20}`;
    if (params.search) query += `&search=${encodeURIComponent(params.search)}`;
    if (params.hasReply && params.hasReply !== 'all') query += `&hasReply=${params.hasReply}`;
    if (params.reviewId) query += `&reviewId=${encodeURIComponent(params.reviewId)}`;
    if (params.productId) query += `&productId=${encodeURIComponent(params.productId)}`;
    return this.http.get(`${this.baseUrl}/reviews/admin/all${query}`);
  }

  /**
   * ADMIN: Trả lời đánh giá
   */
  replyReview(reviewId: string, replyText: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/reviews/${reviewId}/admin-reply`, { replyText });
  }

  /**
   * ADMIN: Xóa đánh giá
   */
  deleteReview(reviewId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/reviews/${reviewId}/admin-delete`);
  }

  /**
   * ADMIN: Xóa phản hồi đánh giá
   */
  deleteReply(reviewId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/reviews/${reviewId}/admin-reply`);
  }

  /**
   * Lấy đánh giá theo sản phẩm (cho admin xem chi tiết)
   */
  getReviewsByProduct(productId: string, params?: any): Observable<any> {
    return this.http.get(`${this.baseUrl}/reviews/product/${productId}`, { params });
  }
}