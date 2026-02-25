import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConsultingDetail } from './consulting-detail';

describe('ConsultingDetail', () => {
  let component: ConsultingDetail;
  let fixture: ComponentFixture<ConsultingDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsultingDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConsultingDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
