const router = require('express').Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Promotion = require('../models/Promotion');
const User = require('../models/User');
const {
  buildCustomerListStatsMaps,
  statsForUser,
  membershipTierFromTotalSpent90d,
} = require('../helpers/customerOrderStats');

const TZ = 'Asia/Ho_Chi_Minh';
const DAY_MS = 24 * 60 * 60 * 1000;

function toVNDateString(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

function startUtcFromVNDate(vnDateStr) {
  return new Date(`${vnDateStr}T00:00:00+07:00`);
}

function addDays(vnDateStr, delta) {
  const d = startUtcFromVNDate(vnDateStr);
  return toVNDateString(new Date(d.getTime() + delta * DAY_MS));
}

function diffDaysInclusive(fromStr, toStr) {
  const from = startUtcFromVNDate(fromStr);
  const to = startUtcFromVNDate(toStr);
  return Math.floor((to - from) / DAY_MS) + 1;
}

/**
 * Chuẩn hóa giá trị status trong DB (dữ liệu cũ có thể khác hoa/thường, gạch ngang, hoặc "canceled").
 */
function normalizeOrderStatusKey(status) {
  let k = String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  if (k === 'canceled') k = 'cancelled';
  return k;
}

/** Hiển thị trạng thái đơn bằng tiếng Việt (schema enum tiếng Anh — không echo raw tiếng Anh ra UI). */
function orderStatusVi(status) {
  const norm = normalizeOrderStatusKey(status);
  const map = {
    pending: 'Chờ xử lý',
    confirmed: 'Đã xác nhận',
    shipping: 'Đang giao hàng',
    delivery_failed: 'Giao thất bại',
    delivered: 'Đã giao',
    cancelled: 'Đã hủy',
  };
  if (map[norm]) return map[norm];
  if (!norm || norm === 'null' || norm === 'undefined') return 'Không rõ';
  return 'Không xác định';
}

/** Gộp các cung pie cùng nhãn (ví dụ pending + Pending → cùng "Chờ xử lý"). */
function mergePiePoints(points) {
  const m = new Map();
  for (const p of points) {
    const label = String(p.label || '');
    const v = Number(p.value || 0);
    m.set(label, (m.get(label) || 0) + v);
  }
  return [...m.entries()].map(([label, value]) => ({ label, value }));
}

/**
 * Cột "Khách hàng" trên dashboard: ưu tiên username tài khoản (đơn đăng nhập);
 * đơn khách / hotline không có userId → SĐT hoặc họ tên snapshot.
 */
function recentOrderCustomerName(order, usernameByUserId) {
  const uid = order.userId ? String(order.userId) : '';
  if (uid) {
    const un = usernameByUserId.get(uid);
    if (un) return un;
  }
  return order.customer?.phone || order.customer?.fullName || '—';
}

/** Tổng tiền an toàn: một số bản ghi cũ có thể thiếu `total`. */
function orderDisplayTotal(o) {
  if (typeof o.total === 'number' && !Number.isNaN(o.total)) return o.total;
  const sub = Number(o.subTotal) || 0;
  const ship = Number(o.shippingFee) || 0;
  const disc = Number(o.discount) || 0;
  const calc = sub + ship - disc;
  return Number.isFinite(calc) ? calc : 0;
}

function buildDateKeys(fromStr, toStr) {
  const days = diffDaysInclusive(fromStr, toStr);
  return Array.from({ length: days }, (_, i) => addDays(fromStr, i));
}

function buildHourKeys() {
  return Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
}

function getRange(req) {
  const preset = String(req.query.preset || 'today');
  const today = toVNDateString(new Date());

  if (preset === 'today') return { preset, from: today, to: today };
  if (preset === '7days') return { preset, from: addDays(today, -6), to: today };
  if (preset === 'month') return { preset, from: `${today.slice(0, 8)}01`, to: today };

  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error('Khoảng ngày custom không hợp lệ');
  }
  const len = diffDaysInclusive(from, to);
  if (len < 1 || len > 30) throw new Error('Khoảng ngày custom phải từ 1 đến 30 ngày');
  return { preset: 'custom', from, to };
}

function orderMatch(from, to) {
  return {
    createdAt: {
      $gte: startUtcFromVNDate(from),
      $lt: startUtcFromVNDate(addDays(to, 1)),
    },
    status: { $ne: 'cancelled' },
  };
}

/**
 * Biểu đồ khuyến mãi: đếm số chương trình theo mốc thời gian (giống logic POST /promotions/apply).
 * Trước đây nhầm lẫn với thống kê đơn hàng theo mã voucher.
 */
async function buildPromotionLifecyclePie() {
  const promos = await Promotion.find().select({ startDate: 1, endDate: 1 }).lean();
  const now = Date.now();
  let ongoing = 0;
  let upcoming = 0;
  let ended = 0;

  for (const p of promos) {
    const start = p.startDate ? new Date(p.startDate).getTime() : NaN;
    const end = p.endDate ? new Date(p.endDate).getTime() : NaN;
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    if (now < start) upcoming += 1;
    else if (now > end) ended += 1;
    else ongoing += 1;
  }

  return [
    { label: 'Đang diễn ra', value: ongoing },
    { label: 'Chưa diễn ra', value: upcoming },
    { label: 'Đã kết thúc', value: ended },
  ];
}

async function buildRevenueSeries(from, to, byHour = false) {
  const groupFormat = byHour ? '%H' : '%Y-%m-%d';
  const rows = await Order.aggregate([
    { $match: orderMatch(from, to) },
    {
      $group: {
        _id: { $dateToString: { format: groupFormat, date: '$createdAt', timezone: TZ } },
        value: { $sum: '$total' },
      },
    },
  ]);
  const map = new Map(rows.map((r) => [r._id, Number(r.value || 0)]));
  const keys = byHour ? buildHourKeys() : buildDateKeys(from, to);
  return keys.map((k) => map.get(k) || 0);
}

function calcPercent(current, previous) {
  if (!previous && !current) return 0;
  if (!previous && current > 0) return 100;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

async function buildDashboardData({ preset, from, to }) {
    const rangeDays = diffDaysInclusive(from, to);
    const prevTo = addDays(from, -1);
    const prevFrom = addDays(prevTo, -(rangeDays - 1));
    const today = toVNDateString(new Date());

    // KPI đơn hàng / doanh thu / KH mới: theo đúng khoảng lọc (Hôm nay / 7 ngày / Tháng / Custom).
    const rangeMatch = orderMatch(from, to);
    const prevMatch = orderMatch(prevFrom, prevTo);

    const [
      currentRangeRevenue,
      previousRangeRevenue,
      currentRangeOrders,
      previousRangeOrders,
      currentRangeNewUsers,
      previousRangeNewUsers,
      activeProducts,
      activeBeforeToday,
    ] = await Promise.all([
      Order.aggregate([{ $match: rangeMatch }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      Order.aggregate([{ $match: prevMatch }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      Order.countDocuments(rangeMatch),
      Order.countDocuments(prevMatch),
      User.countDocuments({
        role: 'user',
        createdAt: { $gte: startUtcFromVNDate(from), $lt: startUtcFromVNDate(addDays(to, 1)) },
      }),
      User.countDocuments({
        role: 'user',
        createdAt: { $gte: startUtcFromVNDate(prevFrom), $lt: startUtcFromVNDate(addDays(prevTo, 1)) },
      }),
      Product.countDocuments({ isHidden: { $ne: true } }),
      Product.countDocuments({
        isHidden: { $ne: true },
        createdAt: { $lt: startUtcFromVNDate(today) },
      }),
    ]);

    const byHourForToday = preset === 'today';
    const [currentRevenue, previousRevenue] = await Promise.all([
      buildRevenueSeries(from, to, byHourForToday),
      buildRevenueSeries(prevFrom, prevTo, byHourForToday),
    ]);

    let revenueLabels = byHourForToday
      ? buildHourKeys().map((h) => `${h}:00`)
      : buildDateKeys(from, to).map((d) => d.slice(8, 10));
    let currentRevenueData = currentRevenue;
    let previousRevenueData = previousRevenue;

    // Tháng này: trục ngày cố định 1..31, tháng trước vẽ đến cuối tháng trước.
    if (preset === 'month') {
      const [y, m] = from.split('-').map(Number);
      const dayNow = Number(to.slice(8, 10));
      const daysInCurrent = new Date(y, m, 0).getDate();
      const prevMonthStart = addDays(`${from.slice(0, 8)}01`, -1).slice(0, 8) + '01';
      const prevMonthDays = new Date(Number(prevMonthStart.slice(0, 4)), Number(prevMonthStart.slice(5, 7)), 0).getDate();

      const currentMap = new Map(buildDateKeys(from, to).map((d, i) => [Number(d.slice(8, 10)), currentRevenue[i]]));
      const prevMap = new Map(buildDateKeys(prevFrom, prevTo).map((d, i) => [Number(d.slice(8, 10)), previousRevenue[i]]));

      revenueLabels = Array.from({ length: daysInCurrent }, (_, i) => String(i + 1));
      currentRevenueData = revenueLabels.map((_, i) => (i + 1 <= dayNow ? (currentMap.get(i + 1) || 0) : null));
      previousRevenueData = revenueLabels.map((_, i) => (i + 1 <= prevMonthDays ? (prevMap.get(i + 1) || 0) : null));
    }

    const [ordersByDay, usersByDay] = await Promise.all([
      Order.aggregate([
        { $match: orderMatch(from, to) },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } }, value: { $sum: 1 } } },
      ]),
      User.aggregate([
        {
          $match: {
            role: 'user',
            createdAt: { $gte: startUtcFromVNDate(from), $lt: startUtcFromVNDate(addDays(to, 1)) },
          },
        },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } }, value: { $sum: 1 } } },
      ]),
    ]);
    const allDayKeys = buildDateKeys(from, to);
    const orderMap = new Map(ordersByDay.map((r) => [r._id, Number(r.value || 0)]));
    const userMap = new Map(usersByDay.map((r) => [r._id, Number(r.value || 0)]));

    const [statusPie, promotionPie, recentOrdersList, topAgg, customerStatsMaps, users] = await Promise.all([
      Order.aggregate([{ $group: { _id: '$status', value: { $sum: 1 } } }]),
      buildPromotionLifecyclePie(),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(8)
        .select({
          orderCode: 1,
          userId: 1,
          customer: 1,
          total: 1,
          subTotal: 1,
          shippingFee: 1,
          discount: 1,
          status: 1,
          createdAt: 1,
        })
        .lean(),
      // SL "Top bán chạy": tổng quantity từng dòng order.items, gom theo productId,
      // chỉ đơn status !== cancelled — toàn thời gian (không theo preset ngày dashboard).
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            name: { $first: '$items.name' },
            variantLabel: { $first: '$items.variantLabel' },
            quantity: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
          },
        },
        { $sort: { quantity: -1, revenue: -1 } },
      ]),
      buildCustomerListStatsMaps(Order),
      User.find({ role: 'user' }).select({ phone: 1 }).lean(),
    ]);

    const recentUserIds = [...new Set(recentOrdersList.map((o) => o.userId).filter(Boolean).map((id) => String(id)))];
    const recentUsersForOrders =
      recentUserIds.length > 0
        ? await User.find({ _id: { $in: recentUserIds } })
            .select({ username: 1 })
            .lean()
        : [];
    const recentUsernameByUserId = new Map(
      recentUsersForOrders
        .map((u) => [String(u._id), String(u.username || '').trim()])
        .filter(([, name]) => name.length > 0),
    );

    const productIds = topAgg.map((x) => x._id).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds } }).select({ cat: 1 }).lean();
    const catMap = new Map(products.map((p) => [String(p._id), p.cat || '']));
    const topRows = topAgg.map((r) => ({
      productId: String(r._id || ''),
      name: r.name || '',
      category: catMap.get(String(r._id)) || '',
      variantLabel: r.variantLabel || '',
      quantity: Number(r.quantity || 0),
      revenue: Number(r.revenue || 0),
    }));

    const tierMap = { 'Thành viên': 0, VIP: 0 };
    users.forEach((u) => {
      const s = statsForUser(u, customerStatsMaps);
      const tier = membershipTierFromTotalSpent90d(s.totalSpent90d || 0);
      const label = tier === 'vip' ? 'VIP' : 'Thành viên';
      tierMap[label] += 1;
    });

    return {
      filter: { preset, from, to, previousFrom: prevFrom, previousTo: prevTo },
      kpis: {
        revenue: Number(currentRangeRevenue[0]?.total || 0),
        orders: currentRangeOrders,
        newCustomers: currentRangeNewUsers,
        products: activeProducts,
      },
      // % so với kỳ trước cùng độ dài (tên field giữ để tương thích frontend).
      kpiChangeVsYesterday: {
        revenue: calcPercent(Number(currentRangeRevenue[0]?.total || 0), Number(previousRangeRevenue[0]?.total || 0)),
        orders: calcPercent(currentRangeOrders, previousRangeOrders),
        newCustomers: calcPercent(currentRangeNewUsers, previousRangeNewUsers),
        products: calcPercent(activeProducts, activeBeforeToday),
      },
      revenueLine: {
        labels: revenueLabels,
        current: currentRevenueData,
        previous: previousRevenueData,
      },
      ordersBar: {
        labels: allDayKeys.map((d) => d.slice(8, 10)),
        values: allDayKeys.map((d) => orderMap.get(d) || 0),
      },
      newCustomersBar: {
        labels: allDayKeys.map((d) => d.slice(8, 10)),
        values: allDayKeys.map((d) => userMap.get(d) || 0),
      },
      orderStatusPie: mergePiePoints(
        statusPie.map((x) => ({
          label: orderStatusVi(x._id),
          value: Number(x.value || 0),
        })),
      ),
      promotionPie,
      customerTierPie: Object.entries(tierMap).map(([label, value]) => ({ label, value })),
      recentOrders: recentOrdersList.map((o) => ({
        orderId: String(o._id),
        orderCode: o.orderCode ? String(o.orderCode).trim() : '',
        customerName: recentOrderCustomerName(o, recentUsernameByUserId),
        total: orderDisplayTotal(o),
        statusLabel: orderStatusVi(o.status),
        createdAt: o.createdAt,
      })),
      topProducts: {
        bestSelling: topRows.slice(0, 8),
        slowSelling: [...topRows].sort((a, b) => a.quantity - b.quantity || a.revenue - b.revenue).slice(0, 8),
      },
    };
}

function toCsvRow(cells) {
  return cells
    .map((cell) => {
      const v = String(cell ?? '');
      const escaped = v.replace(/"/g, '""');
      return `"${escaped}"`;
    })
    .join(',');
}

router.get('/export', async (req, res) => {
  try {
    const { preset, from, to } = getRange(req);
    const data = await buildDashboardData({ preset, from, to });
    const rows = [];

    rows.push(toCsvRow(['Bao cao Dashboard HealthUp']));
    rows.push(toCsvRow(['Khoang thoi gian', `${data.filter.from} -> ${data.filter.to}`]));
    rows.push(toCsvRow(['']));
    rows.push(toCsvRow(['KPI', 'Gia tri', 'So voi hom qua (%)']));
    rows.push(toCsvRow(['Doanh thu', data.kpis.revenue, data.kpiChangeVsYesterday.revenue]));
    rows.push(toCsvRow(['Don hang', data.kpis.orders, data.kpiChangeVsYesterday.orders]));
    rows.push(toCsvRow(['Khach hang moi', data.kpis.newCustomers, data.kpiChangeVsYesterday.newCustomers]));
    rows.push(toCsvRow(['San pham', data.kpis.products, data.kpiChangeVsYesterday.products]));
    rows.push(toCsvRow(['']));

    rows.push(toCsvRow(['Don hang gan day']));
    rows.push(toCsvRow(['Ma don', 'Khach hang', 'Tong tien', 'Trang thai', 'Ngay tao']));
    data.recentOrders.forEach((o) => {
      rows.push(toCsvRow([o.orderCode || o.orderId, o.customerName, o.total, o.statusLabel, o.createdAt]));
    });
    rows.push(toCsvRow(['']));

    rows.push(toCsvRow(['Top ban chay']));
    rows.push(toCsvRow(['San pham', 'Danh muc', 'Phan loai', 'So luong', 'Doanh thu']));
    data.topProducts.bestSelling.forEach((p) => {
      rows.push(toCsvRow([p.name, p.category, p.variantLabel, p.quantity, p.revenue]));
    });
    rows.push(toCsvRow(['']));

    rows.push(toCsvRow(['Top ban cham']));
    rows.push(toCsvRow(['San pham', 'Danh muc', 'Phan loai', 'So luong', 'Doanh thu']));
    data.topProducts.slowSelling.forEach((p) => {
      rows.push(toCsvRow([p.name, p.category, p.variantLabel, p.quantity, p.revenue]));
    });

    const csv = rows.join('\n');
    const fileName = `dashboard-${data.filter.from}-to-${data.filter.to}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(`\ufeff${csv}`);
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Lỗi dashboard' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { preset, from, to } = getRange(req);
    const data = await buildDashboardData({ preset, from, to });
    return res.json(data);
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Lỗi dashboard' });
  }
});

module.exports = router;