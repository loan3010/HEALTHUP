import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';

interface WishlistItem {
  _id: string;
  name: string;
  price: number;
  oldPrice?: number;
  cat: string;
  images: string[];
  badge?: string;
}

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css',
})
export class Wishlist implements OnInit {

  wishlistItems: WishlistItem[] = [];
  sortBy: 'newest' | 'price-asc' | 'price-desc' = 'newest';
  isLoading = false;
  toastMessage = '';
  toastVisible = false;
  private toastTimer: any;

  private API = 'http://localhost:3000/api';
  private userId = '';
  private token = '';

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const userStr = localStorage.getItem('user');
    const token   = localStorage.getItem('token');

    if (!userStr || !token) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      const user   = JSON.parse(userStr);
      this.userId  = user.id;
      this.token   = token;
      this.loadWishlist();
    } catch {
      this.router.navigate(['/login']);
    }
  }

  get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
  }

  get sortedItems(): WishlistItem[] {
    const items = [...this.wishlistItems];
    switch (this.sortBy) {
      case 'price-asc':  return items.sort((a, b) => a.price - b.price);
      case 'price-desc': return items.sort((a, b) => b.price - a.price);
      default:           return items;
    }
  }

  loadWishlist(): void {
    this.isLoading = true;
    this.http.get<any>(`${this.API}/users/${this.userId}/wishlist`, {
      headers: this.headers
    }).subscribe({
      next: (res) => {
        this.wishlistItems = res.wishlist || [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.isLoading = false; }
    });
  }

  removeFromWishlist(productId: string): void {
    this.http.delete(`${this.API}/users/${this.userId}/wishlist/${productId}`, {
      headers: this.headers
    }).subscribe({
      next: () => {
        this.wishlistItems = this.wishlistItems.filter(i => i._id !== productId);
        this.showToast('Đã xóa khỏi yêu thích');
        this.cdr.detectChanges();
      }
    });
  }

  addToCart(product: WishlistItem): void {
    this.http.post(`${this.API}/carts`,
      { productId: product._id, quantity: 1 },
      { headers: this.headers }
    ).subscribe({
      next: () => this.showToast(`Đã thêm vào giỏ hàng!`),
      error: () => this.showToast('Thêm vào giỏ thất bại!')
    });
  }

  goToProduct(id: string): void {
    this.router.navigate(['/product-detail-page', id]);
  }

  getImage(item: WishlistItem): string {
    const img = item.images?.[0];
    if (!img) return '/assets/images/placeholder.png';
    if (img.startsWith('http')) return img;
    return `http://localhost:3000${img.startsWith('/') ? img : '/' + img}`;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency', currency: 'VND', maximumFractionDigits: 0
    }).format(price);
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