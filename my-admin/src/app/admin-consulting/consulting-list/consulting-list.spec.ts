import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConsultingList } from './consulting-list';

describe('ConsultingList', () => {
  let component: ConsultingList;
  let fixture: ComponentFixture<ConsultingList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsultingList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConsultingList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
