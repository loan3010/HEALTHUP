import {
  Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { TrackOrderModal } from '../track-order-modal/track-order-modal';
import { SearchService, SearchProduct } from '../services/search.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TrackOrderModal],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class Header implements OnInit, OnDestroy {

  isLoggedIn = false;
  userName = '';
  showDropdown = false;
  menuOpen = false;
  showTrackOrderModal = false;

  // ── SEARCH STATE ──
  searchQuery = '';
  searchResults: SearchProduct[] = [];
  isSearching = false;
  showSearchDropdown = false;
  activeIndex = -1;

  private searchSubject = new Subject<string>();
  private searchSub!: Subscription;

  @ViewChild('searchInput') searchInputRef!: ElementRef;

  constructor(
    private router: Router,
    private searchService: SearchService
  ) {}

  ngOnInit(): void {
    this.checkLoginStatus();
    this.initSearch();
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  initSearch(): void {
    this.searchSub = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(keyword => {
        if (!keyword.trim()) {
          this.isSearching = false;
          this.searchResults = [];
          this.showSearchDropdown = false;
          return of([] as SearchProduct[]);
        }
        this.isSearching = true;
        this.showSearchDropdown = true; // Mở ngay khi bắt đầu search
        return this.searchService.search(keyword);
      })
    ).subscribe({
      next: (results: SearchProduct[]) => {
        this.searchResults = results;
        this.isSearching = false;
        // Luôn hiện dropdown nếu còn chữ — không check gì thêm
        if (this.searchQuery.trim()) {
          this.showSearchDropdown = true;
        }
        this.activeIndex = -1;
      },
      error: () => {
        this.isSearching = false;
        this.searchResults = [];
        if (this.searchQuery.trim()) {
          this.showSearchDropdown = true;
        }
      }
    });
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    if (!value.trim()) {
      this.searchResults = [];
      this.showSearchDropdown = false;
      this.isSearching = false;
      return;
    }
    // Mở dropdown + show loading NGAY KHI gõ, không đợi debounce
    this.showSearchDropdown = true;
    this.isSearching = true;
    this.searchSubject.next(value.trim());
  }

  onSearchFocus(): void {
    // Mở lại nếu đang có chữ
    if (this.searchQuery.trim()) {
      this.showSearchDropdown = true;
      if (this.searchResults.length === 0 && !this.isSearching) {
        this.isSearching = true;
        this.searchSubject.next(this.searchQuery.trim());
      }
    }
  }

  onSearchBlur(): void {
    // setTimeout để click vào item dropdown kịp fire trước khi đóng
    setTimeout(() => this.closeSearchDropdown(), 200);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex = Math.min(this.activeIndex + 1, this.searchResults.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex = Math.max(this.activeIndex - 1, -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (this.activeIndex >= 0 && this.searchResults[this.activeIndex]) {
          this.selectProduct(this.searchResults[this.activeIndex]);
        } else {
          this.submitSearch();
        }
        break;
      case 'Escape':
        this.closeSearchDropdown();
        this.searchInputRef?.nativeElement?.blur();
        break;
    }
  }

  selectProduct(product: SearchProduct): void {
    this.closeSearchDropdown();
    this.searchQuery = '';
    this.router.navigate(['/product-detail-page', product._id]);
  }

  submitSearch(): void {
    if (!this.searchQuery.trim()) return;
    this.closeSearchDropdown();
    this.router.navigate(['/products'], {
      queryParams: { search: this.searchQuery.trim() }
    });
    this.searchQuery = '';
  }

  closeSearchDropdown(): void {
    this.showSearchDropdown = false;
    this.activeIndex = -1;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency', currency: 'VND', maximumFractionDigits: 0
    }).format(price);
  }

  checkLoginStatus(): void {
    const token   = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user      = JSON.parse(userStr);
        this.isLoggedIn = true;
        this.userName   = user.username || user.email || user.phone || 'Người dùng';
      } catch {
        this.isLoggedIn = false;
        this.userName   = '';
      }
    } else {
      this.isLoggedIn = false;
      this.userName   = '';
    }
  }

  getInitials(): string {
    if (!this.userName) return 'U';
    const words = this.userName.trim().split(' ');
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return this.userName.substring(0, 2).toUpperCase();
  }

  toggleMenu()     { this.menuOpen     = !this.menuOpen; }
  closeMenu()      { this.menuOpen     = false; }
  toggleDropdown() { this.showDropdown = !this.showDropdown; }
  closeDropdown()  { this.showDropdown = false; }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) this.showDropdown = false;
    // Search dropdown đóng bằng blur — không xử lý ở đây để tránh conflict
  }

  openTrackOrder()       { this.showTrackOrderModal = true; }
  closeTrackOrderModal() { this.showTrackOrderModal = false; }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.isLoggedIn   = false;
    this.userName     = '';
    this.showDropdown = false;
    this.router.navigate(['/']);
  }
}