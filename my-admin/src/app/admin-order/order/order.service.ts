import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type AdminOrderStatus = 'pending' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled';
export type AdminReturnStatus = 'none' | 'requested' | 'completed';

export interface AdminOrderItem {
  _id: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl: string | null;
  variantLabel: string;
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
  returnStatus: AdminReturnStatus;
  returnReason?: string;
  subTotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  createdAt: string;
  customerSummary?: {
    customerID?: string;
    membershipTier?: string;
    totalOrders?: number;
    totalSpent?: number;
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
    returnCompletedCount: number;
  };
}

@Injectable({ providedIn: 'root' })
export class AdminOrderService {
  private readonly BASE = 'http://localhost:3000/api/orders/admin';

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

    return this.http.get<AdminOrderListResponse>(`${this.BASE}/list`, { params: p, headers: this.authHeader() });
  }

  getById(orderId: string): Observable<AdminOrder> {
    return this.http.get<AdminOrder>(`${this.BASE}/${orderId}`, { headers: this.authHeader() });
  }

  updateStatus(orderId: string, status: AdminOrderStatus, note = ''): Observable<AdminOrder> {
    return this.http.patch<AdminOrder>(
      `${this.BASE}/${orderId}/status`,
      { status, note },
      { headers: this.authHeader() }
    );
  }

  updateReturnStatus(orderId: string, returnStatus: AdminReturnStatus, note = '', returnReason = ''): Observable<AdminOrder> {
    return this.http.patch<AdminOrder>(
      `${this.BASE}/${orderId}/return-status`,
      { returnStatus, note, returnReason },
      { headers: this.authHeader() }
    );
  }

  getProductsForOrder(limit = 100): Observable<any[]> {
    return this.http
      .get<any>(`http://localhost:3000/api/products?limit=${limit}`)
      .pipe(map(res => Array.isArray(res?.products) ? res.products : []));
  }

  createHotlineOrder(payload: {
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
    voucherCode?: string;
    userId?: string;
  }): Observable<{ orderId: string; orderCode?: string }> {
    return this.http.post<{ orderId: string; orderCode?: string }>(
      'http://localhost:3000/api/orders',
      payload
    );
  }

  private authHeader() {
    const token = localStorage.getItem('admin_token') || '';
    return { Authorization: `Bearer ${token}` };
  }
}
