/**
 * Chuẩn hóa variantClassifications (+ variants khi cần) cho sản phẩm cũ.
 *
 * Mục tiêu (khớp admin product-form):
 * - 1 KL × 1 đóng gói → 1 dòng biến thể; 2 KL × 1 đóng gói → 2 dòng (Descartes).
 * - Suy chip từ variants[].attr / label "A | B | C | D" giống inferSlotsFromLegacyIntoFourPresets.
 * - Bổ sung slot trống từ weights[] / packagingTypes[] (legacy).
 * - SP không có variants[] nhưng có weights/packaging + price/stock → tạo 1 variant + classifications.
 *
 * Usage:
 *   node scripts/backfill-product-variant-classifications.js --dry-run
 *   node scripts/backfill-product-variant-classifications.js --write
 *   node scripts/backfill-product-variant-classifications.js --write --force-rebuild-vc
 *
 * --force-rebuild-vc: ghi đè variantClassifications từ variants (kể cả khi DB đã có chip).
 *                     Chỉ dùng khi cần đồng bộ lại hàng loạt; có thể phá chỉnh tay lệch schema.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Product = require('../models/Product');

const PRESET_COUNT = 4;
/** Khớp my-admin fixed-variant-presets.ts */
const PRESETS = [
  { role: 'mass', name: 'Khối lượng' },
  { role: 'free', name: 'Loại đóng gói' },
  { role: 'free', name: 'Hương vị' },
  { role: 'free', name: 'Kích cỡ / Size' }
];

function uniqueList(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    const s = String(x || '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function parseVariantParts(v) {
  const a1 = String(v?.attr1Value ?? '').trim();
  const a2 = String(v?.attr2Value ?? '').trim();
  const a3 = String(v?.attr3Value ?? '').trim();
  const a4 = String(v?.attr4Value ?? '').trim();
  if (a1 || a2 || a3 || a4) return { a1, a2, a3, a4 };
  const raw = String(v?.label || '').trim();
  if (!raw) return { a1: '', a2: '', a3: '', a4: '' };
  const parts = raw.split('|').map((x) => x.trim()).filter(Boolean);
  return {
    a1: parts[0] || '',
    a2: parts[1] || '',
    a3: parts[2] || '',
    a4: parts[3] || ''
  };
}

function emptyClassifications() {
  return PRESETS.map((p) => ({ role: p.role, name: p.name, values: [] }));
}

/** Suy 4 slot từ variants (giống inferSlotsFromLegacyIntoFourPresets). */
function inferClassificationsFromVariants(variants) {
  const bases = emptyClassifications();
  const rawVs = Array.isArray(variants) ? variants : [];
  if (!rawVs.length) return bases;

  let maxD = 1;
  rawVs.forEach((v) => {
    const p = parseVariantParts(v);
    if (p.a4) maxD = 4;
    else if (p.a3) maxD = Math.max(maxD, 3);
    else if (p.a2) maxD = Math.max(maxD, 2);
  });

  const collect = (dim) => {
    const set = new Set();
    rawVs.forEach((v) => {
      const p = parseVariantParts(v);
      const val = [p.a1, p.a2, p.a3, p.a4][dim];
      if (val) set.add(val);
    });
    return Array.from(set);
  };

  for (let d = 0; d < maxD && d < PRESET_COUNT; d++) {
    bases[d].values = collect(d);
  }
  return bases;
}

/**
 * Gắn weights → slot 0, packagingTypes → slot 1 nếu slot đang trống.
 */
function mergeLegacyWeightsPackaging(classifications, weights, packagingTypes) {
  const wLabels = (weights || [])
    .map((w) => String(w?.label || '').trim())
    .filter(Boolean);
  if (classifications[0] && !classifications[0].values.length && wLabels.length) {
    classifications[0].values = uniqueList(wLabels);
  }
  const packs = (Array.isArray(packagingTypes) ? packagingTypes : [])
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  if (classifications[1] && !classifications[1].values.length && packs.length) {
    classifications[1].values = uniqueList(packs);
  }
}

function finalizeClassifications(rows) {
  return PRESETS.map((meta, i) => ({
    role: meta.role,
    name: meta.name,
    values: uniqueList(rows[i]?.values || [])
  }));
}

function classificationsEffectivelyEmpty(vc) {
  if (!Array.isArray(vc) || vc.length === 0) return true;
  return !vc.some((row) => Array.isArray(row.values) && row.values.length > 0);
}

function deriveQuantityKind(classifications) {
  if (classifications[0]?.values?.length && classifications[0].role === 'mass') return 'mass';
  return 'none';
}

/**
 * SP chỉ có weights/packaging + giá cấp SP, chưa có variants[].
 */
function buildVariantAndClassificationsFromLegacyProduct(product) {
  const wLabels = (product.weights || [])
    .map((w) => String(w?.label || '').trim())
    .filter(Boolean);
  const packs = (Array.isArray(product.packagingTypes) ? product.packagingTypes : [])
    .map((x) => String(x || '').trim())
    .filter(Boolean);

  const w1 = wLabels[0] || '';
  const p1 = packs[0] || '';
  const price = Math.max(0, Number(product.price || 0));
  const stock = Math.max(0, Number(product.stock ?? 0));
  const oldPrice = Math.max(0, Number(product.oldPrice || 0));

  const classifications = finalizeClassifications(emptyClassifications());
  if (w1) classifications[0].values = uniqueList(wLabels);
  if (p1) classifications[1].values = uniqueList(packs);

  let variantRow;
  if (w1 && p1) {
    variantRow = {
      label: `${w1} | ${p1}`,
      attr1Value: w1,
      attr2Value: p1,
      attr3Value: '',
      attr4Value: '',
      image: '',
      price,
      stock,
      oldPrice,
      isActive: true
    };
  } else if (w1 && !p1) {
    variantRow = {
      label: w1,
      attr1Value: w1,
      attr2Value: '',
      attr3Value: '',
      attr4Value: '',
      image: '',
      price,
      stock,
      oldPrice,
      isActive: true
    };
  } else if (!w1 && p1) {
    variantRow = {
      label: p1,
      attr1Value: '',
      attr2Value: p1,
      attr3Value: '',
      attr4Value: '',
      image: '',
      price,
      stock,
      oldPrice,
      isActive: true
    };
  } else {
    variantRow = {
      label: 'Mặc định',
      attr1Value: 'Mặc định',
      attr2Value: '',
      attr3Value: '',
      attr4Value: '',
      image: '',
      price,
      stock,
      oldPrice,
      isActive: true
    };
  }

  return { classifications, variants: [variantRow], variantQuantityKind: deriveQuantityKind(classifications) };
}

function buildUpdatePayload(product, { forceRebuildVc }) {
  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  const vcEmpty = classificationsEffectivelyEmpty(product.variantClassifications);
  const hasLegacy =
    (product.weights && product.weights.length > 0) ||
    (Array.isArray(product.packagingTypes) && product.packagingTypes.length > 0);

  let classifications;
  let newVariants = null;
  let variantQuantityKind;

  if (hasVariants) {
    if (forceRebuildVc || vcEmpty) {
      classifications = inferClassificationsFromVariants(product.variants);
      mergeLegacyWeightsPackaging(
        classifications,
        product.weights,
        product.packagingTypes
      );
      classifications = finalizeClassifications(classifications);
      variantQuantityKind = deriveQuantityKind(classifications);
      return {
        $set: {
          variantClassifications: classifications,
          variantQuantityKind,
          variantAttr1Name: PRESETS[0].name,
          variantAttr2Name: PRESETS[1].name,
          variantAttr3Name: PRESETS[2].name,
          variantAttr4Name: PRESETS[3].name
        }
      };
    }
    return null;
  }

  // Chỉ tạo variants[] khi có weights/packagingTypes legacy — không ép "Mặc định" hàng loạt.
  if (!hasVariants && hasLegacy) {
    const built = buildVariantAndClassificationsFromLegacyProduct(product);
    classifications = built.classifications;
    newVariants = built.variants;
    variantQuantityKind = built.variantQuantityKind;

    const anyChip = classifications.some((c) => c.values.length > 0);
    if (!anyChip) return null;

    const onlyDefaultLabel = newVariants[0]?.label === 'Mặc định';
    return {
      $set: {
        variants: newVariants,
        variantClassifications: classifications,
        variantQuantityKind,
        variantAttr1Name: onlyDefaultLabel ? 'Nhãn' : PRESETS[0].name,
        variantAttr2Name: PRESETS[1].name,
        variantAttr3Name: PRESETS[2].name,
        variantAttr4Name: PRESETS[3].name
      }
    };
  }

  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const write = args.includes('--write');
  const forceRebuildVc = args.includes('--force-rebuild-vc');

  if (!process.env.MONGODB_URI) {
    throw new Error('Thiếu MONGODB_URI trong backend/.env');
  }
  if (!dryRun && !write) {
    throw new Error('Thêm --dry-run (xem trước) hoặc --write (ghi DB).');
  }
  if (dryRun && write) {
    throw new Error('Chỉ chọn một: --dry-run hoặc --write.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Đã kết nối MongoDB');

  const cursor = Product.find({})
    .select(
      'name variants variantClassifications weights packagingTypes price stock oldPrice variantAttr1Name variantQuantityKind'
    )
    .lean()
    .cursor();

  let scanned = 0;
  let wouldUpdate = 0;
  const samples = [];

  for await (const doc of cursor) {
    scanned++;
    const update = buildUpdatePayload(doc, { forceRebuildVc });
    if (!update) continue;
    wouldUpdate++;
    if (samples.length < 15) {
      samples.push({
        _id: doc._id.toString(),
        name: doc.name,
        update
      });
    }

    if (write) {
      await Product.updateOne({ _id: doc._id }, update);
    }
  }

  console.log(`\nĐã quét: ${scanned} sản phẩm`);
  console.log(`${write ? 'Đã cập nhật' : 'Sẽ cập nhật'}: ${wouldUpdate} sản phẩm`);
  if (forceRebuildVc) console.log('(Chế độ --force-rebuild-vc: ghi đè variantClassifications khi có variants)\n');

  if (dryRun && samples.length) {
    console.log('\n--- Mẫu (tối đa 15) ---');
    samples.forEach((s) => {
      console.log('\n' + s._id, s.name);
      console.log(JSON.stringify(s.update, null, 2));
    });
  }

  await mongoose.disconnect();
  console.log('\n✅ Xong.');
}

main().catch((err) => {
  console.error('❌ Lỗi migration:', err);
  process.exit(1);
});
