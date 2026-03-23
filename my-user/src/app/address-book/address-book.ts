import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';

interface Address {
  _id?: string;
  id?: string;
  name: string;
  phone: string;
  address: string;
  street?: string;
  wardName?: string;
  wardCode?: number;
  districtName?: string;
  districtCode?: number;
  provinceName?: string;
  provinceCode?: number;
  isDefault: boolean;
}

interface Province { code: number; name: string; }
interface District { code: number; name: string; }
interface Ward     { code: number; name: string; }

@Component({
  selector: 'app-address-book',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './address-book.html',
  styleUrl: './address-book.css'
})
export class AddressBook implements OnInit {

  addresses: Address[] = [];
  addressForm!: FormGroup;

  showModal    = false;
  isEditMode   = false;
  editingIndex = -1;
  isLoading     = false;
  isPageLoading = false;
  successMessage = '';
  errorMessage   = '';
  toastMessage   = '';
  toastVisible   = false;
  private toastTimer: any;

  // ── Địa chỉ hành chính ──
  provinces: Province[] = [];
  districts: District[] = [];
  wards:     Ward[]     = [];

  loadingProvinces = false;
  loadingDistricts = false;
  loadingWards     = false;

  fullAddressPreview = '';

  private GEO_API = 'https://provinces.open-api.vn/api';
  private API      = 'http://localhost:3000/api';
  private userId   = '';
  private token    = '';

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const userStr = localStorage.getItem('user');
    const token   = localStorage.getItem('token');
    if (userStr && token) {
      try {
        const user = JSON.parse(userStr);
        // Khớp checkout: một số phiên bản lưu _id thay vì id.
        // Ưu tiên decode từ JWT để tránh lệch localStorage (gây 403 ở backend).
        const fromToken = this.decodeUserIdFromToken(token);
        this.userId = fromToken || user.id || user._id || '';
        this.token = token;
      } catch {}
    }
    this.initForm();
    this.loadProvinces();
    this.loadAddresses();
  }

  get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
  }

  /**
   * Decode JWT (payload) để lấy userId.
   * Lý do: localStorage('userId') / localStorage('user') có thể bị lệch so với token,
   * dẫn đến 403 khi gọi GET /api/users/:id/addresses.
   */
  private decodeUserIdFromToken(token: string): string {
    if (!token) return '';
    try {
      const parts = String(token).split('.');
      if (parts.length < 2) return '';
      const payloadB64 = parts[1];
      const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
      const decodedStr = globalThis.atob(padded);
      const decoded = JSON.parse(decodedStr) as any;
      const uid = decoded?.userId ?? decoded?.id ?? decoded?._id;
      return uid != null ? String(uid) : '';
    } catch {
      return '';
    }
  }

  initForm(): void {
    this.addressForm = this.fb.group({
      name:      ['', [Validators.required, Validators.minLength(2)]],
      phone:     ['', [Validators.required, Validators.pattern(/^[0-9]{9,11}$/)]],
      province:  ['', Validators.required],
      district:  ['', Validators.required],
      ward:      ['', Validators.required],
      street:    ['', Validators.required],
      isDefault: [false]
    });

    this.addressForm.valueChanges.subscribe(() => this.updatePreview());
  }

  loadProvinces(): void {
    this.loadingProvinces = true;
    this.http.get<Province[]>(`${this.GEO_API}/?depth=1`).subscribe({
      next: (data) => {
        this.provinces = data;
        this.loadingProvinces = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingProvinces = false; }
    });
  }

  onProvinceChange(): void {
    const code = this.addressForm.get('province')?.value;
    this.districts = [];
    this.wards     = [];
    this.addressForm.patchValue({ district: '', ward: '' }, { emitEvent: false });

    if (!code) return;
    this.loadingDistricts = true;
    this.http.get<any>(`${this.GEO_API}/p/${code}?depth=2`).subscribe({
      next: (data) => {
        this.districts = data.districts || [];
        this.loadingDistricts = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingDistricts = false; }
    });
  }

  onDistrictChange(): void {
    const code = this.addressForm.get('district')?.value;
    this.wards = [];
    this.addressForm.patchValue({ ward: '' }, { emitEvent: false });

    if (!code) return;
    this.loadingWards = true;
    this.http.get<any>(`${this.GEO_API}/d/${code}?depth=2`).subscribe({
      next: (data) => {
        this.wards = data.wards || [];
        this.loadingWards = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingWards = false; }
    });
  }

  onWardChange(): void {
    this.updatePreview();
  }

  updatePreview(): void {
    const v = this.addressForm.value;
    const provinceName = this.provinces.find(p => p.code == v.province)?.name || '';
    const districtName = this.districts.find(d => d.code == v.district)?.name || '';
    const wardName     = this.wards.find(w => w.code == v.ward)?.name || '';
    const parts = [v.street, wardName, districtName, provinceName].filter(Boolean);
    this.fullAddressPreview = parts.join(', ');
  }

  getFullAddress(): string {
    return this.fullAddressPreview;
  }

  loadAddresses(): void {
    if (!this.userId) return;
    this.isPageLoading = true;
    this.http.get<any>(`${this.API}/users/${this.userId}/addresses`, { headers: this.headers })
      .subscribe({
        next: (res) => {
          this.addresses = res.addresses || res || [];
          this.isPageLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.addresses = [];
          this.isPageLoading = false;
        }
      });
  }

  getInitial(name: string): string {
    return (name || 'U').charAt(0).toUpperCase();
  }

  getId(item: Address): string {
    return (item._id || item.id || '') as string;
  }

  openAddModal(): void {
    this.isEditMode   = false;
    this.editingIndex = -1;
    this.districts    = [];
    this.wards        = [];
    this.fullAddressPreview = '';
    this.addressForm.reset({ isDefault: false });
    this.successMessage = '';
    this.errorMessage   = '';
    this.showModal = true;
  }

  // ✅ FIX: Load tỉnh/huyện/xã đúng thứ tự, hỗ trợ cả data cũ (chỉ có string) và data mới (có code)
  openEditModal(index: number): void {
    this.isEditMode     = true;
    this.editingIndex   = index;
    this.successMessage = '';
    this.errorMessage   = '';
    this.districts      = [];
    this.wards          = [];

    const a = this.addresses[index];

    // Tách street: chỉ lấy phần không phải tỉnh/huyện/xã
    const allParts = a.address.split(',').map((p: string) => p.trim()).filter(Boolean);
    const geoKeywords = ['tỉnh', 'thành phố', 'tp.', 'huyện', 'quận', 'thị xã', 'tx.', 'xã', 'phường', 'thị trấn', 'tt.'];
    const isGeoPart = (p: string) => geoKeywords.some(k => p.toLowerCase().startsWith(k));
    const streetOnly = a.street || allParts.filter(p => !isGeoPart(p)).join(', ') || a.address;

    this.fullAddressPreview = a.address;

    this.addressForm.reset({
      name:      a.name,
      phone:     a.phone,
      province:  '',
      district:  '',
      ward:      '',
      street:    streetOnly,
      isDefault: a.isDefault,
    });

    this.showModal = true;
    this.cdr.detectChanges();

    // Parse tên tỉnh/huyện/xã bằng keyword để tránh lệch index
    const parts = allParts;
    const provinceKeywords = ['tỉnh', 'thành phố', 'tp.'];
    const districtKeywords = ['huyện', 'quận', 'thị xã', 'tx.'];
    const wardKeywords     = ['xã', 'phường', 'thị trấn', 'tt.'];
    const findPart = (keywords: string[]) =>
      parts.find(p => keywords.some(k => p.toLowerCase().startsWith(k))) || '';

    const provinceName = a.provinceName || findPart(provinceKeywords);
    const districtName = a.districtName || findPart(districtKeywords);
    const wardName     = a.wardName     || findPart(wardKeywords);

    const fuzzy = (x: string, y: string) =>
      x.toLowerCase().includes(y.toLowerCase()) || y.toLowerCase().includes(x.toLowerCase());

    const doMatch = () => {
      // Ưu tiên dùng code nếu có, không thì fuzzy match theo tên
      const province = a.provinceCode
        ? this.provinces.find(p => p.code === a.provinceCode)
        : this.provinces.find(p => fuzzy(p.name, provinceName));

      if (!province) return;

      this.loadingDistricts = true;
      this.cdr.detectChanges();

      this.http.get<any>(`${this.GEO_API}/p/${province.code}?depth=2`).subscribe({
        next: (d) => {
          this.districts = d.districts || [];
          this.loadingDistricts = false;

          // Patch province SAU khi districts đã có
          this.addressForm.patchValue({ province: province.code }, { emitEvent: false });

          const district = a.districtCode
            ? this.districts.find(d => d.code === a.districtCode)
            : this.districts.find(d => fuzzy(d.name, districtName));

          if (!district) { this.cdr.detectChanges(); return; }

          this.loadingWards = true;
          this.cdr.detectChanges();

          this.http.get<any>(`${this.GEO_API}/d/${district.code}?depth=2`).subscribe({
            next: (dw) => {
              this.wards = dw.wards || [];
              this.loadingWards = false;

              const ward = a.wardCode
                ? this.wards.find(w => w.code === a.wardCode)
                : this.wards.find(w => fuzzy(w.name, wardName));

              // Patch district + ward SAU khi wards đã có
              this.addressForm.patchValue({
                district: district.code,
                ward:     ward?.code || '',
              }, { emitEvent: false });

              this.updatePreview();
              this.cdr.detectChanges();
            },
            error: () => { this.loadingWards = false; this.cdr.detectChanges(); }
          });
        },
        error: () => { this.loadingDistricts = false; this.cdr.detectChanges(); }
      });
    };

    // Nếu provinces chưa load thì load trước
    if (!this.provinces.length) {
      this.loadingProvinces = true;
      this.cdr.detectChanges();
      this.http.get<Province[]>(`${this.GEO_API}/?depth=1`).subscribe({
        next: (d) => {
          this.provinces = d;
          this.loadingProvinces = false;
          this.cdr.detectChanges();
          doMatch();
        },
        error: () => { this.loadingProvinces = false; }
      });
    } else {
      doMatch();
    }
  }

  closeModal(): void {
    this.showModal = false;
    this.addressForm.reset();
    this.fullAddressPreview = '';
    this.successMessage = '';
    this.errorMessage   = '';
  }

  showError(field: string): boolean {
    const f = this.addressForm.get(field);
    return !!(f && f.invalid && (f.dirty || f.touched));
  }

  submitForm(): void {
    if (this.addressForm.invalid) {
      this.addressForm.markAllAsTouched();
      this.errorMessage = 'Vui lòng điền đầy đủ thông tin!';
      return;
    }
    this.isEditMode ? this.updateAddress() : this.addAddress();
  }

  addAddress(): void {
    this.isLoading    = true;
    this.errorMessage = '';
    const v = this.addressForm.value;

    const provinceName = this.provinces.find(p => p.code == v.province)?.name || '';
    const districtName = this.districts.find(d => d.code == v.district)?.name || '';
    const wardName     = this.wards.find(w => w.code == v.ward)?.name || '';

    const body = {
      name:         v.name,
      phone:        v.phone,
      address:      this.getFullAddress(),
      street:       v.street       || '',
      wardName,
      wardCode:     v.ward         || null,
      districtName,
      districtCode: v.district     || null,
      provinceName,
      provinceCode: v.province     || null,
      isDefault:    v.isDefault,
      userId:       this.userId,
    };

    this.http.post<any>(`${this.API}/users/${this.userId}/addresses`, body, { headers: this.headers })
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.address?.isDefault) this.addresses.forEach(a => a.isDefault = false);
          this.addresses.push(res.address);
          this.closeModal();
          this.showToast('Đã thêm địa chỉ mới!');
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.isLoading    = false;
          this.errorMessage = err?.error?.message || 'Thêm địa chỉ thất bại!';
        }
      });
  }

  updateAddress(): void {
    this.isLoading    = true;
    this.errorMessage = '';
    const id  = this.getId(this.addresses[this.editingIndex]);
    const old = this.addresses[this.editingIndex];
    const v   = this.addressForm.value;

    const provinceName = this.provinces.find(p => p.code == v.province)?.name || old.provinceName || '';
    const districtName = this.districts.find(d => d.code == v.district)?.name || old.districtName || '';
    const wardName     = this.wards.find(w => w.code == v.ward)?.name         || old.wardName     || '';

    const body = {
      name:         v.name,
      phone:        v.phone,
      address:      this.getFullAddress() || v.street,
      street:       v.street       || old.street       || '',
      wardName,
      wardCode:     v.ward         || old.wardCode      || null,
      districtName,
      districtCode: v.district     || old.districtCode  || null,
      provinceName,
      provinceCode: v.province     || old.provinceCode  || null,
      isDefault:    v.isDefault,
      userId:       this.userId,
    };

    this.http.put<any>(`${this.API}/users/${this.userId}/addresses/${id}`, body, { headers: this.headers })
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.address?.isDefault) this.addresses.forEach(a => a.isDefault = false);
          this.addresses[this.editingIndex] = res.address;
          this.closeModal();
          this.showToast('Đã cập nhật địa chỉ!');
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.isLoading    = false;
          this.errorMessage = err?.error?.message || 'Cập nhật thất bại!';
        }
      });
  }

  deleteAddress(index: number): void {
    if (!confirm('Bạn có chắc muốn xóa địa chỉ này?')) return;
    const id = this.getId(this.addresses[index]);

    this.http.delete(`${this.API}/users/${this.userId}/addresses/${id}`, { headers: this.headers })
      .subscribe({
        next: () => {
          this.addresses.splice(index, 1);
          this.showToast('Đã xóa địa chỉ');
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          alert(err?.error?.message || 'Xóa thất bại!');
        }
      });
  }

  setDefault(index: number): void {
    const id = this.getId(this.addresses[index]);

    this.http.put(`${this.API}/users/${this.userId}/addresses/${id}/set-default`, {}, { headers: this.headers })
      .subscribe({
        next: () => {
          this.addresses.forEach(a => a.isDefault = false);
          this.addresses[index].isDefault = true;
          this.showToast('Đã đặt làm địa chỉ mặc định');
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          alert(err?.error?.message || 'Đặt mặc định thất bại!');
        }
      });
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastVisible = false;
      this.cdr.detectChanges();
    }, 2500);
  }
}