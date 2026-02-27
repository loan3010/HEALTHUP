import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chatbot-logic-engine',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot-logic-engine.html',
  styleUrls: ['./chatbot-logic-engine.css'] // Nhớ tạo file này bà nhé
})
export class ChatbotLogicEngine {
  fuzzyValue: number = 80; // Giá trị mặc định như ảnh
  
  // Danh sách mapping mặc định
  mappingList = [
    { from: 'k, ko', to: 'không' },
    { from: 'dc', to: 'được' },
    { from: 'nhìu', to: 'nhiều' }
  ];

  addNewMapping() {
    this.mappingList.push({ from: '', to: '' });
  }

  removeMapping(index: number) {
    this.mappingList.splice(index, 1);
  }
}