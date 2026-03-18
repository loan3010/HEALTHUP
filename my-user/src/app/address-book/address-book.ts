import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

interface Address {
  id?: string;
  name: string;
  phone: string;
  address: string;
  isDefault: boolean;
  userId?: string;
}

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
  
  showModal = false;
  isEditMode = false;
  editingIndex = -1;
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  private API = 'http://localhost:3000/api';
  private userId: string = '';

  constructor(
    private http: HttpClient,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    // Lấy userId từ localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.userId = user.id;
      } catch (error) {
        console.error('Error parsing user:', error);
      }
    }

    // Khởi tạo form
    this.initForm();

    // Load địa chỉ của user
    this.loadAddresses();
  }

  initForm(): void {
    this.addressForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{9,11}$/)]],
      address: ['', [Validators.required, Validators.minLength(10)]],
      isDefault: [false]
    });
  }

  loadAddresses(): void {
    if (!this.userId) {
      console.error('No userId found');
      return;
    }

    const token = localStorage.getItem('token');

    this.http
      .get<Address[]>(`${this.API}/addresses?userId=${this.userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .subscribe({
        next: (res) => {
          this.addresses = res;
        },
        error: (err: HttpErrorResponse) => {
          console.error('Error loading addresses:', err);
          // Fallback to empty array if API fails
          this.addresses = [];
        }
      });
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.editingIndex = -1;
    this.addressForm.reset({ isDefault: false });
    this.successMessage = '';
    this.errorMessage = '';
    this.showModal = true;
  }

  openEditModal(index: number): void {
    this.isEditMode = true;
    this.editingIndex = index;
    const address = this.addresses[index];
    
    this.addressForm.patchValue({
      name: address.name,
      phone: address.phone,
      address: address.address,
      isDefault: address.isDefault
    });

    this.successMessage = '';
    this.errorMessage = '';
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.addressForm.reset();
    this.successMessage = '';
    this.errorMessage = '';
  }

  showError(fieldName: string): boolean {
    const field = this.addressForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  submitForm(): void {
    if (this.addressForm.invalid) {
      this.addressForm.markAllAsTouched();
      this.errorMessage = 'Vui lòng điền đầy đủ thông tin!';
      return;
    }

    if (this.isEditMode) {
      this.updateAddress();
    } else {
      this.addAddress();
    }
  }

  addAddress(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const token = localStorage.getItem('token');
    const newAddress: Address = {
      ...this.addressForm.value,
      userId: this.userId
    };

    this.http
      .post<Address>(`${this.API}/addresses`, newAddress, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          this.successMessage = 'Thêm địa chỉ thành công!';

          // Nếu set làm mặc định, bỏ default của các địa chỉ khác
          if (res.isDefault) {
            this.addresses.forEach(addr => addr.isDefault = false);
          }

          this.addresses.push(res);

          setTimeout(() => {
            this.closeModal();
          }, 1000);
        },
        error: (err: HttpErrorResponse) => {
          this.isLoading = false;
          this.errorMessage = err?.error?.message || 'Thêm địa chỉ thất bại!';
        }
      });
  }

  updateAddress(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const token = localStorage.getItem('token');
    const addressId = this.addresses[this.editingIndex].id;

    const updatedAddress: Address = {
      ...this.addressForm.value,
      userId: this.userId
    };

    this.http
      .put<Address>(`${this.API}/addresses/${addressId}`, updatedAddress, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          this.successMessage = 'Cập nhật địa chỉ thành công!';

          // Nếu set làm mặc định, bỏ default của các địa chỉ khác
          if (res.isDefault) {
            this.addresses.forEach(addr => addr.isDefault = false);
          }

          this.addresses[this.editingIndex] = res;

          setTimeout(() => {
            this.closeModal();
          }, 1000);
        },
        error: (err: HttpErrorResponse) => {
          this.isLoading = false;
          this.errorMessage = err?.error?.message || 'Cập nhật thất bại!';
        }
      });
  }

  deleteAddress(index: number): void {
    if (!confirm('Bạn có chắc muốn xóa địa chỉ này?')) {
      return;
    }

    const token = localStorage.getItem('token');
    const addressId = this.addresses[index].id;

    this.http
      .delete(`${this.API}/addresses/${addressId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .subscribe({
        next: () => {
          this.addresses.splice(index, 1);
        },
        error: (err: HttpErrorResponse) => {
          alert(err?.error?.message || 'Xóa địa chỉ thất bại!');
        }
      });
  }

  setDefault(index: number): void {
    const token = localStorage.getItem('token');
    const addressId = this.addresses[index].id;

    this.http
      .put(`${this.API}/addresses/${addressId}/set-default`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .subscribe({
        next: () => {
          // Bỏ default của tất cả các địa chỉ khác
          this.addresses.forEach(addr => addr.isDefault = false);
          // Set default cho địa chỉ được chọn
          this.addresses[index].isDefault = true;
        },
        error: (err: HttpErrorResponse) => {
          alert(err?.error?.message || 'Đặt mặc định thất bại!');
        }
      });
  }

}