/**
 * Chuẩn hóa SĐT để ghép đơn với User (bỏ ký tự không phải số).
 * Ví dụ 0317839913 vs +84 317 839 913 → cùng một chuỗi số.
 */
function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function rowToStats(row) {
  return {
    totalOrders: Number(row.totalOrders || 0),
    totalSpent: Number(row.totalSpent || 0),
    hasProvisionalSpend: Number(row.provisionalSpendCount || 0) > 0,
  };
}

const ZERO_STATS = { totalOrders: 0, totalSpent: 0, hasProvisionalSpend: false };

function mergeStats(a, b) {
  const A = a || ZERO_STATS;
  const B = b || ZERO_STATS;
  return {
    totalOrders: A.totalOrders + B.totalOrders,
    totalSpent: A.totalSpent + B.totalSpent,
    hasProvisionalSpend: A.hasProvisionalSpend || B.hasProvisionalSpend,
  };
}

/**
 * Thống kê khách — bám bảng nghiệp vụ admin:
 *
 * - Tổng đơn: đếm mọi đơn có status !== 'cancelled' (gồm pending, confirmed, shipping, delivered…).
 * - Tổng HĐ & hạng (totalSpent): chỉ cộng tiền đơn status === 'delivered' và returnStatus !== 'completed'.
 *   pending / confirmed / shipping / cancelled: không cộng tiền.
 *   delivered + none | requested | approved | rejected: cộng (requested|approved = tiền tạm, vẫn cộng số).
 *   delivered + completed: không cộng (đã hoàn tiền xong).
 * - hasProvisionalSpend: true nếu có ít nhất một đơn delivered với returnStatus requested hoặc approved
 *   (để UI hiển thị gợi ý "tạm chờ hoàn").
 *
 * Lưu ý: bảng gốc không có dòng `confirmed`; ta xử lý giống pending/shipping (chỉ tính đơn, chưa cộng tiền).
 */

/**
 * Các biến aggregate $group (dùng chung cho group theo phone hoặc theo null).
 * @returns {Record<string, object>}
 */
function groupCustomerStatsFields() {
  return {
    totalOrders: {
      $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, 1, 0] },
    },
    totalSpent: {
      $sum: {
        $cond: [
          {
            $and: [
              { $eq: ['$status', 'delivered'] },
              { $ne: [{ $ifNull: ['$returnStatus', 'none'] }, 'completed'] },
            ],
          },
          '$total',
          0,
        ],
      },
    },
    provisionalSpendCount: {
      $sum: {
        $cond: [
          {
            $and: [
              { $eq: ['$status', 'delivered'] },
              {
                $in: [
                  { $ifNull: ['$returnStatus', 'none'] },
                  ['requested', 'approved'],
                ],
              },
            ],
          },
          1,
          0,
        ],
      },
    },
  };
}

/**
 * Hai map gộp cho danh sách User:
 * - byUserId: đơn có userId (ObjectId) — tránh lệch khi SĐT trên đơn ≠ SĐT tài khoản.
 * - byPhoneNorm: đơn không gắn userId, gom theo SĐT đã chuẩn hóa (khách vãng lai / đơn cũ).
 *
 * @param {import('mongoose').Model} Order
 * @returns {Promise<{ byUserId: Map<string, object>, byPhoneNorm: Map<string, object> }>}
 */
async function buildCustomerListStatsMaps(Order) {
  const [userRows, phoneRows] = await Promise.all([
    Order.aggregate([
      { $match: { userId: { $type: 'objectId' } } },
      { $group: { _id: '$userId', ...groupCustomerStatsFields() } },
    ]),
    Order.aggregate([
      { $match: { $nor: [{ userId: { $type: 'objectId' } }] } },
      { $group: { _id: '$customer.phone', ...groupCustomerStatsFields() } },
    ]),
  ]);

  const byUserId = new Map();
  for (const row of userRows) {
    if (!row._id) continue;
    byUserId.set(String(row._id), rowToStats(row));
  }

  const byPhoneNorm = new Map();
  for (const row of phoneRows) {
    if (row._id == null || row._id === '') continue;
    const key = normalizePhone(String(row._id));
    if (!key) continue;
    const cur = byPhoneNorm.get(key) || ZERO_STATS;
    byPhoneNorm.set(key, mergeStats(cur, rowToStats(row)));
  }

  return { byUserId, byPhoneNorm };
}

/**
 * Gộp thống kê cho một user (đơn theo tài khoản + đơn chỉ khớp SĐT).
 */
function statsForUser(user, maps) {
  const { byUserId, byPhoneNorm } = maps;
  const fromId = byUserId.get(String(user._id));
  const fromPhone = byPhoneNorm.get(normalizePhone(user.phone));
  return mergeStats(fromId, fromPhone);
}

/**
 * Thống kê một nhóm đơn (userId hoặc customer.phone).
 * @param {import('mongoose').Model} Order
 * @param {Record<string, unknown>} matchFilter — ví dụ { userId } hoặc { 'customer.phone': '...' }
 */
async function aggregateStatsForMatch(Order, matchFilter) {
  const [row] = await Order.aggregate([
    { $match: matchFilter },
    { $group: { _id: null, ...groupCustomerStatsFields() } },
  ]);
  if (!row) {
    return { totalOrders: 0, totalSpent: 0, hasProvisionalSpend: false };
  }
  return {
    totalOrders: Number(row.totalOrders || 0),
    totalSpent: Number(row.totalSpent || 0),
    hasProvisionalSpend: Number(row.provisionalSpendCount || 0) > 0,
  };
}

module.exports = {
  groupCustomerStatsFields,
  normalizePhone,
  buildCustomerListStatsMaps,
  statsForUser,
  aggregateStatsForMatch,
};
