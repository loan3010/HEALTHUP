import {
  Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef,
  ChangeDetectorRef
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
    private searchService: SearchService,
    private cdr: ChangeDetectorRef   // ✅ thêm vào giống wishlist
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
      debounceTime(250),              // giảm từ 300 → 250ms cho nhanh hơn
      distinctUntilChanged(),
      switchMap(keyword => {
        if (!keyword.trim()) {
          this.isSearching = false;
          this.searchResults = [];
          this.showSearchDropdown = false;
          this.cdr.detectChanges();   // ✅
          return of([] as SearchProduct[]);
        }
        this.isSearching = true;
        this.showSearchDropdown = true;
        this.cdr.detectChanges();     // ✅ hiện loading spinner ngay
        return this.searchService.search(keyword);
      })
    ).subscribe({
      next: (results: SearchProduct[]) => {
        this.searchResults = results;
        this.isSearching = false;
        if (this.searchQuery.trim()) {
          this.showSearchDropdown = true;
        }
        this.activeIndex = -1;
        this.cdr.detectChanges();     // ✅ hiện kết quả ngay, không cần click
      },
      error: () => {
        this.isSearching = false;
        this.searchResults = [];
        if (this.searchQuery.trim()) {
          this.showSearchDropdown = true;
        }
        this.cdr.detectChanges();     // ✅ hiện trạng thái lỗi ngay
      }
    });
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    if (!value.trim()) {
      this.searchResults = [];
      this.showSearchDropdown = false;
      this.isSearching = false;
      this.cdr.detectChanges();       // ✅
      return;
    }
    this.showSearchDropdown = true;
    this.isSearching = true;
    this.cdr.detectChanges();         // ✅ hiện dropdown + spinner ngay khi gõ
    this.searchSubject.next(value.trim());
  }

  onSearchFocus(): void {
    if (this.searchQuery.trim()) {
      this.showSearchDropdown = true;
      if (this.searchResults.length === 0 && !this.isSearching) {
        this.isSearching = true;
        this.cdr.detectChanges();     // ✅
        this.searchSubject.next(this.searchQuery.trim());
      }
    }
  }

  onSearchBlur(): void {
    setTimeout(() => {
      this.closeSearchDropdown();
      this.cdr.detectChanges();       // ✅
    }, 200);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex = Math.min(this.activeIndex + 1, this.searchResults.length - 1);
        this.cdr.detectChanges();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex = Math.max(this.activeIndex - 1, -1);
        this.cdr.detectChanges();
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
        this.cdr.detectChanges();
        this.searchInputRef?.nativeElement?.blur();
        break;
    }
  }

  selectProduct(product: SearchProduct): void {
    this.closeSearchDropdown();
    this.searchQuery = '';
    this.cdr.detectChanges();
    this.router.navigate(['/product-detail-page', product._id]);
  }

  submitSearch(): void {
    if (!this.searchQuery.trim()) return;
    this.closeSearchDropdown();
    this.router.navigate(['/products'], {
      queryParams: { search: this.searchQuery.trim() }
    });
    this.searchQuery = '';
    this.cdr.detectChanges();
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
    this.cdr.detectChanges();
  }

  getInitials(): string {
    if (!this.userName) return 'U';
    const words = this.userName.trim().split(' ');
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return this.userName.substring(0, 2).toUpperCase();
  }

  toggleMenu()     { this.menuOpen     = !this.menuOpen;     this.cdr.detectChanges(); }
  closeMenu()      { this.menuOpen     = false;               this.cdr.detectChanges(); }
  toggleDropdown() { this.showDropdown = !this.showDropdown; this.cdr.detectChanges(); }
  closeDropdown()  { this.showDropdown = false;               this.cdr.detectChanges(); }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) {
      this.showDropdown = false;
      this.cdr.detectChanges();
    }
  }

  openTrackOrder()       { this.showTrackOrderModal = true;  this.cdr.detectChanges(); }
  closeTrackOrderModal() { this.showTrackOrderModal = false; this.cdr.detectChanges(); }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.isLoggedIn   = false;
    this.userName     = '';
    this.showDropdown = false;
    this.cdr.detectChanges();
    this.router.navigate(['/']);
  }
}