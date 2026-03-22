import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

/** Một dòng địa giới từ open-api (code + name). */
export interface VnDivisionRow {
  code: string;
  name: string;
}

const BASE = 'http://localhost:3000/api/vn-address';

@Injectable({ providedIn: 'root' })
export class VnAddressService {
  constructor(private http: HttpClient) {}

  /** Chuẩn hóa JSON API (có thể là mảng hoặc { data: [] }). */
  private asRows(res: unknown): VnDivisionRow[] {
    const r = res as Record<string, unknown>;
    const raw = Array.isArray(res) ? res : r?.['data'];
    if (!Array.isArray(raw)) return [];
    return raw
      .map((x: Record<string, unknown>) => ({
        code: String(x?.['code'] ?? ''),
        name: String(x?.['name'] ?? ''),
      }))
      .filter((x) => x.code && x.name);
  }

  getProvinces(): Observable<VnDivisionRow[]> {
    return this.http.get<unknown>(`${BASE}/p`).pipe(map((res) => this.asRows(res)));
  }

  /** Tỉnh đã chọn + danh sách quận/huyện (depth=2). */
  getDistrictsByProvince(provinceCode: string): Observable<VnDivisionRow[]> {
    return this.http.get<unknown>(`${BASE}/p/${encodeURIComponent(provinceCode)}`).pipe(
      map((res) => {
        const r = res as Record<string, unknown>;
        const d = r?.['districts'];
        if (Array.isArray(d)) {
          return (d as Record<string, unknown>[])
            .map((x) => ({ code: String(x?.['code'] ?? ''), name: String(x?.['name'] ?? '') }))
            .filter((x) => x.code && x.name);
        }
        return this.asRows(res);
      })
    );
  }

  /** Quận/huyện đã chọn + phường/xã (depth=2). */
  getWardsByDistrict(districtCode: string): Observable<VnDivisionRow[]> {
    return this.http.get<unknown>(`${BASE}/d/${encodeURIComponent(districtCode)}`).pipe(
      map((res) => {
        const r = res as Record<string, unknown>;
        const w = r?.['wards'];
        if (Array.isArray(w)) {
          return (w as Record<string, unknown>[])
            .map((x) => ({ code: String(x?.['code'] ?? ''), name: String(x?.['name'] ?? '') }))
            .filter((x) => x.code && x.name);
        }
        return this.asRows(res);
      })
    );
  }
}
