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
        this.userId = user.id || user._id || '';
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

    // Cập nhật preview khi form thay đổi
    this.addressForm.valueChanges.subscribe(() => this.updatePreview());
  }

  // ── Load tỉnh/thành ──
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
    this.addressForm.patchValue({ district: '', ward: '', street: '' });

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
    this.addressForm.patchValue({ ward: '', street: '' });

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

  // ── Load địa chỉ user ──
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
    this.isEditMode  = false;
    this.editingIndex = -1;
    this.districts   = [];
    this.wards       = [];
    this.fullAddressPreview = '';
    this.addressForm.reset({ isDefault: false });
    this.successMessage = '';
    this.errorMessage   = '';
    this.showModal = true;
  }

  openEditModal(index: number): void {
    this.isEditMode   = true;
    this.editingIndex = index;
    this.successMessage = '';
    this.errorMessage   = '';

    // Địa chỉ cũ lưu dạng string → hiện vào street, reset phần chọn tỉnh
    this.districts = [];
    this.wards     = [];
    this.fullAddressPreview = this.addresses[index].address;
    this.addressForm.reset({
      name:      this.addresses[index].name,
      phone:     this.addresses[index].phone,
      province:  '',
      district:  '',
      ward:      '',
      street:    this.addresses[index].address,
      isDefault: this.addresses[index].isDefault
    });
    this.showModal = true;
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
    this.isLoading   = true;
    this.errorMessage = '';
    const body = {
      name:      this.addressForm.value.name,
      phone:     this.addressForm.value.phone,
      address:   this.getFullAddress(),
      isDefault: this.addressForm.value.isDefault,
      userId:    this.userId
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
          this.isLoading   = false;
          this.errorMessage = err?.error?.message || 'Thêm địa chỉ thất bại!';
        }
      });
  }

  updateAddress(): void {
    this.isLoading   = true;
    this.errorMessage = '';
    const id   = this.getId(this.addresses[this.editingIndex]);
    const body = {
      name:      this.addressForm.value.name,
      phone:     this.addressForm.value.phone,
      address:   this.getFullAddress() || this.addressForm.value.street,
      isDefault: this.addressForm.value.isDefault,
      userId:    this.userId
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
          this.isLoading   = false;
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