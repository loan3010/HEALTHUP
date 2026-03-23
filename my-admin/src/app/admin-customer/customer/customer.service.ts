import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CustomerItem {
  id: string;
  customerID: string;
  username: string;
  phone: string;
  email: string;
  address: string;
  membershipTier: 'Đồng' | 'Bạc' | 'Vàng' | 'Kim Cương';
  isActive: boolean;
  /** Có giá trị khi tài khoản đang khóa — khách thấy khi đăng nhập */
  deactivationReason?: string;
  /** Admin thực hiện khóa (tên hoặc email). */
  deactivatedBy?: string;
  /** ISO string — thời điểm khóa. */
  deactivatedAt?: string | null;
  createdAt: string;
  totalOrders: number;
  totalSpent: number;
  /** true: có đơn đã giao đang yêu cầu/chấp nhận hoàn — tổng tiền & hạng đang tính tạm. */
  hasProvisionalSpend?: boolean;
}

export interface CustomerListResponse {
  data:       CustomerItem[];
  total:      number;
  page:       number;
  totalPages: number;
}

/** Một dòng trong User.addresses (sổ địa chỉ). */
export interface CustomerSavedAddress {
  _id: string;
  name: string;
  phone: string;
  /** Chuỗi đầy đủ: số nhà + phường + quận + tỉnh (như checkout). */
  address: string;
  isDefault?: boolean;
  /** true khi dòng được ghép từ đơn hàng (không có trong mảng User.addresses). */
  fromOrder?: boolean;
  orderCode?: string;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  // Dùng URL tuyệt đối để luôn gọi đúng backend thật trên cổng 3000.
  // Tránh lệ thuộc vào proxy vì project hiện chưa cấu hình proxy.
  private readonly BASE = 'http://localhost:3000/api/admin/customers';

  constructor(private http: HttpClient) {}

  getAll(params: {
    search?:   string;
    page?:     number;
    limit?:    number;
    tier?:     string;
    isActive?: boolean;
    /** Trường sắp xếp (backend hỗ trợ) */
    sortBy?:   string;
    /** asc | desc */
    sortDir?:  string;
  }): Observable<CustomerListResponse> {
    let p = new HttpParams()
      .set('page',  String(params.page  ?? 1))
      .set('limit', String(params.limit ?? 10));

    if (params.search)             p = p.set('search',   params.search);
    if (params.tier)               p = p.set('tier',     params.tier);
    if (params.isActive !== undefined) p = p.set('isActive', String(params.isActive));
    if (params.sortBy)             p = p.set('sortBy',   params.sortBy);
    if (params.sortDir)             p = p.set('sortDir',  params.sortDir);

    return this.http.get<CustomerListResponse>(this.BASE, { params: p });
  }

  getById(id: string): Observable<CustomerItem> {
    return this.http.get<CustomerItem>(`${this.BASE}/${id}`);
  }

  /** Sổ địa chỉ của khách (admin — không cần JWT user). */
  getAddresses(userId: string): Observable<{ addresses: CustomerSavedAddress[] }> {
    return this.http.get<{ addresses: CustomerSavedAddress[] }>(`${this.BASE}/${userId}/addresses`);
  }

  update(id: string, data: Partial<CustomerItem>): Observable<{ message: string; user: CustomerItem }> {
    return this.http.put<{ message: string; user: CustomerItem }>(`${this.BASE}/${id}`, data);
  }

  /**
   * Khóa: gửi reason (bắt buộc) + tùy chọn performedBy (tên/email admin).
   * Mở khóa: {} — API đảo trạng thái.
   */
  toggleActive(
    id: string,
    body: Record<string, string> = {}
  ): Observable<{
    message: string;
    isActive: boolean;
    deactivationReason?: string;
    deactivatedBy?: string;
    deactivatedAt?: string | null;
  }> {
    return this.http.patch<{
      message: string;
      isActive: boolean;
      deactivationReason?: string;
      deactivatedBy?: string;
      deactivatedAt?: string | null;
    }>(`${this.BASE}/${id}/toggle-active`, body);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.BASE}/${id}`);
  }
}