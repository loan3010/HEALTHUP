import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatbotLivePreview } from './chatbot-live-preview';

describe('ChatbotLivePreview', () => {
  let component: ChatbotLivePreview;
  let fixture: ComponentFixture<ChatbotLivePreview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatbotLivePreview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatbotLivePreview);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
