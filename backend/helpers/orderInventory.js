/**
 * Hoàn kho khi hủy đơn — đối xứng với persistNewOrder (routes/orders.js).
 * Chỉ chạy một lần: bám cờ inventoryReleased trên Order.
 */
const Product = require('../models/Product');

/**
 * @param {import('mongoose').Document} orderDoc — document Order đã load (có .items)
 * @returns {Promise<boolean>} true nếu đã thực sự hoàn kho (trước đó chưa hoàn)
 */
async function restoreInventoryForOrderIfNeeded(orderDoc) {
  if (!orderDoc || orderDoc.inventoryReleased) return false;
  const items = orderDoc.items || [];

  for (const item of items) {
    const pid = item.productId;
    if (!pid) continue;
    const p = await Product.findById(pid);
    if (!p) continue;
    const q = Number(item.quantity || 0);
    if (q <= 0) continue;

    const vid = item.variantId;
    if (vid) {
      const idx = (p.variants || []).findIndex((v) => String(v._id) === String(vid));
      if (idx >= 0) {
        p.variants[idx].stock = Number(p.variants[idx].stock || 0) + q;
      }
    } else {
      p.stock = Number(p.stock || 0) + q;
    }

    if (Array.isArray(p.variants) && p.variants.length > 0) {
      p.stock = p.variants.reduce((sum, v) => sum + Number(v.stock || 0), 0);
    }

    p.sold = Math.max(0, Number(p.sold || 0) - q);
    await p.save();
  }

  orderDoc.inventoryReleased = true;
  return true;
}

module.exports = { restoreInventoryForOrderIfNeeded };
