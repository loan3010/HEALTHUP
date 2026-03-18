// import { Injectable } from '@angular/core';
// import { HttpClient, HttpParams } from '@angular/common/http';
// import { Observable, of } from 'rxjs';
// import { map, catchError } from 'rxjs/operators';

// export interface SearchProduct {
//   _id: string;
//   name: string;
//   cat: string;
//   price: number;
//   oldPrice?: number;
//   images: string[];
//   rating: number;
//   badge?: string;
// }

// @Injectable({ providedIn: 'root' })
// export class SearchService {
//   private apiUrl  = 'http://localhost:3000/api/products';
//   // Base URL để ghép với path ảnh "/images/products/..."
//   private baseUrl = 'http://localhost:3000';

//   constructor(private http: HttpClient) {}

//   /**
//    * Tìm kiếm sản phẩm — trả về Observable<SearchProduct[]>
//    * header.ts tự pipe debounce + switchMap bên ngoài
//    */
//   search(keyword: string): Observable<SearchProduct[]> {
//     if (!keyword || keyword.trim().length < 1) {
//       return of([]);
//     }

//     const params = new HttpParams()
//       .set('search', keyword.trim())
//       .set('limit', '6');

//     // FIX LOADING LOOP: Bỏ switchMap lồng bên trong — chỉ dùng map
//     // switchMap trong service + switchMap trong header gây stream không complete
//     // return this.http.get<any>(this.apiUrl, { params }).pipe(
//     //   map(res => {
//     //     const raw: any[] = Array.isArray(res) ? res : (res.products || []);
//     //     const filtered   = this.fuzzyFilter(raw, keyword.trim());
//     //     // FIX ẢNH: Ghép base URL vào path ảnh từ MongoDB
//     //     return filtered.map(p => ({
//     //       ...p,
//     //       images: (p.images || []).map((img: string) => this.resolveImageUrl(img))
//     //     }));
//     //   }),
//     //   catchError(() => of([]))
//     // );
//     return this.http.get<any>(this.apiUrl, { params }).pipe(
//   map(res => {
//     const products: any[] = Array.isArray(res) ? res : (res.products || []);
    
//     // CHỈ fuzzyFilter nếu API không trả về kết quả
//     // nhưng có search param? Không nên, vì API đã filter rồi
    
//     // Cách tốt nhất: dùng luôn kết quả từ API
//     const limitedProducts = products.slice(0, 6);
    
//     return limitedProducts.map(p => ({
//       ...p,
//       images: (p.images || []).map((img: string) => this.resolveImageUrl(img))
//     }));
//   }),
//   catchError(() => of([]))
// );
//   }

//   /**
//    * Ghép base URL với path ảnh từ MongoDB
//    * "/images/products/abc.png" → "http://localhost:3000/images/products/abc.png"
//    * Nếu đã là full URL (http/https) thì giữ nguyên
//    */
//   resolveImageUrl(img: string): string {
//     if (!img) return '';
//     if (img.startsWith('http://') || img.startsWith('https://')) return img;
//     return this.baseUrl + (img.startsWith('/') ? img : '/' + img);
//   }

//   /**
//    * Fuzzy filter: bỏ dấu tiếng Việt, không phân biệt hoa thường
//    * "gran" → "Granola hạnh nhân" ✓
//    * "tra"  → "Trà thảo mộc" ✓
//    * "hat"  → "Hạt điều" ✓
//    */
//   private fuzzyFilter(products: any[], keyword: string): any[] {
//     const normalize = (str: string) =>
//       (str || '')
//         .toLowerCase()
//         .normalize('NFD')
//         .replace(/[\u0300-\u036f]/g, '')
//         .replace(/đ/g, 'd')
//         .replace(/[^a-z0-9\s]/g, '');

//     const q = normalize(keyword);
//     return products
//       .filter(p => normalize(p.name).includes(q) || normalize(p.cat || '').includes(q))
//       .slice(0, 6);
//   }
// }
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
        console.log('API Response:', res); // Debug
        
        // Lấy mảng sản phẩm từ response
        const products: any[] = Array.isArray(res) ? res : (res.products || []);
        console.log('Products from API:', products); // Debug
        
        // 🟢 QUAN TRỌNG: KHÔNG dùng fuzzyFilter, giữ nguyên kết quả từ API
        // API đã search theo keyword rồi, kết quả trả về là chính xác
        
        // Xử lý ảnh
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

  // 🟢 BỎ hoàn toàn hàm fuzzyFilter - không cần dùng nữa
  // private fuzzyFilter(...) { ... } // XÓA hàm này
}