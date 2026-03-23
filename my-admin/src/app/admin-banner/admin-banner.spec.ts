import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminBanner } from './admin-banner';

describe('AdminBanner', () => {
  let component: AdminBanner;
  let fixture: ComponentFixture<AdminBanner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminBanner]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminBanner);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
