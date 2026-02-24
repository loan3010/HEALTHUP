import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatbotLogicEngine } from './chatbot-logic-engine';

describe('ChatbotLogicEngine', () => {
  let component: ChatbotLogicEngine;
  let fixture: ComponentFixture<ChatbotLogicEngine>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatbotLogicEngine]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatbotLogicEngine);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
