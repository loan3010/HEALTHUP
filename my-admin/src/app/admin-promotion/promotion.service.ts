import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PromotionService {
  private apiNguon = 'http://localhost:3000/api/promotions';

  constructor(private http: HttpClient) { }

  // --- QUẢN LÝ KHUYẾN MÃI ---

  layDanhSach(): Observable<any[]> {
    return this.http.get<any[]>(this.apiNguon);
  }

  themKhuyenMai(duLieu: any): Observable<any> {
    return this.http.post(this.apiNguon, duLieu);
  }

  suaKhuyenMai(id: string, duLieu: any): Observable<any> {
    return this.http.put(`${this.apiNguon}/${id}`, duLieu);
  }

  xoaKhuyenMai(id: string): Observable<any> {
    return this.http.delete(`${this.apiNguon}/${id}`);
  }

  /**
   * Cập nhật tên nhóm cho hàng loạt khuyến mãi cùng lúc
   * @param ids Mảng các ID khuyến mãi cần gom nhóm
   * @param groupName Tên nhóm muốn đặt (để trống nếu muốn xóa khỏi nhóm)
   */
  nhomKhuyenMai(ids: string[], groupName: string): Observable<any> {
    // Gọi đến API bulk-group để xử lý cập nhật mảng ID cho nhanh
    return this.http.put(`${this.apiNguon}/bulk-group`, { ids, groupName });
  }

  // --- DỮ LIỆU PHỤ HỖ TRỢ CHỌN PHẠM VI ÁP DỤNG ---

  layDanhSachDanhMuc(): Observable<any[]> {
    return this.http.get<any[]>('http://localhost:3000/api/categories');
  }

  layDanhSachSanPham(limit: number = 1000): Observable<any> {
    return this.http.get<any>(`http://localhost:3000/api/products?limit=${limit}`);
  }
}