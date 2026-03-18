import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Product {
  _id?: string;
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
  saving?: string;
  packagingTypes?: string[];
  createdAt?: string;
  status?: 'active' | 'outofstock' | 'suspended';
}

export interface ProductResponse {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private apiUrl = 'http://localhost:3000/api/products';

  constructor(private http: HttpClient) {}

  getProducts(
    page = 1,
    limit = 10,
    cat = '',
    sort = '',
    minPrice?: number,
    maxPrice?: number,
    minRating?: number
  ): Observable<ProductResponse> {
    let params = new HttpParams()
      .set('page', page)
      .set('limit', limit);
    if (cat) params = params.set('cat', cat);
    if (sort) params = params.set('sort', sort);
    if (minPrice != null) params = params.set('minPrice', minPrice);
    if (maxPrice != null) params = params.set('maxPrice', maxPrice);
    if (minRating != null) params = params.set('minRating', minRating);
    return this.http.get<ProductResponse>(this.apiUrl, { params });
  }

  getById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`);
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
}