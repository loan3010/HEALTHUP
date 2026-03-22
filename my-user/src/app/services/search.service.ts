import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface SearchProduct {
  _id: string;
  name: string;
  cat: string;
  price: number;
  oldPrice?: number;
  images: string[];
  rating: number;
  badge?: string;
}

@Injectable({ providedIn: 'root' })
export class SearchService {

  // ✅ Cache: key = keyword lowercase, value = { data, timestamp }
  private cache = new Map<string, { data: SearchProduct[]; ts: number }>();
  private readonly CACHE_TTL = 30_000; // 30 giây

  constructor(private api: ApiService) {}

  search(keyword: string): Observable<SearchProduct[]> {
    const key = keyword.trim().toLowerCase();
    if (!key) return of([]);

    // ✅ Trả cache nếu còn hạn → 0ms, không gọi HTTP
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL) {
      return of(cached.data);
    }

    // ✅ Tái dùng api.getProducts thay vì gọi HTTP riêng
    // → cùng endpoint, cùng fixImages, không duplicate logic
    return this.api.getProducts({ search: key, limit: 6 }).pipe(
      map(res => res.products as SearchProduct[]),
      tap(results => {
        // Lưu cache sau khi nhận response
        this.cache.set(key, { data: results, ts: Date.now() });
      })
    );
  }

  clearCache(): void {
    this.cache.clear();
  }
}