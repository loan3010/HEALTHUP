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
import { ProductService, Product, ProductVariant, ProductNutrition } from '../product.service';
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
  @Input() categories: string[] = [];
  @Output() save = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  formData: Product = this.emptyForm();
  isEditMode = false;
  isSaving = false;
  showNewCategoryInput = false;
  newCategory = '';
  packagingInput = '';
  categoryOptions: string[] = [];
  variants: ProductVariant[] = [];
  nutritions: ProductNutrition[] = [];

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
  this.setupCategoryOptions();
  this.setupVariants();
  this.setupNutritions();
}

  emptyForm(): Product {
    return {
      sku: '',
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
      nutrition: [],
    };
  }

  onSave() {
    // Chuẩn hóa dữ liệu trước khi lưu để tránh gửi item rỗng/trùng.
    this.normalizeBeforeSave();
    const usingVariants = this.variants.length > 0;
    if (!this.formData.name || !this.formData.cat || (!usingVariants && !this.formData.price)) {
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

  setupCategoryOptions(): void {
    const fromParent = (this.categories || []).map(c => String(c || '').trim()).filter(Boolean);
    const fromProduct = String(this.formData.cat || '').trim();
    const merged = [...fromParent, ...(fromProduct ? [fromProduct] : [])];
    this.categoryOptions = Array.from(new Set(merged));
  }

  onCategorySelectionChange(): void {
    if (this.formData.cat === '__new__') {
      this.showNewCategoryInput = true;
      this.newCategory = '';
      return;
    }
    this.showNewCategoryInput = false;
  }

  addNewCategory(): void {
    const cat = String(this.newCategory || '').trim();
    if (!cat) return;
    if (!this.categoryOptions.includes(cat)) this.categoryOptions.push(cat);
    this.formData.cat = cat;
    this.showNewCategoryInput = false;
    this.newCategory = '';
  }

  cancelNewCategory(): void {
    this.showNewCategoryInput = false;
    // Trả về danh mục cũ nếu đang edit, tránh để giá trị sentinel.
    if (this.formData.cat === '__new__') {
      this.formData.cat = this.product?.cat || '';
    }
  }

  addPackagingType(raw?: string): void {
    const value = String(raw ?? this.packagingInput ?? '').trim();
    if (!value) return;
    if (!this.formData.packagingTypes) this.formData.packagingTypes = [];
    if (this.formData.packagingTypes.includes(value)) {
      this.packagingInput = '';
      return;
    }
    this.formData.packagingTypes.push(value);
    this.packagingInput = '';
  }

  removePackagingType(index: number): void {
    this.formData.packagingTypes?.splice(index, 1);
  }

  onPackagingInputKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.addPackagingType();
  }

  private normalizeBeforeSave(): void {
    this.formData.name = String(this.formData.name || '').trim();
    this.formData.cat = String(this.formData.cat || '').trim();
    this.formData.packagingTypes = (this.formData.packagingTypes || [])
      .map(x => String(x || '').trim())
      .filter(Boolean)
      .filter((x, i, arr) => arr.indexOf(x) === i);

    // Ưu tiên dữ liệu biến thể nếu có.
    this.variants = (this.variants || [])
      .map(v => ({
        _id: v._id,
        label: String(v.label || '').trim(),
        price: Math.max(0, Number(v.price || 0)),
        stock: Math.max(0, Number(v.stock || 0)),
        oldPrice: Math.max(0, Number(v.oldPrice || 0)),
        isActive: v.isActive !== false
      }))
      .filter(v => !!v.label);

    if (this.variants.length > 0) {
      this.formData.variants = this.variants;
      this.formData.price = this.variants[0].price;
      this.formData.oldPrice = this.variants[0].oldPrice || 0;
      this.formData.stock = this.variants.reduce((sum, v) => sum + Number(v.stock || 0), 0);
    } else {
      this.formData.variants = [];
    }

    this.formData.nutrition = (this.nutritions || [])
      .map(n => ({
        name: String(n.name || '').trim(),
        value: String(n.value || '').trim(),
        percent: Math.max(0, Number(n.percent || 0))
      }))
      .filter(n => n.name || n.value);
  }

  setupVariants(): void {
    const variants = Array.isArray(this.formData.variants) ? this.formData.variants : [];
    if (variants.length > 0) {
      this.variants = variants.map(v => ({
        _id: v._id,
        label: String(v.label || '').trim(),
        price: Number(v.price || 0),
        stock: Number(v.stock || 0),
        oldPrice: Number(v.oldPrice || 0),
        isActive: v.isActive !== false
      }));
      return;
    }
    this.variants = [];
  }

  addVariant(): void {
    this.variants.push({
      label: '',
      price: 0,
      stock: 0,
      oldPrice: 0,
      isActive: true
    });
  }

  removeVariant(index: number): void {
    this.variants.splice(index, 1);
  }

  setupNutritions(): void {
    const src = Array.isArray(this.formData.nutrition) ? this.formData.nutrition : [];
    this.nutritions = src.map((n) => ({
      name: String(n?.name || '').trim(),
      value: String(n?.value || '').trim(),
      percent: Math.max(0, Number(n?.percent || 0)),
    }));
  }

  addNutrition(): void {
    this.nutritions.push({ name: '', value: '', percent: 0 });
  }

  removeNutrition(index: number): void {
    this.nutritions.splice(index, 1);
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


