/**
 * Chuỗi tóm tắt phân loại biến thể cho bảng danh sách SP (đồng bộ ý với product-form summaryClassificationLine).
 * Không phụ thuộc Component — dễ test và tái dùng.
 */
import type { Product } from './product.service';
import { FIXED_VARIANT_PRESET_COUNT, FIXED_VARIANT_PRESETS } from './fixed-variant-presets';

function uniqueTextList(list: string[]): string[] {
  return (list || [])
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .filter((x, i, arr) => arr.indexOf(x) === i);
}

/** Giống parseVariantParts trong product-form. */
function parseVariantParts(v: any): { a1: string; a2: string; a3: string; a4: string } {
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

function summaryFromVariantRows(variants: any[] | undefined): string {
  const list = variants || [];
  if (!list.length) return '';
  const dims: string[][] = [[], [], [], []];
  list.forEach((v) => {
    const p = parseVariantParts(v);
    if (p.a1) dims[0].push(p.a1);
    if (p.a2) dims[1].push(p.a2);
    if (p.a3) dims[2].push(p.a3);
    if (p.a4) dims[3].push(p.a4);
  });
  const parts: string[] = [];
  for (let i = 0; i < 4; i++) {
    const uniq = uniqueTextList(dims[i]);
    if (!uniq.length) continue;
    const label = FIXED_VARIANT_PRESETS[i]?.name || `Chiều ${i + 1}`;
    parts.push(`${label}: ${uniq.join(', ')} (${uniq.length} mức)`);
  }
  return parts.join(' · ');
}

/**
 * Một dòng hiển thị trong admin (danh sách / có thể dùng tooltip).
 */
export function buildProductClassificationSummary(p: Partial<Product>): string {
  const parts: string[] = [];
  const vc = p.variantClassifications;

  if (Array.isArray(vc) && vc.length > 0) {
    for (let i = 0; i < FIXED_VARIANT_PRESET_COUNT; i++) {
      const row = vc[i] as { name?: string; values?: string[] } | undefined;
      const vals = uniqueTextList(row?.values || []);
      if (!vals.length) continue;
      const label =
        String(row?.name || FIXED_VARIANT_PRESETS[i]?.name || '').trim() || `Nhóm ${i + 1}`;
      parts.push(`${label}: ${vals.join(', ')} (${vals.length} mức)`);
    }
    if (parts.length) return parts.join(' · ');
  }

  const fromV = summaryFromVariantRows(p.variants);
  if (fromV) return fromV;

  const wLabels = (p.weights || [])
    .map((w) => String(w?.label || '').trim())
    .filter(Boolean);
  const packs = (Array.isArray(p.packagingTypes) ? p.packagingTypes : [])
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  const legacy: string[] = [];
  if (wLabels.length) {
    legacy.push(
      `${FIXED_VARIANT_PRESETS[0].name}: ${wLabels.join(', ')} (${wLabels.length} mức)`
    );
  }
  if (packs.length) {
    legacy.push(
      `${FIXED_VARIANT_PRESETS[1].name}: ${packs.join(', ')} (${packs.length} mức)`
    );
  }
  if (legacy.length) return legacy.join(' · ');

  const wField = String(p.weight || '').trim();
  if (wField) return wField;

  return '—';
}
