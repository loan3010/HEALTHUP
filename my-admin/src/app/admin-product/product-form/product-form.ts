// import { Component } from '@angular/core';

// @Component({
//   selector: 'app-product-form',
//   imports: [],
//   templateUrl: './product-form.html',
//   styleUrl: './product-form.css',
// })
// export class ProductForm {

// }
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService, Product } from '../product.service';
import { HttpClient } from '@angular/common/http';



@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-form.html',
  styleUrls: ['./product-form.css']
})
export class ProductFormComponent implements OnInit {
  @Input() product: Product | null = null;
  @Output() save = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  formData: Product = this.emptyForm();
  isEditMode = false;
  isSaving = false;

  // constructor(private productService: ProductService) {}
  constructor(
  private productService: ProductService,
  private http: HttpClient
) {}

  // ngOnInit() {
  //   if (this.product?._id) {
  //     this.isEditMode = true;
  //     this.formData = { ...this.product };
  //   } else {
  //     this.isEditMode = false;
  //     this.formData = this.emptyForm();
  //   }
  // }
  ngOnInit() {
  if (this.product?._id) {
    this.isEditMode = true;
    this.formData = { ...this.product };
    // Load ảnh cũ vào preview
    this.imagePreview = (this.product.images || [])
      .map(img => 'http://localhost:3000' + img);
  } else {
    this.isEditMode = false;
    this.formData = this.emptyForm();
  }
}

  emptyForm(): Product {
    return {
      name: '',
      cat: '',
      price: 0,
      oldPrice: 0,
      stock: 0,
      shortDesc: '',
      description: '',
      badge: null,
      weight: '',
      saving: '',
      status: 'active',
      packagingTypes: [],
    };
  }

  onSave() {
    if (!this.formData.name || !this.formData.cat || !this.formData.price) {
      alert('Vui lòng điền đầy đủ các trường bắt buộc!');
      return;
    }
    this.isSaving = true;
    if (this.isEditMode) {
      this.productService.update(this.formData._id!, this.formData).subscribe({
        next: () => { this.isSaving = false; this.save.emit(); },
        error: (err) => { console.error(err); this.isSaving = false; }
      });
    } else {
      this.productService.create(this.formData).subscribe({
        next: () => { this.isSaving = false; this.save.emit(); },
        error: (err) => { console.error(err); this.isSaving = false; }
      });
    }
  };
  getPackagingText(): string {
  return this.formData.packagingTypes?.join(', ') || '';
}

onPackagingChange(value: string) {
  this.formData.packagingTypes = value.split(',').map(s => s.trim()).filter(s => s);
}



imagePreview: string[] = [];

onImageSelect(event: any) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('image', file);

  this.http.post<{url: string}>('http://localhost:3000/api/products/upload-image', formData)
    .subscribe({
      next: (res) => {
        if (!this.formData.images) this.formData.images = [];
        this.formData.images.push(res.url);
        this.imagePreview.push('http://localhost:3000' + res.url);
      },
      error: (err) => console.error(err)
    });
}

removeImage(index: number) {
  this.formData.images?.splice(index, 1);
  this.imagePreview.splice(index, 1);
}

}


