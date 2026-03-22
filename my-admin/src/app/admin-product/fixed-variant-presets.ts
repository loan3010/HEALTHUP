/**
 * Bốn nhóm preset cố định trên form sản phẩm (spec UX).
 * Không còn dropdown “loại nhóm” / tên tự do cho 4 ô này.
 */
import { ClassificationRole, VariantClassificationSlot } from './variant-classification.models';

export const FIXED_VARIANT_PRESET_COUNT = 4;

export interface FixedPresetMeta {
  /** Khóa ổn định — không gửi Mongo, chỉ để map UI. */
  id: string;
  role: ClassificationRole;
  /** Tên hiển thị cố định (shop + bảng biến thể). */
  name: string;
  hint: string;
  /** Viết tắt hiển thị trong ô màu (KL, DG, …). */
  abbrev: string;
}

export const FIXED_VARIANT_PRESETS: FixedPresetMeta[] = [
  { id: 'mass', role: 'mass', name: 'Khối lượng', hint: 'VD: 100g, 500g, 1kg', abbrev: 'KL' },
  { id: 'pack', role: 'free', name: 'Loại đóng gói', hint: 'VD: Túi zip, Hộp, Gói', abbrev: 'DG' },
  { id: 'flavor', role: 'free', name: 'Hương vị', hint: 'VD: Dâu, Socola…', abbrev: 'HV' },
  { id: 'size', role: 'free', name: 'Kích cỡ / Size', hint: 'VD: S, M, L, XL', abbrev: 'SZ' }
];

/** Sinh 4 slot rỗng đúng thứ tự preset. */
export function emptyFixedClassificationSlots(): VariantClassificationSlot[] {
  return FIXED_VARIANT_PRESETS.map((p) => ({
    role: p.role,
    name: p.name,
    values: [],
    draftInput: ''
  }));
}
