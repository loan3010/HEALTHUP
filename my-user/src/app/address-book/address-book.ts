import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface Address {
  name: string;
  phone: string;
  address: string;
  isDefault: boolean;
}

@Component({
  selector: 'app-address-book',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './address-book.html',
  styleUrl: './address-book.css'
})
export class AddressBook {

  addresses: Address[] = [
    {
      name: 'ThuHa',
      phone: '0987654321',
      address: '2222 nè, Phường Bến Thành, Quận 2, TP.HCM',
      isDefault: true
    },
    {
      name: 'Minh Anh',
      phone: '0912345678',
      address: '123 Lê Lợi, Quận 1, TP.HCM',
      isDefault: false
    }
  ];

}