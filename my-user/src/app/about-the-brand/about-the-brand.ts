import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-about-the-brand',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './about-the-brand.html',
  styleUrl: './about-the-brand.css',
})
export class AboutTheBrand implements OnInit, AfterViewInit, OnDestroy {

  private intersectionObserver?: IntersectionObserver;
  private countersAnimated = false;

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.initScrollAnimations();
    this.initCounterAnimation();
  }

  ngOnDestroy(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }

  // Fade in khi scroll đến
  private initScrollAnimations(): void {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    document.querySelectorAll('.fade-in').forEach((el) => {
      this.intersectionObserver?.observe(el);
    });
  }

  // Đếm số khi scroll đến section stats
  private initCounterAnimation(): void {
    const statsSection = document.querySelector('.stats');

    if (statsSection) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !this.countersAnimated) {
            this.animateCounters();
            this.countersAnimated = true;
            observer.disconnect();
          }
        },
        { threshold: 0.5 }
      );
      observer.observe(statsSection);
    }
  }

  private animateCounters(): void {
    const counters = document.querySelectorAll('[data-target]');

    counters.forEach((counter) => {
      const target = parseInt((counter as HTMLElement).dataset['target'] || '0');
      const duration = 2000;
      const increment = target / (duration / 16);
      let current = 0;

      const update = (): void => {
        current += increment;
        if (current < target) {
          (counter as HTMLElement).textContent = Math.floor(current).toLocaleString('vi-VN');
          requestAnimationFrame(update);
        } else {
          (counter as HTMLElement).textContent = target.toLocaleString('vi-VN');
        }
      };

      setTimeout(update, Math.random() * 300);
    });
  }
}