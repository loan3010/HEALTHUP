import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Consulting } from './consulting';

describe('Consulting', () => {
  let component: Consulting;
  let fixture: ComponentFixture<Consulting>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Consulting]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Consulting);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
