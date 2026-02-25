import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatbotKnowledgeBase } from './chatbot-knowledge-base';

describe('ChatbotKnowledgeBase', () => {
  let component: ChatbotKnowledgeBase;
  let fixture: ComponentFixture<ChatbotKnowledgeBase>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatbotKnowledgeBase]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatbotKnowledgeBase);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
