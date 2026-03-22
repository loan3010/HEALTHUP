/**
 * Mô hình nhóm phân loại biến thể (admin).
 * Tối đa 3 nhóm; mỗi nhóm UI dạng chip giống mẫu (ô nhập + Thêm + tag).
 * Khối lượng (mass) và thể tích (volume) loại trừ nhau — tối đa 1 nhóm mỗi loại.
 */

/** Số nhóm preset cố định (khối lượng, đóng gói, hương vị, size). */
export const MAX_CLASSIFICATION_SLOTS = 4;

export type ClassificationRole = 'free' | 'mass' | 'volume';

/** Dữ liệu lưu Mongo / gửi API (không có ô nháp draft). */
export interface VariantClassificationPersisted {
  role: ClassificationRole;
  name: string;
  values: string[];
}

/** Một nhóm trên form — có draftInput khi gõ trước khi bấm Thêm. */
export interface VariantClassificationSlot extends VariantClassificationPersisted {
  draftInput: string;
}

/** Tên mặc định theo loại nhóm (admin có thể sửa). */
export function defaultNameForRole(role: ClassificationRole): string {
  if (role === 'mass') return 'Khối lượng';
  if (role === 'volume') return 'Dung tích';
  return 'Phân loại';
}
