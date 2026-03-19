import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

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
  private apiUrl  = 'http://localhost:3000/api/products';
  private baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  search(keyword: string): Observable<SearchProduct[]> {
    if (!keyword || keyword.trim().length < 1) {
      return of([]);
    }

    const params = new HttpParams()
      .set('search', keyword.trim())
      .set('limit', '6');

    return this.http.get<any>(this.apiUrl, { params }).pipe(
      map(res => {
        // Backend luôn trả về { products: [...], total, page, totalPages }
        const products: any[] = Array.isArray(res) ? res : (res.products || []);

        return products.map(p => ({
          ...p,
          images: (p.images || []).map((img: string) => this.resolveImageUrl(img))
        }));
      }),
      catchError(err => {
        console.error('Search error:', err);
        return of([]);
      })
    );
  }

  resolveImageUrl(img: string): string {
    if (!img) return '';
    if (img.startsWith('http://') || img.startsWith('https://')) return img;
    return this.baseUrl + (img.startsWith('/') ? img : '/' + img);
  }
}