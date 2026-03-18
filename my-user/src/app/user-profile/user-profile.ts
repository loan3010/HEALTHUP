import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-profile.html',
  styleUrls: ['./user-profile.css'],
})
export class UserProfile implements OnInit {
  
  userName = '';

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Lấy thông tin user từ localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.userName = user.username || user.email || user.phone || 'User';
      } catch (error) {
        this.userName = 'User';
      }
    }
  }

  getInitials(): string {
    if (!this.userName) return 'U';
    
    const words = this.userName.trim().split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return this.userName.substring(0, 2).toUpperCase();
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.router.navigate(['/']);
  }
}