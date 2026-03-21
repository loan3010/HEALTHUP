import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type DashboardPreset = 'today' | '7days' | 'month' | 'custom';

export interface PiePoint {
  label: string;
  value: number;
}

export interface TopProductItem {
  productId: string;
  name: string;
  category: string;
  variantLabel: string;
  quantity: number;
  revenue: number;
}

export interface DashboardResponse {
  filter: {
    preset: DashboardPreset;
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
  };
  kpis: {
    revenue: number;
    orders: number;
    newCustomers: number;
    products: number;
  };
  kpiChangeVsYesterday: {
    revenue: number;
    orders: number;
    newCustomers: number;
    products: number;
  };
  revenueLine: { labels: string[]; current: Array<number | null>; previous: Array<number | null> };
  ordersBar: { labels: string[]; values: number[] };
  newCustomersBar: { labels: string[]; values: number[] };
  orderStatusPie: PiePoint[];
  promotionPie: PiePoint[];
  customerTierPie: PiePoint[];
  recentOrders: Array<{
    orderId: string;
    customerName: string;
    total: number;
    status: string;
    createdAt: string;
  }>;
  topProducts: {
    bestSelling: TopProductItem[];
    slowSelling: TopProductItem[];
  };
}

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly apiUrl = 'http://localhost:3000/api/admin/dashboard';

  constructor(private http: HttpClient) {}

  getDashboard(params: { preset: DashboardPreset; from?: string; to?: string }): Observable<DashboardResponse> {
    let httpParams = new HttpParams().set('preset', params.preset);
    if (params.preset === 'custom') {
      httpParams = httpParams.set('from', params.from || '').set('to', params.to || '');
    }
    return this.http.get<DashboardResponse>(this.apiUrl, { params: httpParams });
  }

  exportDashboard(params: { preset: DashboardPreset; from?: string; to?: string }): Observable<Blob> {
    let httpParams = new HttpParams().set('preset', params.preset);
    if (params.preset === 'custom') {
      httpParams = httpParams.set('from', params.from || '').set('to', params.to || '');
    }
    return this.http.get(`${this.apiUrl}/export`, { params: httpParams, responseType: 'blob' });
  }
}
