import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

export type AdminOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipping'
  | 'delivery_failed'
  | 'delivered'
  | 'cancelled';

export type DeliveryFailurePreset =
  | 'no_contact'
  | 'wrong_address'
  | 'customer_refused'
  | 'reschedule'
  | 'other';
export type AdminReturnStatus = 'none' | 'requested' | 'approved' | 'rejected' | 'completed';

export interface AdminOrderItem {
  _id: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl: string | null;
  variantLabel: string;
}

/** Một dòng trong yêu cầu trả: quantity = SL đã mua trên đơn, returnQty = SL khách xin trả. */
export interface AdminReturnLine {
  productId?: string;
  name?: string;
  imageUrl?: string | null;
  price?: number;
  quantity?: number;
  returnQty?: number;
}

export interface AdminOrder {
  _id: string;
  orderCode?: string;
  userId?: string | null;
  customer: {
    fullName: string;
    phone: string;
    email: string;
    address: string;
    province: string;
    district: string;
    ward: string;
    note: string;
  };
  items: AdminOrderItem[];
  paymentMethod: 'cod' | 'momo' | 'vnpay';
  shippingMethod: 'standard' | 'express';
  status: AdminOrderStatus;
  /** Hoàn kho đã chạy (hủy đơn). */
  inventoryReleased?: boolean;
  refundStatus?: 'none' | 'pending' | 'completed';
  deliveryFailureReason?: string;
  deliveryFailurePreset?: string;
  redeliveryAttempts?: number;
  /** Lý do hủy — hiển thị cho khách (chi tiết đơn). */
  cancelReason?: string;
  returnStatus: AdminReturnStatus;
  returnReason?: string;
  returnRejectionReason?: string;
  returnNote?: string;
  returnImages?: string[];
  returnItems?: AdminReturnLine[];
  voucherCode?: string | null;
  shipVoucherCode?: string | null;
  subTotal: number;
  shippingFee: number;
  discount: number;
  discountOnItems: number;
  discountOnShipping: number;
  total: number;
  createdAt: string;
  /**
   * Tài khoản User đặt đơn (username + SĐT đăng ký). Khác `customer` (người nhận / địa chỉ giao).
   * null nếu guest hoặc không gắn userId / user đã xóa — khi đó UI fallback sang customer.
   */
  buyerAccount?: { username: string; phone: string; email: string } | null;
  customerSummary?: {
    customerID?: string;
    membershipTier?: string;
    totalOrders?: number;
    totalSpent?: number;
    hasProvisionalSpend?: boolean;
  };
}

export interface AdminOrderListResponse {
  data: AdminOrder[];
  total: number;
  page: number;
  totalPages: number;
  summary?: {
    totalOrders: number;
    pendingCount: number;
    shippingCount: number;
    returnRequestedCount: number;
    returnApprovedCount?: number;
    returnRejectedCount?: number;
    returnCompletedCount: number;
  };
}

/** Phản hồi xem trước tiền (admin hotline). */
export interface HotlineOrderPreview {
  subTotal: number;
  shippingFee: number;
  discount: number;
  discountOnItems: number;
  discountOnShipping: number;
  total: number;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    variantLabel: string;
    lineTotal: number;
  }>;
}

export interface HotlineOrderPayload {
  customer: {
    fullName: string;
    phone: string;
    email?: string;
    address: string;
    province: string;
    district: string;
    ward: string;
    note?: string;
  };
  items: Array<{ productId: string; quantity: number; variantId?: string; variantLabel?: string }>;
  shippingMethod: 'standard' | 'express';
  paymentMethod: 'cod' | 'momo' | 'vnpay';
  voucherCode?: string | null;
  shipVoucherCode?: string | null;
  userId?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminOrderService {
  /** Gốc /api/orders — các route admin là /admin/... */
  private readonly ORDERS = 'http://localhost:3000/api/orders';

  constructor(private http: HttpClient) {}

  getList(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    paymentMethod?: string;
    returnStatus?: string;
    from?: string;
    to?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }): Observable<AdminOrderListResponse> {
    let p = new HttpParams()
      .set('page', String(params.page ?? 1))
      .set('limit', String(params.limit ?? 50))
      .set('sortBy', params.sortBy || 'createdAt')
      .set('sortDir', params.sortDir || 'desc');

    if (params.search) p = p.set('search', params.search);
    if (params.status) p = p.set('status', params.status);
    if (params.paymentMethod) p = p.set('paymentMethod', params.paymentMethod);
    if (params.returnStatus) p = p.set('returnStatus', params.returnStatus);
    if (params.from) p = p.set('from', params.from);
    if (params.to) p = p.set('to', params.to);

    return this.http.get<AdminOrderListResponse>(`${this.ORDERS}/admin/list`, { params: p, headers: this.authHeader() });
  }

  getById(orderId: string): Observable<AdminOrder> {
    return this.http.get<AdminOrder>(`${this.ORDERS}/admin/${orderId}`, { headers: this.authHeader() });
  }

  updateStatus(
    orderId: string,
    status: AdminOrderStatus,
    note = '',
    delivery?: { preset: DeliveryFailurePreset; detail?: string },
    cancelReason?: string
  ): Observable<AdminOrder> {
    const body: Record<string, unknown> = { status, note };
    if (delivery) {
      body['deliveryFailurePreset'] = delivery.preset;
      if (delivery.detail != null && delivery.detail !== '') {
        body['deliveryFailureDetail'] = delivery.detail;
      }
    }
    // Hủy từ delivery_failed có thể gửi rỗng; hủy trước giao bắt buộc có nội dung (backend validate).
    if (status === 'cancelled') {
      body['cancelReason'] = cancelReason != null ? cancelReason : '';
    }
    return this.http.patch<AdminOrder>(`${this.ORDERS}/admin/${orderId}/status`, body, {
      headers: this.authHeader(),
    });
  }

  updateReturnStatus(
    orderId: string,
    returnStatus: AdminReturnStatus,
    note = '',
    returnReason = '',
    returnRejectionReason = ''
  ): Observable<AdminOrder> {
    return this.http.patch<AdminOrder>(
      `${this.ORDERS}/admin/${orderId}/return-status`,
      { returnStatus, note, returnReason, returnRejectionReason },
      { headers: this.authHeader() }
    );
  }

  /** Tìm SP theo tên (admin — gồm cả SP ẩn). */
  searchProductsForOrder(search: string, limit = 15): Observable<any[]> {
    const q = (search || '').trim();
    if (!q) return of([]);
    const params = new HttpParams().set('search', q).set('limit', String(limit)).set('isAdmin', 'true');
    return this.http
      .get<{ products?: any[] }>('http://localhost:3000/api/products', { params })
      .pipe(map((res) => (Array.isArray(res?.products) ? res.products : [])));
  }

  /** Xem trước tạm tính — cần JWT admin. */
  previewHotlineOrder(payload: HotlineOrderPayload): Observable<HotlineOrderPreview> {
    return this.http.post<HotlineOrderPreview>(`${this.ORDERS}/admin/hotline-preview`, payload, {
      headers: this.authHeader(),
    });
  }

  /** Tạo đơn hotline — cần JWT admin. */
  createAdminHotlineOrder(payload: HotlineOrderPayload): Observable<{ orderId: string; orderCode?: string }> {
    return this.http.post<{ orderId: string; orderCode?: string }>(`${this.ORDERS}/admin/hotline`, payload, {
      headers: this.authHeader(),
    });
  }

  private authHeader() {
    const token = localStorage.getItem('admin_token') || '';
    return { Authorization: `Bearer ${token}` };
  }
}