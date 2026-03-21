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
import { ProductService, Product, ProductVariant, ProductNutrition, ADMIN_API_BASE, ADMIN_STATIC_BASE } from '../product.service';
import { HttpClient } from '@angular/common/http';



@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-form.html',
  styleUrls: ['./product-form.css']
})
export class ProductFormComponent implements OnInit {
  readonly staticBase = ADMIN_STATIC_BASE;
  @Input() product: Product | null = null;
  @Input() categories: string[] = [];
  @Input() embedded = false;
  @Output() save = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  formData: Product = this.emptyForm();
  isEditMode = false;
  isSaving = false;
  showNewCategoryInput = false;
  newCategory = '';
  packagingInput = '';
  selectedPackagingType = '';
  typeInput = '';
  weightInput = '';
  categoryOptions: string[] = [];
  variants: ProductVariant[] = [];
  typeOptions: string[] = [];
  weightOptions: string[] = [];
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
      .map(img => this.staticBase + img);
  } else {
    this.isEditMode = false;
    this.formData = this.emptyForm();
  }
  // Tên nhóm phân loại: mặc định nếu DB chưa có (sản phẩm cũ).
  this.formData.variantAttr1Name = String(this.formData.variantAttr1Name || 'Phân loại 1').trim() || 'Phân loại 1';
  this.formData.variantAttr2Name = String(this.formData.variantAttr2Name || 'Phân loại 2').trim() || 'Phân loại 2';
  this.setupCategoryOptions();
  this.setupVariants();
  this.selectedPackagingType = String(this.formData.packagingTypes?.[0] || '').trim();
  this.setupTypeWeightOptions();
  this.ensureVariantCombinations();
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
      variantAttr1Name: 'Phân loại 1',
      variantAttr2Name: 'Phân loại 2',
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

  applyPackagingType(): void {
    this.selectedPackagingType = String(this.packagingInput || this.selectedPackagingType || '').trim();
    this.packagingInput = '';
  }

  private normalizeBeforeSave(): void {
    this.formData.name = String(this.formData.name || '').trim();
    this.formData.cat = String(this.formData.cat || '').trim();
    this.selectedPackagingType = String(this.selectedPackagingType || this.packagingInput || '').trim();
    this.formData.packagingTypes = this.selectedPackagingType ? [this.selectedPackagingType] : [];

    this.typeOptions = this.uniqueTextList(this.typeOptions);
    this.weightOptions = this.uniqueTextList(this.weightOptions);

    // Ưu tiên dữ liệu biến thể nếu có.
    this.variants = (this.variants || [])
      .map((v) => {
        const a1 = String(v.attr1Value || '').trim();
        const a2 = String(v.attr2Value || '').trim();
        const parsed = this.parseVariantCombo(String(v.label || ''));
        const fa1 = a1 || parsed.a1;
        const fa2 = a2 || parsed.a2;
        return {
          _id: v._id,
          attr1Value: fa1,
          attr2Value: fa2,
          label: fa1 && fa2 ? this.buildVariantLabel(fa1, fa2) : String(v.label || '').trim(),
          image: String(v.image || '').trim(),
          price: Math.max(0, Number(v.price || 0)),
          stock: Math.max(0, Number(v.stock || 0)),
          oldPrice: Math.max(0, Number(v.oldPrice || 0)),
          isActive: v.isActive !== false
        };
      })
      .filter((v) => !!v.label);

    if (this.variants.length > 0) {
      this.formData.variants = this.variants;
      this.formData.variantAttr1Name = String(this.formData.variantAttr1Name || 'Phân loại 1').trim() || 'Phân loại 1';
      this.formData.variantAttr2Name = String(this.formData.variantAttr2Name || 'Phân loại 2').trim() || 'Phân loại 2';
      this.formData.price = this.variants[0].price;
      this.formData.oldPrice = this.variants[0].oldPrice || 0;
      this.formData.stock = this.variants.reduce((sum, v) => sum + Number(v.stock || 0), 0);
      this.formData.weight = this.weightOptions.join(', ');
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
      this.variants = variants.map((v) => {
        let a1 = String(v.attr1Value || '').trim();
        let a2 = String(v.attr2Value || '').trim();
        const parsed = this.parseVariantCombo(String(v.label || ''));
        if (!a1) a1 = parsed.a1;
        if (!a2) a2 = parsed.a2;
        const label = a1 && a2 ? this.buildVariantLabel(a1, a2) : String(v.label || '').trim();
        return {
          _id: v._id,
          label,
          attr1Value: a1,
          attr2Value: a2,
          image: String(v.image || '').trim(),
          price: Number(v.price || 0),
          stock: Number(v.stock || 0),
          oldPrice: Number(v.oldPrice || 0),
          isActive: v.isActive !== false
        };
      });
      return;
    }
    this.variants = [];
  }

  addVariant(): void {
    this.variants.push({
      label: '',
      attr1Value: '',
      attr2Value: '',
      price: 0,
      stock: 0,
      oldPrice: 0,
      isActive: true
    });
  }

  removeVariant(index: number): void {
    this.variants.splice(index, 1);
  }

  setupTypeWeightOptions(): void {
    const typeSet = new Set<string>();
    const weightSet = new Set<string>();

    const fromWeightField = String(this.formData.weight || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    fromWeightField.forEach((x) => weightSet.add(x));

    (this.variants || []).forEach((v) => {
      const a1 = String(v.attr1Value || '').trim();
      const a2 = String(v.attr2Value || '').trim();
      const parts = this.parseVariantCombo(v.label || '');
      if (a1 || parts.a1) typeSet.add(a1 || parts.a1);
      if (a2 || parts.a2) weightSet.add(a2 || parts.a2);
    });

    this.typeOptions = Array.from(typeSet);
    this.weightOptions = Array.from(weightSet);
  }

  addTypeOption(raw?: string): void {
    const value = String(raw ?? this.typeInput ?? '').trim();
    if (!value) return;
    if (!this.typeOptions.includes(value)) this.typeOptions.push(value);
    this.typeInput = '';
    this.ensureVariantCombinations();
  }

  removeTypeOption(index: number): void {
    this.typeOptions.splice(index, 1);
    this.ensureVariantCombinations();
  }

  addWeightOption(raw?: string): void {
    const value = String(raw ?? this.weightInput ?? '').trim();
    if (!value) return;
    if (!this.weightOptions.includes(value)) this.weightOptions.push(value);
    this.weightInput = '';
    this.ensureVariantCombinations();
  }

  removeWeightOption(index: number): void {
    this.weightOptions.splice(index, 1);
    this.ensureVariantCombinations();
  }

  onTypeInputKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.addTypeOption();
  }

  onWeightInputKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.addWeightOption();
  }

  ensureVariantCombinations(): void {
    const types = this.uniqueTextList(this.typeOptions);
    const weights = this.uniqueTextList(this.weightOptions);

    // Chưa đủ dữ liệu tổ hợp -> xóa tổ hợp để tránh dữ liệu mồ côi/sai.
    if (!types.length || !weights.length) {
      this.variants = [];
      return;
    }

    const oldMap = new Map<string, ProductVariant>();
    (this.variants || []).forEach((v) => {
      const a1 = String(v.attr1Value || '').trim() || this.parseVariantCombo(v.label || '').a1;
      const a2 = String(v.attr2Value || '').trim() || this.parseVariantCombo(v.label || '').a2;
      const key = this.variantComboKey(a1, a2);
      if (a1 && a2) oldMap.set(key, v);
    });

    const next: ProductVariant[] = [];
    for (const type of types) {
      for (const weight of weights) {
        const label = this.buildVariantLabel(type, weight);
        const found = oldMap.get(this.variantComboKey(type, weight));
        next.push({
          _id: found?._id,
          label,
          attr1Value: String(type || '').trim(),
          attr2Value: String(weight || '').trim(),
          image: String(found?.image || '').trim(),
          price: Number(found?.price || 0),
          oldPrice: Number(found?.oldPrice || 0),
          stock: Number(found?.stock || 0),
          isActive: found?.isActive !== false
        });
      }
    }
    this.variants = next;
  }

  private buildVariantLabel(type: string, weight: string): string {
    return `${String(type || '').trim()} | ${String(weight || '').trim()}`;
  }

  /** Khóa ổn định để ghép dữ liệu cũ khi đổi tên nhóm (không phụ thuộc label). */
  private variantComboKey(a1: string, a2: string): string {
    return `${String(a1 || '').trim().toLowerCase()}||${String(a2 || '').trim().toLowerCase()}`;
  }

  /** Tách "A | B" từ label (dữ liệu cũ không có attr1/attr2). */
  private parseVariantCombo(label: string): { a1: string; a2: string } {
    const raw = String(label || '').trim();
    if (!raw) return { a1: '', a2: '' };
    const parts = raw.split('|').map((x) => x.trim()).filter(Boolean);
    if (parts.length >= 2) return { a1: parts[0], a2: parts[1] };
    return { a1: parts[0] || '', a2: '' };
  }

  private uniqueTextList(list: string[]): string[] {
    return (list || [])
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .filter((x, i, arr) => arr.indexOf(x) === i);
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

  this.http.post<{url: string}>(`${ADMIN_API_BASE}/products/upload-image`, formData)
    .subscribe({
      next: (res) => {
        if (!this.formData.images) this.formData.images = [];
        this.formData.images.push(res.url);
        this.imagePreview.push(this.staticBase + res.url);
      },
      error: (err) => console.error(err)
    });
}

removeImage(index: number) {
  this.formData.images?.splice(index, 1);
  this.imagePreview.splice(index, 1);
}

onVariantImageSelect(index: number, event: any): void {
  const file = event?.target?.files?.[0];
  if (!file || !this.variants[index]) return;
  const fd = new FormData();
  fd.append('image', file);
  this.http.post<{ url: string }>(`${ADMIN_API_BASE}/products/upload-image`, fd).subscribe({
    next: (res) => {
      this.variants[index].image = res.url;
    },
    error: (err) => console.error(err)
  });
}

variantImagePreview(v: ProductVariant): string {
  const img = String(v?.image || '').trim();
  if (!img) return '';
  if (img.startsWith('http')) return img;
  return `${this.staticBase}${img}`;
}

}


