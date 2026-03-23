import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ProductService, Product, ProductVariant, ProductNutrition, ADMIN_API_BASE, ADMIN_STATIC_BASE } from '../product.service';
import { DescriptionQuillEditorComponent } from '../description-quill-editor/description-quill-editor';
import {
  MAX_CLASSIFICATION_SLOTS,
  ClassificationRole,
  VariantClassificationSlot
} from '../variant-classification.models';
import {
  FIXED_VARIANT_PRESET_COUNT,
  FIXED_VARIANT_PRESETS,
  emptyFixedClassificationSlots
} from '../fixed-variant-presets';
import { AdminAlertModalService } from '../../admin-alert-modal/admin-alert-modal.service';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, DescriptionQuillEditorComponent],
  templateUrl: './product-form.html',
  styleUrls: ['./product-form.css']
})
export class ProductFormComponent implements OnInit, OnChanges {
  readonly staticBase = ADMIN_STATIC_BASE;
  readonly maxSlots = MAX_CLASSIFICATION_SLOTS;
  /** preset meta — dùng template (icon, hint). */
  readonly fixedPresets = FIXED_VARIANT_PRESETS;

  @Input() product: Product | null = null;
  @Input() categories: string[] = [];
  @Input() embedded = false;
  @Output() save = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  formData: Product = this.emptyForm();
  isEditMode = false;
  isSaving = false;
  categoryOptions: string[] = [];
  variants: ProductVariant[] = [];
  nutritions: ProductNutrition[] = [];

  /** Luôn đúng 4 preset cố định (chip rỗng = bỏ qua khi tính tích). */
  classificationSlots: VariantClassificationSlot[] = [];

  /** Thông báo sau khi thêm chip làm sinh thêm dòng biến thể. */
  variantFlashMessage = '';
  /** Chỉ số dòng cần highlight (vàng) sau khi thêm combo mới. */
  highlightedVariantRowIndexes = new Set<number>();

  constructor(
    private productService: ProductService,
    private http: HttpClient,
    private adminAlert: AdminAlertModalService
  ) {}

  ngOnInit(): void {
    if (this.product?._id) {
      this.isEditMode = true;
      this.formData = { ...this.product };
      this.imagePreview = (this.product.images || []).map((img) => this.staticBase + img);
    } else {
      this.isEditMode = false;
      this.formData = this.emptyForm();
    }

    this.formData.variantAttr1Name = String(this.formData.variantAttr1Name || 'Phân loại 1').trim() || 'Phân loại 1';
    this.formData.variantAttr2Name = String(this.formData.variantAttr2Name || 'Phân loại 2').trim() || 'Phân loại 2';
    this.formData.variantAttr3Name = String(this.formData.variantAttr3Name || 'Phân loại 3').trim() || 'Phân loại 3';
    this.formData.variantAttr4Name = String(this.formData.variantAttr4Name || 'Phân loại 4').trim() || 'Phân loại 4';
    this.formData.variantQuantityKind = this.normalizeVariantQuantityKindField();

    this.setupCategoryOptions();
    this.setupVariants();
    this.hydrateClassificationSlots();
    this.rebuildVariantsFromSlots();
    this.setupNutritions();

    this.formData.isHidden = !!this.formData.isHidden;
    this.formData.isOutOfStock = !!this.formData.isOutOfStock;
  }

  /** Cha tải lại danh mục (async) — luôn đồng bộ dropdown. */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['categories']) {
      this.setupCategoryOptions();
    }
  }

  emptyForm(): Product {
    return {
      sku: '',
      name: '',
      cat: '',
      // Chỉ hiển thị trên form — backend tự cập nhật khi có đơn / review.
      sold: 0,
      rating: 0,
      reviewCount: 0,
      price: 0,
      oldPrice: 0,
      stock: 0,
      shortDesc: '',
      description: '',
      badge: null,
      weight: '',
      saving: '',
      isHidden: false,
      isOutOfStock: false,
      packagingTypes: [],
      nutrition: [],
      variantAttr1Name: 'Phân loại 1',
      variantAttr2Name: 'Phân loại 2',
      variantAttr3Name: 'Phân loại 3',
      variantAttr4Name: 'Phân loại 4',
      variantQuantityKind: 'none',
      variantClassifications: []
    };
  }

  onSave(): void {
    this.normalizeBeforeSave();
    const rowErr = this.validateVariantRowsBeforeSubmit();
    if (rowErr) {
      this.adminAlert.show({ title: 'Kiểm tra biến thể', message: rowErr, isError: true });
      return;
    }
    const roleErr = this.validateSlotRolesClient();
    if (roleErr) {
      this.adminAlert.show({ title: 'Phân loại', message: roleErr, isError: true });
      return;
    }
    const qErr = this.validateVariantQuantityKindForForm();
    if (qErr) {
      this.adminAlert.show({ title: 'Số lượng / đơn vị', message: qErr, isError: true });
      return;
    }
    const usingVariants = this.variants.length > 0;
    if (!this.formData.name || !this.formData.cat || (!usingVariants && !this.formData.price)) {
      this.adminAlert.show({
        title: 'Thiếu thông tin',
        message: 'Vui lòng điền đầy đủ các trường bắt buộc.',
        isError: true,
      });
      return;
    }
    this.isSaving = true;
    if (this.isEditMode) {
      this.productService.update(this.formData._id!, this.formData).subscribe({
        next: () => {
          this.isSaving = false;
          this.save.emit();
        },
        error: (err) => {
          console.error(err);
          this.isSaving = false;
          const msg = err?.error?.message || err?.error?.error;
          if (msg) {
            this.adminAlert.show({ title: 'Lỗi lưu', message: String(msg), isError: true });
          }
        }
      });
    } else {
      this.productService.create(this.formData).subscribe({
        next: () => {
          this.isSaving = false;
          this.save.emit();
        },
        error: (err) => {
          console.error(err);
          this.isSaving = false;
          const msg = err?.error?.message || err?.error?.error;
          if (msg) {
            this.adminAlert.show({ title: 'Lỗi lưu', message: String(msg), isError: true });
          }
        }
      });
    }
  }

  /** Số đã bán — chỉ đọc, đồng bộ từ server / đơn hàng. */
  displayStatSold(): string {
    const n = Number(this.formData.sold ?? 0);
    return Number.isFinite(n) ? String(Math.max(0, Math.floor(n))) : '0';
  }

  /** Điểm TB đánh giá — chỉ đọc, API review cập nhật. */
  displayStatRating(): string {
    const r = Number(this.formData.rating ?? 0);
    if (!Number.isFinite(r) || r <= 0) return '0';
    return r.toFixed(1);
  }

  /** Số lượt đánh giá — chỉ đọc. */
  displayStatReviewCount(): string {
    const n = Number(this.formData.reviewCount ?? 0);
    return Number.isFinite(n) ? String(Math.max(0, Math.floor(n))) : '0';
  }

  /**
   * Dropdown: chỉ danh mục active từ API.
   * Nếu SP đang có `cat` thuộc DM đã vô hiệu — vẫn hiện một dòng để không mất dữ liệu khi lưu.
   */
  setupCategoryOptions(): void {
    const fromParent = (this.categories || []).map((c) => String(c || '').trim()).filter(Boolean);
    const fromProduct = String(this.formData.cat || '').trim();
    const merged = [...fromParent, ...(fromProduct && !fromParent.includes(fromProduct) ? [fromProduct] : [])];
    this.categoryOptions = Array.from(new Set(merged));
  }

  /** Toggle “Hiển thị trên shop” — lưu `isHidden` trong Mongo. */
  setShopVisible(visible: boolean): void {
    this.formData.isHidden = !visible;
  }

  setTempOutOfStock(flag: boolean): void {
    this.formData.isOutOfStock = flag;
  }

  /** Đọc variantClassifications từ DB hoặc suy ra từ biến thể cũ (1–3 chiều). */
  private hydrateClassificationSlots(): void {
    const bases = emptyFixedClassificationSlots();
    const persisted = this.formData.variantClassifications;
    const variantsInDb = Array.isArray(this.formData.variants) && this.formData.variants.length > 0;

    if (Array.isArray(persisted) && persisted.length > 0) {
      for (let i = 0; i < FIXED_VARIANT_PRESET_COUNT; i++) {
        const row = persisted[i];
        if (row && Array.isArray(row.values)) {
          bases[i].values = this.uniqueTextList(row.values);
        }
        // Tên nhóm tùy chỉnh từ Mongo — không ghi đè ở enforceSlotRoleRules.
        if (row && String(row.name || '').trim()) {
          bases[i].name = String(row.name).trim().slice(0, 80);
        }
      }
      const hasAnyChip = bases.some((s) => s.values.length > 0);
      if (!hasAnyChip && variantsInDb) {
        this.classificationSlots = this.inferSlotsFromLegacyIntoFourPresets();
      } else {
        this.classificationSlots = bases;
      }
    } else {
      this.classificationSlots = this.inferSlotsFromLegacyIntoFourPresets();
    }
    // Bổ sung chip từ weights / packagingTypes cũ nếu slot trống (load DB legacy).
    this.mergeLegacyWeightsPackagingIntoSlots();
    this.enforceSlotRoleRules();
    this.applySlotDisplayNamesAfterHydrate();
  }

  /**
   * Gắn chip từ `weights` / `packagingTypes` khi preset 0–1 còn trống.
   * Không ghi đè chip đã lưu trong variantClassifications.
   */
  private mergeLegacyWeightsPackagingIntoSlots(): void {
    const s0 = this.classificationSlots[0];
    const s1 = this.classificationSlots[1];
    const wLabels = (this.formData.weights || [])
      .map((w: { label?: string }) => String(w?.label || '').trim())
      .filter(Boolean);
    if (s0 && !s0.values.length && wLabels.length) {
      s0.values = this.uniqueTextList(wLabels);
    }
    const packs = (Array.isArray(this.formData.packagingTypes) ? this.formData.packagingTypes : [])
      .map((x: string) => String(x || '').trim())
      .filter(Boolean);
    if (s1 && !s1.values.length && packs.length) {
      s1.values = this.uniqueTextList(packs);
    }
  }

  /**
   * Suy ra chip cho 4 preset từ variants (attr1→cột1 …) — dùng khi chưa có classifications trong DB.
   */
  private inferSlotsFromLegacyIntoFourPresets(): VariantClassificationSlot[] {
    const bases = emptyFixedClassificationSlots();
    const rawVs = Array.isArray(this.formData.variants) ? this.formData.variants : [];
    if (!rawVs.length) return bases;

    let maxD = 1;
    rawVs.forEach((v) => {
      const p = this.parseVariantParts(v);
      if (p.a4) maxD = 4;
      else if (p.a3) maxD = Math.max(maxD, 3);
      else if (p.a2) maxD = Math.max(maxD, 2);
    });

    const collect = (dim: number): string[] => {
      const set = new Set<string>();
      rawVs.forEach((v) => {
        const p = this.parseVariantParts(v);
        const val = [p.a1, p.a2, p.a3, p.a4][dim];
        if (val) set.add(val);
      });
      return Array.from(set);
    };

    for (let d = 0; d < maxD && d < FIXED_VARIANT_PRESET_COUNT; d++) {
      bases[d].values = collect(d);
    }
    return bases;
  }

  /**
   * Khóa role theo 4 preset cố định (mass / free…).
   * Không ghi đè `slot.name` — admin đổi tên hiển thị được (lưu Mongo + variantAttr).
   */
  enforceSlotRoleRules(): void {
    for (let i = 0; i < this.classificationSlots.length && i < FIXED_VARIANT_PRESET_COUNT; i++) {
      const meta = FIXED_VARIANT_PRESETS[i];
      const slot = this.classificationSlots[i];
      if (!meta || !slot) continue;
      slot.role = meta.role;
    }
  }

  /**
   * Sau hydrate: mỗi slot có tên — ưu tiên `variantClassifications[i].name`,
   * rồi `variantAttr{i}Name` (legacy), cuối cùng preset mặc định.
   */
  private applySlotDisplayNamesAfterHydrate(): void {
    const attrKeys = ['variantAttr1Name', 'variantAttr2Name', 'variantAttr3Name', 'variantAttr4Name'] as const;
    const persisted = this.formData.variantClassifications;
    for (let i = 0; i < FIXED_VARIANT_PRESET_COUNT; i++) {
      const slot = this.classificationSlots[i];
      const meta = FIXED_VARIANT_PRESETS[i];
      if (!slot || !meta) continue;
      const row = Array.isArray(persisted) ? persisted[i] : undefined;
      const fromPersisted = String(row?.name || '').trim();
      if (fromPersisted) {
        slot.name = fromPersisted.slice(0, 80);
        continue;
      }
      const fromForm = String(this.formData[attrKeys[i]] || '').trim();
      const isGeneric = /^Phân loại\s+[1-4]$/.test(fromForm);
      if (fromForm && !isGeneric) {
        slot.name = fromForm.slice(0, 80);
        continue;
      }
      if (!String(slot.name || '').trim()) {
        slot.name = meta.name;
      }
    }
  }

  /** Đồng bộ tên cột bảng biến thể (shop) với tên nhóm trên form. */
  private syncVariantAttrNamesFromSlots(): void {
    const fallbacks = ['Phân loại 1', 'Phân loại 2', 'Phân loại 3', 'Phân loại 4'];
    for (let i = 0; i < FIXED_VARIANT_PRESET_COUNT; i++) {
      const raw = String(this.classificationSlots[i]?.name || '').trim().slice(0, 80);
      const meta = FIXED_VARIANT_PRESETS[i];
      const name = raw || meta?.name || fallbacks[i];
      if (i === 0) this.formData.variantAttr1Name = name;
      else if (i === 1) this.formData.variantAttr2Name = name;
      else if (i === 2) this.formData.variantAttr3Name = name;
      else this.formData.variantAttr4Name = name;
    }
  }

  addChipToSlot(index: number, raw?: string): void {
    const slot = this.classificationSlots[index];
    if (!slot) return;
    const value = String(raw ?? slot.draftInput ?? '').trim();
    if (!value) return;
    if (!slot.values.includes(value)) slot.values.push(value);
    slot.draftInput = '';
    const prevN = this.variants.length;
    this.rebuildVariantsFromSlots();
    const added = Math.max(0, this.variants.length - prevN);
    if (added > 0) {
      this.variantFlashMessage = `${added} dòng mới được tạo — hãy điền giá và tồn kho.`;
      this.highlightedVariantRowIndexes.clear();
      for (let i = prevN; i < this.variants.length; i++) {
        this.highlightedVariantRowIndexes.add(i);
      }
      setTimeout(() => {
        this.variantFlashMessage = '';
        this.highlightedVariantRowIndexes.clear();
      }, 8000);
    }
  }

  removeChipFromSlot(slotIndex: number, chipIndex: number): void {
    const slot = this.classificationSlots[slotIndex];
    if (!slot) return;
    const chip = String(slot.values[chipIndex] || '').trim();
    if (!chip) return;

    const activeBefore = this.classificationSlots.filter((s) => s.values.length > 0);
    const wouldRemove = new Set(slot.values);
    wouldRemove.delete(chip);
    const simSlots = this.classificationSlots.map((s, i) =>
      i === slotIndex ? { ...s, values: slot.values.filter((_, j) => j !== chipIndex) } : s
    );
    const activeAfter = simSlots.filter((s) => s.values.length > 0);
    const combosAfter = this.cartesianStrings(activeAfter.map((s) => s.values));
    const labelsAfter = new Set(combosAfter.map((c) => c.map((x) => String(x || '').trim()).join(' | ').toLowerCase()));

    const affected = (this.variants || []).filter((v) => {
      const k = String(v.label || '').trim().toLowerCase();
      return k && !labelsAfter.has(k);
    });
    const hasData = affected.some(
      (v) => Number(v.price || 0) > 0 || Number(v.stock || 0) > 0 || Number(v.oldPrice || 0) > 0
    );
    if (hasData) {
      const ok = confirm(
        `Xóa chip "${chip}" sẽ xóa ${affected.length} dòng biến thể (đã có giá/tồn). Tiếp tục?`
      );
      if (!ok) return;
    } else if (activeBefore.length > 0 && activeAfter.length === 0) {
      const ok = confirm(
        'Xóa hết chip sẽ chỉ còn một dòng biến thể "Mặc định" (nhập giá/tồn ở bảng). Tiếp tục?'
      );
      if (!ok) return;
    }

    slot.values.splice(chipIndex, 1);
    this.rebuildVariantsFromSlots();
  }

  onSlotDraftKeyDown(index: number, event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.addChipToSlot(index);
  }

  /** Placeholder ô nhập chip: nhóm trống vs đã có chip. */
  slotDraftPlaceholder(si: number): string {
    const slot = this.classificationSlots[si];
    return slot?.values?.length ? 'Thêm giá trị, Enter…' : 'Bỏ trống nếu không dùng';
  }

  /** Không cho xóa dòng duy nhất khi chỉ có SP một dòng mặc định (luôn giữ 1 dòng). */
  canRemoveVariantRow(): boolean {
    if (this.isDefaultOnlyProductMode() && this.variants.length === 1) return false;
    return true;
  }

  /** Có ít nhất một chip ở bất kỳ preset nào — ẩn giá/tồn cấp SP. */
  hasAnyClassificationChip(): boolean {
    return this.classificationSlots.some((s) => s.values.length > 0);
  }

  /**
   * Kiểm tra dòng biến thể trước khi submit.
   * Dòng tick "Ẩn shop" (isActive === false) = combo không bán — không bắt giá/tồn.
   */
  private validateVariantRowsBeforeSubmit(): string | null {
    if (!this.variants.length) return null;
    const active = this.variants.filter((v) => v.isActive !== false);
    if (!active.length) {
      return 'Cần ít nhất một dòng đang bán (bỏ tick "Ẩn shop" ở một dòng).';
    }
    for (let i = 0; i < this.variants.length; i++) {
      const v = this.variants[i];
      if (v.isActive === false) continue;
      const price = Number(v.price || 0);
      const stock = Number(v.stock || 0);
      if (price <= 0) {
        return `Dòng biến thể "${v.label || '#' + (i + 1)}" chưa có giá bán (> 0).`;
      }
      if (stock < 0 || !Number.isFinite(stock)) {
        return `Dòng "${v.label || '#' + (i + 1)}" tồn kho không hợp lệ.`;
      }
    }
    return null;
  }

  /** Format VNĐ cho ô tóm tắt (chuỗi sẵn — không dùng pipe number trên cả dải min–max). */
  private formatSummaryVnd(n: number): string {
    const x = Math.round(Number(n) || 0);
    return `${x.toLocaleString('vi-VN')}đ`;
  }

  /** Giá các dòng đang list (Ẩn shop không tính). */
  private listedVariantPriceNumbers(): number[] {
    if (!this.variants.length) {
      const p = Number(this.formData.price || 0);
      return Number.isFinite(p) ? [p] : [];
    }
    return this.variants
      .filter((v) => v.isActive !== false)
      .map((v) => Number(v.price || 0))
      .filter((n) => Number.isFinite(n));
  }

  /** Khoảng giá bán thấp nhất – cao nhất (tóm tắt nhanh). */
  summaryPriceDisplay(): string {
    const nums = this.listedVariantPriceNumbers();
    if (!nums.length) return this.formatSummaryVnd(0);
    const lo = Math.min(...nums);
    const hi = Math.max(...nums);
    if (lo === hi) return this.formatSummaryVnd(lo);
    return `${this.formatSummaryVnd(lo)} – ${this.formatSummaryVnd(hi)}`;
  }

  /** Giá cũ (chỉ dòng có oldPrice > 0); min–max nếu nhiều mức. */
  summaryOldPriceDisplay(): string {
    if (!this.variants.length) {
      const o = Number(this.formData.oldPrice || 0);
      return o > 0 ? this.formatSummaryVnd(o) : '';
    }
    const nums = this.variants
      .filter((v) => v.isActive !== false)
      .map((v) => Number(v.oldPrice || 0))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!nums.length) return '';
    const lo = Math.min(...nums);
    const hi = Math.max(...nums);
    if (lo === hi) return this.formatSummaryVnd(lo);
    return `${this.formatSummaryVnd(lo)} – ${this.formatSummaryVnd(hi)}`;
  }

  summaryStockTotal(): number {
    if (this.variants.length) {
      return this.variants.reduce((s, v) => s + Number(v.stock || 0), 0);
    }
    return Number(this.formData.stock || 0);
  }

  /**
   * Thanh "Phân loại": ưu tiên chip preset → suy từ dòng biến thể → weights/packagingTypes cũ → chuỗi `weight`.
   * Tránh "—" khi SP thực tế có 1 khối lượng + 1 đóng gói nhưng form chưa có chip / đang dùng legacy.
   */
  summaryClassificationLine(): string {
    const parts: string[] = [];
    this.classificationSlots.forEach((s, i) => {
      if (!s.values.length) return;
      const meta = FIXED_VARIANT_PRESETS[i];
      const label = meta?.name || s.name;
      parts.push(`${label}: ${s.values.join(', ')} (${s.values.length} mức)`);
    });
    if (parts.length) return parts.join(' · ');

    const fromV = this.summaryClassificationFromVariantRows();
    if (fromV) return fromV;

    const wLabels = (this.formData.weights || [])
      .map((w: { label?: string }) => String(w?.label || '').trim())
      .filter(Boolean);
    const packs = (Array.isArray(this.formData.packagingTypes) ? this.formData.packagingTypes : [])
      .map((x: string) => String(x || '').trim())
      .filter(Boolean);
    if (wLabels.length) {
      parts.push(
        `${FIXED_VARIANT_PRESETS[0].name}: ${wLabels.join(', ')} (${wLabels.length} mức)`
      );
    }
    if (packs.length) {
      parts.push(
        `${FIXED_VARIANT_PRESETS[1].name}: ${packs.join(', ')} (${packs.length} mức)`
      );
    }
    if (parts.length) return parts.join(' · ');

    const wField = String(this.formData.weight || '').trim();
    if (wField) return wField;

    return '—';
  }

  /** Gom giá trị khác nhau theo từng chiều attr1..4 → nhãn preset 0..3. */
  private summaryClassificationFromVariantRows(): string {
    const list = this.variants || [];
    if (!list.length) return '';
    const dims: string[][] = [[], [], [], []];
    list.forEach((v) => {
      const p = this.parseVariantParts(v);
      if (p.a1) dims[0].push(p.a1);
      if (p.a2) dims[1].push(p.a2);
      if (p.a3) dims[2].push(p.a3);
      if (p.a4) dims[3].push(p.a4);
    });
    const parts: string[] = [];
    for (let i = 0; i < 4; i++) {
      const uniq = this.uniqueTextList(dims[i]);
      if (!uniq.length) continue;
      const slot = this.classificationSlots[i];
      const meta = FIXED_VARIANT_PRESETS[i];
      const label = String(slot?.name || '').trim() || meta?.name || `Chiều ${i + 1}`;
      parts.push(`${label}: ${uniq.join(', ')} (${uniq.length} mức)`);
    }
    return parts.join(' · ');
  }

  /**
   * Tóm tắt biến thể: dòng đang list vs Ẩn shop (`isActive !== false`).
   * Không lọc tồn — hết hàng vẫn tính một dòng đang list.
   */
  summaryVariantCountText(): string {
    const n = this.variants.length;
    if (n > 0) {
      const listed = this.variants.filter((v) => v.isActive !== false).length;
      const hidden = n - listed;
      if (hidden > 0) {
        return `${listed} dòng đang bán · ${hidden} ẩn`;
      }
      return `${listed} dòng đang bán`;
    }
    const p = Number(this.formData.price || 0);
    if (p > 0) return '1 biến thể (cấp SP)';
    return '0 dòng';
  }

  /** Badge trạng thái tổng (đủ / chưa đủ) cho ô Biến thể. */
  summaryVariantOverallStatus(): 'ok' | 'miss' {
    if (this.variants.length > 0) {
      const active = this.variants.filter((v) => v.isActive !== false);
      if (!active.length) return 'miss';
      const allOk = active.every((v) => {
        const price = Number(v.price || 0);
        const stock = Number(v.stock || 0);
        return price > 0 && stock > 0;
      });
      return allOk ? 'ok' : 'miss';
    }
    const p = Number(this.formData.price || 0);
    const s = Number(this.formData.stock || 0);
    return p > 0 && s > 0 ? 'ok' : 'miss';
  }

  summaryVariantBadgeLabel(): string {
    return this.summaryVariantOverallStatus() === 'ok' ? 'Đủ' : 'Chưa đủ';
  }

  variantRowStatus(i: number): 'ok' | 'missing' | 'inactive' {
    const v = this.variants[i];
    if (!v) return 'missing';
    if (v.isActive === false) return 'inactive';
    const price = Number(v.price || 0);
    const stock = Number(v.stock || 0);
    // Spec: "Đủ" = đã có giá và tồn > 0 (tồn 0 vẫn coi là chưa đủ để bán).
    if (price > 0 && stock > 0) return 'ok';
    return 'missing';
  }

  variantRowStatusLabel(i: number): string {
    const s = this.variantRowStatus(i);
    if (s === 'inactive') return 'Ẩn shop';
    return s === 'ok' ? 'Đủ' : 'Chưa điền';
  }

  /** Tick "Ẩn shop": combo không tồn tại (vd. 500g + túi zip) — không bắt nhập giá. */
  onVariantShopHideToggle(i: number, hideChecked: boolean): void {
    const row = this.variants[i];
    if (!row) return;
    row.isActive = !hideChecked;
  }

  variantRowNeedsAttention(i: number): boolean {
    const v = this.variants[i];
    if (!v) return false;
    if (v.isActive === false) return false;
    return Number(v.price || 0) <= 0 || Number(v.stock || 0) <= 0;
  }

  variantRowHighlight(i: number): boolean {
    return this.highlightedVariantRowIndexes.has(i);
  }

  private validateSlotRolesClient(): string | null {
    let massN = 0;
    let volN = 0;
    this.classificationSlots.forEach((s) => {
      if (s.role === 'mass') massN++;
      if (s.role === 'volume') volN++;
    });
    if (massN > 1) return 'Chỉ được tối đa một nhóm Khối lượng.';
    if (volN > 1) return 'Chỉ được tối đa một nhóm Thể tích.';
    if (massN && volN) return 'Không được vừa có nhóm Khối lượng vừa có nhóm Thể tích.';
    return null;
  }

  private deriveQuantityKindFromSlots(): 'none' | 'mass' | 'volume' {
    if (this.classificationSlots.some((s) => s.role === 'mass')) return 'mass';
    if (this.classificationSlots.some((s) => s.role === 'volume')) return 'volume';
    return 'none';
  }

  private cartesianStrings(arrays: string[][]): string[][] {
    if (!arrays.length) return [[]];
    return arrays.reduce(
      (acc, curr) => acc.flatMap((prefix) => curr.map((c) => [...prefix, c])),
      [[]] as string[][]
    );
  }

  /**
   * Sinh bảng biến thể từ tích Descartes các preset đang có chip (bỏ qua nhóm rỗng).
   * Không có chip → luôn 1 dòng "Mặc định" (giá/tồn = cấp SP / gộp từ dòng cũ).
   */
  rebuildVariantsFromSlots(): void {
    const active = this.classificationSlots.filter((s) => s.values.length > 0);
    if (!active.length) {
      this.fillDefaultSingleVariant(this.variants.slice());
      return;
    }

    const oldByLabel = new Map<string, ProductVariant>();
    (this.variants || []).forEach((v) => {
      const k = String(v.label || '').trim().toLowerCase();
      if (k) oldByLabel.set(k, v);
    });

    const combos = this.cartesianStrings(active.map((s) => s.values));
    const dim = active.length;

    for (let i = 0; i < dim; i++) {
      const nm = active[i].name || `Chiều ${i + 1}`;
      if (i === 0) this.formData.variantAttr1Name = nm;
      else if (i === 1) this.formData.variantAttr2Name = nm;
      else if (i === 2) this.formData.variantAttr3Name = nm;
      else if (i === 3) this.formData.variantAttr4Name = nm;
    }
    const defaults = ['Phân loại 1', 'Phân loại 2', 'Phân loại 3', 'Phân loại 4'];
    for (let j = dim; j < 4; j++) {
      const key = `variantAttr${j + 1}Name` as keyof Product;
      (this.formData as any)[key] = defaults[j];
    }

    const next: ProductVariant[] = [];
    for (const c of combos) {
      const parts = c.map((x) => String(x || '').trim());
      const label = parts.join(' | ');
      const found = oldByLabel.get(label.toLowerCase());
      next.push({
        _id: found?._id,
        label,
        attr1Value: parts[0] || '',
        attr2Value: parts[1] || '',
        attr3Value: parts[2] || '',
        attr4Value: parts[3] || '',
        image: String(found?.image || '').trim(),
        price: Number(found?.price || 0),
        oldPrice: Number(found?.oldPrice || 0),
        stock: Number(found?.stock || 0),
        isActive: found?.isActive !== false
      });
    }

    const seed =
      next.length === 1 &&
      !next[0]._id &&
      Number(next[0].price) === 0 &&
      Number(next[0].stock) === 0 &&
      Number(this.formData.price || 0) > 0;
    if (seed) {
      next[0].price = Number(this.formData.price || 0);
      next[0].oldPrice = Number(this.formData.oldPrice || 0);
      next[0].stock = Number(this.formData.stock || 0);
    }

    this.variants = next;
    this.syncWeightSummaryFromVariants();
  }

  /**
   * Một dòng biến thể khi không có chip: nhãn cố định "Mặc định", cột 1 = Nhãn.
   * `previousRows`: snapshot trước khi xóa / rebuild để giữ giá/tồn / _id.
   */
  private fillDefaultSingleVariant(previousRows: ProductVariant[]): void {
    const old = previousRows || [];
    const price = old.length ? Number(old[0].price || 0) : Number(this.formData.price || 0);
    const stock = old.length ? old.reduce((s, v) => s + Number(v.stock || 0), 0) : Number(this.formData.stock || 0);
    const oldPrice = old[0] ? Number(old[0].oldPrice || 0) : Number(this.formData.oldPrice || 0);
    const img = old.length === 1 ? String(old[0].image || '').trim() : '';
    const id = old.length === 1 ? old[0]._id : undefined;

    const defaults = ['Nhãn', 'Phân loại 2', 'Phân loại 3', 'Phân loại 4'];
    for (let j = 0; j < 4; j++) {
      const key = `variantAttr${j + 1}Name` as keyof Product;
      (this.formData as any)[key] = defaults[j];
    }

    const row: ProductVariant = {
      _id: id,
      label: 'Mặc định',
      attr1Value: 'Mặc định',
      attr2Value: '',
      attr3Value: '',
      attr4Value: '',
      image: img,
      price,
      oldPrice,
      stock,
      isActive: true
    };
    if (!row.price && Number(this.formData.price || 0) > 0) {
      row.price = Number(this.formData.price || 0);
      row.oldPrice = Number(this.formData.oldPrice || 0);
      row.stock = Number(this.formData.stock || 0);
    }

    this.variants = [row];
    this.syncWeightSummaryFromVariants();
  }

  /** SP chỉ có một dòng mặc định, không dùng chip phân loại. */
  private isDefaultOnlyProductMode(): boolean {
    return (
      this.variants.length === 1 &&
      !this.hasAnyClassificationChip() &&
      this.isDefaultVariantRow(this.variants[0])
    );
  }

  private isDefaultVariantRow(v: ProductVariant | undefined): boolean {
    if (!v) return false;
    return String(v.label || '').trim() === 'Mặc định' || String(v.attr1Value || '').trim() === 'Mặc định';
  }

  /**
   * Ô "Tóm tắt phân loại" bind `formData.weight` — trước đây chỉ cập nhật khi Lưu
   * nên dễ lệch với bảng biến thể (vd. vẫn "500g / Túi zip" trong khi chỉ còn 200g).
   */
  private syncWeightSummaryFromVariants(): void {
    if (!this.variants?.length) {
      this.formData.weight = '';
      return;
    }
    // Không ghi đè `weight` bằng chữ "Mặc định" khi chỉ có một dòng không chip.
    if (this.isDefaultOnlyProductMode()) return;
    this.formData.weight = this.variants.map((v) => v.label).join(', ');
  }

  private normalizeBeforeSave(): void {
    this.formData.badge = null;
    this.formData.name = String(this.formData.name || '').trim();
    this.formData.cat = String(this.formData.cat || '').trim();
    this.formData.isHidden = !!this.formData.isHidden;
    this.formData.isOutOfStock = !!this.formData.isOutOfStock;
    // Đóng gói chỉ qua preset "Loại đóng gói" — không dùng field packagingTypes riêng.
    this.formData.packagingTypes = [];

    this.classificationSlots.forEach((s) => {
      s.values = this.uniqueTextList(s.values);
    });

    this.variants = (this.variants || [])
      .map((v) => {
        const a1 = String(v.attr1Value || '').trim();
        const a2 = String(v.attr2Value || '').trim();
        const a3 = String(v.attr3Value || '').trim();
        const a4 = String(v.attr4Value || '').trim();
        const parsed = this.parseVariantParts(v);
        const fa1 = a1 || parsed.a1;
        const fa2 = a2 || parsed.a2;
        const fa3 = a3 || parsed.a3;
        const fa4 = a4 || parsed.a4;
        const label = [fa1, fa2, fa3, fa4].filter(Boolean).join(' | ') || String(v.label || '').trim();
        return {
          _id: v._id,
          attr1Value: fa1,
          attr2Value: fa2,
          attr3Value: fa3,
          attr4Value: fa4,
          label,
          image: String(v.image || '').trim(),
          price: Math.max(0, Number(v.price || 0)),
          stock: Math.max(0, Number(v.stock || 0)),
          oldPrice: Math.max(0, Number(v.oldPrice || 0)),
          isActive: v.isActive !== false
        };
      })
      .filter((v) => !!v.label);

    this.formData.variantClassifications = this.classificationSlots.map((s) => ({
      role: s.role,
      name: String(s.name || '').trim().slice(0, 80),
      values: this.uniqueTextList(s.values)
    }));

    this.syncVariantAttrNamesFromSlots();

    this.formData.variantQuantityKind = this.deriveQuantityKindFromSlots();

    if (this.variants.length > 0) {
      this.formData.variants = this.variants;
      this.formData.price = this.variants[0].price;
      this.formData.oldPrice = this.variants[0].oldPrice || 0;
      this.formData.stock = this.variants.reduce((sum, v) => sum + Number(v.stock || 0), 0);
      this.formData.weight = this.variants.map((v) => v.label).join(', ');
    } else {
      this.formData.variants = [];
    }

    this.formData.nutrition = (this.nutritions || [])
      .map((n) => ({
        name: String(n.name || '').trim(),
        value: String(n.value || '').trim(),
        percent: Math.max(0, Number(n.percent || 0))
      }))
      .filter((n) => n.name || n.value);
  }

  setupVariants(): void {
    const variants = Array.isArray(this.formData.variants) ? this.formData.variants : [];
    if (variants.length > 0) {
      this.variants = variants.map((v) => {
        let a1 = String(v.attr1Value || '').trim();
        let a2 = String(v.attr2Value || '').trim();
        let a3 = String(v.attr3Value || '').trim();
        let a4 = String(v.attr4Value || '').trim();
        const parsed = this.parseVariantParts(v);
        if (!a1) a1 = parsed.a1;
        if (!a2) a2 = parsed.a2;
        if (!a3) a3 = parsed.a3;
        if (!a4) a4 = parsed.a4;
        const label = [a1, a2, a3, a4].filter(Boolean).join(' | ') || String(v.label || '').trim();
        return {
          _id: v._id,
          label,
          attr1Value: a1,
          attr2Value: a2,
          attr3Value: a3,
          attr4Value: a4,
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
      attr3Value: '',
      attr4Value: '',
      price: 0,
      stock: 0,
      oldPrice: 0,
      isActive: true
    });
  }

  removeVariant(index: number): void {
    const snapshot = this.variants.slice();
    this.variants.splice(index, 1);
    if (this.hasAnyClassificationChip() && this.variants.length === 0) {
      // Còn chip: sinh lại toàn bộ tổ hợp (tránh bảng trống).
      this.rebuildVariantsFromSlots();
      return;
    }
    if (!this.hasAnyClassificationChip() && this.variants.length === 0) {
      this.fillDefaultSingleVariant(snapshot);
    }
  }

  /** Đọc tối đa 4 chiều từ attr hoặc label "A | B | C | D". */
  private parseVariantParts(v: any): { a1: string; a2: string; a3: string; a4: string } {
    const a1 = String(v?.attr1Value ?? '').trim();
    const a2 = String(v?.attr2Value ?? '').trim();
    const a3 = String(v?.attr3Value ?? '').trim();
    const a4 = String(v?.attr4Value ?? '').trim();
    if (a1 || a2 || a3 || a4) return { a1, a2, a3, a4 };
    const raw = String(v?.label || '').trim();
    if (!raw) return { a1: '', a2: '', a3: '', a4: '' };
    const parts = raw.split('|').map((x: string) => x.trim()).filter(Boolean);
    return {
      a1: parts[0] || '',
      a2: parts[1] || '',
      a3: parts[2] || '',
      a4: parts[3] || ''
    };
  }

  private uniqueTextList(list: string[]): string[] {
    return (list || [])
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .filter((x, i, arr) => arr.indexOf(x) === i);
  }

  private normalizeVariantQuantityKindField(): 'none' | 'mass' | 'volume' {
    const k = String(this.formData.variantQuantityKind || '').toLowerCase().trim();
    if (k === 'mass' || k === 'volume') return k;
    return 'none';
  }

  private textHasVolumeQuantityHint(text: string): boolean {
    const s = String(text || '').toLowerCase();
    if (/\d[\d.,]*\s*(ml|mℓ)\b/.test(s)) return true;
    if (/\d[\d.,]*\s*l\b/.test(s)) return true;
    if (/\b(lít|liter|litre)\b/.test(s)) return true;
    return false;
  }

  private textHasMassQuantityHint(text: string): boolean {
    const s = String(text || '').toLowerCase();
    if (/\d[\d.,]*\s*(g|gr|gram|grams)\b/.test(s)) return true;
    if (/\d[\d.,]*\s*kg\b/.test(s)) return true;
    if (/\bkg\b/.test(s)) return true;
    return false;
  }

  private variantQuantityProbe(v: ProductVariant): string {
    return [v.label, v.attr1Value, v.attr2Value, v.attr3Value, v.attr4Value]
      .map((x) => String(x || '').trim())
      .join(' ');
  }

  private validateVariantQuantityKindForForm(): string | null {
    const k = this.formData.variantQuantityKind || this.deriveQuantityKindFromSlots();
    const list = this.variants || [];
    if (list.length === 0) return null;
    for (const v of list) {
      if (v.isActive === false) continue;
      const probe = this.variantQuantityProbe(v);
      const hasV = this.textHasVolumeQuantityHint(probe);
      const hasM = this.textHasMassQuantityHint(probe);
      if (k === 'mass' && hasV) {
        return `Kiểu "khối lượng": biến thể "${v.label}" có dấu hiệu thể tích (ml/l). Đổi loại nhóm hoặc sửa nhãn.`;
      }
      if (k === 'volume' && hasM) {
        return `Kiểu "thể tích": biến thể "${v.label}" có dấu hiệu khối lượng (g/kg). Đổi loại nhóm hoặc sửa nhãn.`;
      }
      if (k === 'none' && hasM && hasV) {
        return `Biến thể "${v.label}" vừa có g/kg vừa có ml/l. Tách SP hoặc dùng một nhóm Khối lượng / Thể tích.`;
      }
    }
    return null;
  }

  setupNutritions(): void {
    const src = Array.isArray(this.formData.nutrition) ? this.formData.nutrition : [];
    this.nutritions = src.map((n) => ({
      name: String(n?.name || '').trim(),
      value: String(n?.value || '').trim(),
      percent: Math.max(0, Number(n?.percent || 0))
    }));
  }

  addNutrition(): void {
    this.nutritions.push({ name: '', value: '', percent: 0 });
  }

  removeNutrition(index: number): void {
    this.nutritions.splice(index, 1);
  }

  imagePreview: string[] = [];

  /**
   * Sau khi đóng hộp thoại chọn file (Chọn hoặc Hủy), Chrome/Windows đôi khi bắn thêm một click "ma"
   * trúng nút Quay lại / HỦY ở component cha → vô tình đóng form. Giữ cờ ngắn để cha bỏ qua đóng editor.
   */
  private filePickerGhostGuardUntil = 0;

  /** Gọi từ (cancel) trên input file, hoặc ngay kể từ (change) sau khi hộp thoại đã đóng. */
  onNativeFilePickerDismissed(): void {
    this.filePickerGhostGuardUntil = Date.now() + 480;
  }

  /** Cha (trang danh sách + editor) gọi trước khi đóng editor — tránh nuốt click thật của user sau guard. */
  isFilePickerGhostGuardActive(): boolean {
    return Date.now() < this.filePickerGhostGuardUntil;
  }

  onImageSelect(event: any): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    // Một số trình duyệt vẫn fire change khi user hủy (danh sách file rỗng).
    if (!file) {
      this.onNativeFilePickerDismissed();
      input.value = '';
      return;
    }

    this.onNativeFilePickerDismissed();

    const formData = new FormData();
    formData.append('image', file);

    this.http.post<{ url: string }>(`${ADMIN_API_BASE}/products/upload-image`, formData).subscribe({
      next: (res) => {
        if (!this.formData.images) this.formData.images = [];
        this.formData.images.push(res.url);
        this.imagePreview.push(this.staticBase + res.url);
      },
      error: (err) => console.error(err)
    });
  }

  removeImage(index: number): void {
    this.formData.images?.splice(index, 1);
    this.imagePreview.splice(index, 1);
  }

  onVariantImageSelect(index: number, event: any): void {
    const input = event?.target as HTMLInputElement | undefined;
    const file = input?.files?.[0];
    if (!file || !this.variants[index]) {
      if (!file && input) {
        this.onNativeFilePickerDismissed();
        input.value = '';
      }
      return;
    }

    this.onNativeFilePickerDismissed();

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

  /** Số chiều đang dùng (1–4) — layout bảng biến thể. */
  activeVariantDimensions(): number {
    const n = this.classificationSlots.filter((s) => s.values.length > 0).length;
    if (n > 0) return Math.min(n, 4);
    return this.variants.length ? 1 : 0;
  }
}
