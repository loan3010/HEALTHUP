import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { VariantClassificationPersisted } from './variant-classification.models';

export const ADMIN_API_BASE = 'http://localhost:3000/api';
export const ADMIN_STATIC_BASE = 'http://localhost:3000';

export interface ProductVariant {
  _id?: string;
  label: string;
  /** Giá trị chiều 1 (VD: Dâu) — đồng bộ với label "A | B | C". */
  attr1Value?: string;
  /** Giá trị chiều 2 (VD: 200g). */
  attr2Value?: string;
  /** Chiều 3 (VD: hương vị). */
  attr3Value?: string;
  /** Chiều 4 (VD: size). */
  attr4Value?: string;
  image?: string;
  price: number;
  stock: number;
  oldPrice?: number;
  isActive?: boolean;
}

export interface ProductNutrition {
  name: string;
  value: string;
  percent: number;
}

/** Trọng lượng / đơn vị cũ (trang user chọn nút) — không có giá riêng từng dòng. */
export interface ProductWeightOption {
  label: string;
  outOfStock?: boolean;
}

export interface Product {
  _id?: string;
  sku?: string;
  name: string;
  cat: string;
  price: number;
  oldPrice?: number;
  stock: number;
  rating?: number;
  reviewCount?: number;
  sold?: number;
  images?: string[];
  shortDesc?: string;
  description?: string;
  badge?: 'new' | 'hot' | null;
  sale?: string;
  weight?: string;
  /** Dữ liệu cũ từ Mongo; khác `variants` (biến thể có giá + tồn riêng). */
  weights?: ProductWeightOption[];
  saving?: string;
  packagingTypes?: string[];
  /** Nhãn hiển thị chiều 1/2 trên trang khách (VD: "Hương vị", "Khối lượng"). */
  variantAttr1Name?: string;
  variantAttr2Name?: string;
  variantAttr3Name?: string;
  variantAttr4Name?: string;
  /** Tối đa 4 nhóm preset — khớp Mongo variantClassifications. */
  variantClassifications?: VariantClassificationPersisted[];
  /**
   * Kiểu định lượng biến thể — khớp Mongo (XOR g/kg vs ml/l).
   * none: không ép đơn vị; mass: chỉ g/kg; volume: chỉ ml/l.
   */
  variantQuantityKind?: 'none' | 'mass' | 'volume';
  variants?: ProductVariant[];
  nutrition?: ProductNutrition[];
  createdAt?: string;
  updatedAt?: string;           // ← thêm: timestamps: true trong Mongoose tự sinh
  isHidden?: boolean;
  isOutOfStock?: boolean;       // admin bật tay "Tạm hết hàng"
}

export interface ProductResponse {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private apiUrl = `${ADMIN_API_BASE}/products`;

  constructor(private http: HttpClient) {}

  /** Lấy danh sách sản phẩm — isAdmin=true để admin thấy cả sản phẩm ẩn */
  getProducts(
    page = 1,
    limit = 50,          // mặc định 50 theo yêu cầu
    cat = '',
    sort = '',
    minPrice?: number,
    maxPrice?: number,
    minRating?: number,
    isAdmin = false
  ): Observable<ProductResponse> {
    let params = new HttpParams()
      .set('page', page)
      .set('limit', limit);
    if (cat)            params = params.set('cat', cat);
    if (sort)           params = params.set('sort', sort);
    if (minPrice != null) params = params.set('minPrice', minPrice);
    if (maxPrice != null) params = params.set('maxPrice', maxPrice);
    if (minRating != null) params = params.set('minRating', minRating);
    if (isAdmin)        params = params.set('isAdmin', 'true');
    return this.http.get<ProductResponse>(this.apiUrl, { params });
  }

  getById(id: string, isAdmin = false): Observable<Product> {
    const params = isAdmin ? new HttpParams().set('isAdmin', 'true') : new HttpParams();
    return this.http.get<Product>(`${this.apiUrl}/${id}`, { params });
  }

  create(product: Product): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, product);
  }

  update(id: string, product: Product): Observable<Product> {
    return this.http.put<Product>(`${this.apiUrl}/${id}`, product);
  }

  delete(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  /** Ẩn / hiện sản phẩm (toggle) — chỉ admin dùng */
  toggleHidden(id: string): Observable<{ isHidden: boolean; message: string }> {
    return this.http.patch<{ isHidden: boolean; message: string }>(
      `${this.apiUrl}/${id}/toggle-hidden`, {}
    );
  }
  toggleOutOfStock(id: string): Observable<{ isOutOfStock: boolean; message: string }> {
    return this.http.patch<{ isOutOfStock: boolean; message: string }>(
      `${this.apiUrl}/${id}/toggle-outofstock`, {}
    );
  }
}