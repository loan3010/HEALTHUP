import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatbotFormEditor } from './chatbot-form-editor';

describe('ChatbotFormEditor', () => {
  let component: ChatbotFormEditor;
  let fixture: ComponentFixture<ChatbotFormEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatbotFormEditor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatbotFormEditor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
