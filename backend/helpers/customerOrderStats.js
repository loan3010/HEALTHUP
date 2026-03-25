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
 * - byUserId: đơn có userId (ObjectId) — nguồn duy nhất để gắn với tài khoản khách.
 * - byPhoneNorm: đơn không gắn userId, gom theo SĐT **người nhận** trên đơn — chỉ dùng cho
 *   màn chi tiết đơn guest (web) trên admin, **không** cộng vào CRM khách đăng ký (tránh đơn mua hộ / hotline).
 *   Loại `orderSource: admin_hotline` vì SĐT đó là người nhận, không phải người mua.
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
      {
        $match: {
          $nor: [{ userId: { $type: 'objectId' } }],
          orderSource: { $nin: ['admin_hotline'] },
        },
      },
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
 * Thống kê CRM cho một tài khoản khách đăng ký — **chỉ** đơn có `userId` trùng khách.
 * Không cộng đơn guest theo SĐT người nhận: có thể là quà / mua hộ / hotline giao cho SĐT của người khác.
 */
function statsForUser(user, maps) {
  const fromId = maps.byUserId.get(String(user._id));
  return fromId || ZERO_STATS;
}


/**
 * Tương thích ngược cho các route admin đang gọi tên hàm cũ.
 * Trả về hạng đơn giản: member | vip.
 * Lưu ý: hiện tại route truyền vào tổng chi tiêu đã tính theo rule delivered.
 */
function membershipTierFromTotalSpent90d(totalSpent) {
  return Number(totalSpent || 0) >= 2_000_000 ? 'vip' : 'member';
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


/**
 * Tổng tiền đơn đã giao (trừ hoàn xong) trong `months` tháng gần nhất — khớp logic VIP /api/users/:id (recentSpent).
 * @param {import('mongoose').Model} Order
 * @param {import('mongoose').Types.ObjectId} userId
 */
async function recentDeliveredSpendForUser(Order, userId, months = 3) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  const [row] = await Order.aggregate([
    {
      $match: {
        userId,
        status: 'delivered',
        returnStatus: { $ne: 'completed' },
        createdAt: { $gte: since },
      },
    },
    { $group: { _id: null, total: { $sum: '$total' } } },
  ]);
  return Number(row?.total || 0);
}


/**
 * Map userId → chi tiêu đã giao trong 3 tháng (một query) — dùng cho danh sách khách admin.
 * @param {import('mongoose').Model} Order
 * @param {import('mongoose').Types.ObjectId[]} userIds
 * @returns {Promise<Map<string, number>>}
 */
async function recentDeliveredSpendMapForUsers(Order, userIds) {
  const m = new Map();
  if (!Array.isArray(userIds) || !userIds.length) return m;
  const since = new Date();
  since.setMonth(since.getMonth() - 3);
  const rows = await Order.aggregate([
    {
      $match: {
        userId: { $in: userIds },
        status: 'delivered',
        returnStatus: { $ne: 'completed' },
        createdAt: { $gte: since },
      },
    },
    { $group: { _id: '$userId', total: { $sum: '$total' } } },
  ]);
  for (const r of rows) {
    if (r._id) m.set(String(r._id), Number(r.total || 0));
  }
  return m;
}


module.exports = {
  groupCustomerStatsFields,
  normalizePhone,
  buildCustomerListStatsMaps,
  statsForUser,
  membershipTierFromTotalSpent90d,
  aggregateStatsForMatch,
  recentDeliveredSpendForUser,
  recentDeliveredSpendMapForUsers,
};