const router = require('express').Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

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

function buildDateKeys(fromStr, toStr) {
  const days = diffDaysInclusive(fromStr, toStr);
  return Array.from({ length: days }, (_, i) => addDays(fromStr, i));
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

function getMembershipTier(totalSpent) {
  if (!totalSpent || totalSpent <= 0) return 'Đồng';
  if (totalSpent < 5_000_000) return 'Đồng';
  if (totalSpent < 10_000_000) return 'Bạc';
  if (totalSpent < 20_000_000) return 'Vàng';
  return 'Kim Cương';
}

async function buildRevenueSeries(from, to) {
  const rows = await Order.aggregate([
    { $match: orderMatch(from, to) },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } },
        value: { $sum: '$total' },
      },
    },
  ]);
  const map = new Map(rows.map((r) => [r._id, Number(r.value || 0)]));
  return buildDateKeys(from, to).map((k) => map.get(k) || 0);
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
    const yesterday = addDays(today, -1);

    const [todayRevenue, yesterdayRevenue, todayOrders, yesterdayOrders, todayUsers, yesterdayUsers, activeProducts, activeBeforeToday] = await Promise.all([
      Order.aggregate([{ $match: orderMatch(today, today) }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      Order.aggregate([{ $match: orderMatch(yesterday, yesterday) }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      Order.countDocuments(orderMatch(today, today)),
      Order.countDocuments(orderMatch(yesterday, yesterday)),
      User.countDocuments({
        role: 'user',
        createdAt: { $gte: startUtcFromVNDate(today), $lt: startUtcFromVNDate(addDays(today, 1)) },
      }),
      User.countDocuments({
        role: 'user',
        createdAt: { $gte: startUtcFromVNDate(yesterday), $lt: startUtcFromVNDate(addDays(yesterday, 1)) },
      }),
      Product.countDocuments({ isHidden: { $ne: true } }),
      Product.countDocuments({
        isHidden: { $ne: true },
        createdAt: { $lt: startUtcFromVNDate(today) },
      }),
    ]);

    const [currentRevenue, previousRevenue] = await Promise.all([
      buildRevenueSeries(from, to),
      buildRevenueSeries(prevFrom, prevTo),
    ]);

    let revenueLabels = buildDateKeys(from, to).map((d) => d.slice(8, 10));
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

    const [statusPie, promotionPie, recentOrders, topAgg, spentByPhone, users] = await Promise.all([
      Order.aggregate([{ $group: { _id: '$status', value: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: { $ifNull: ['$voucherCode', 'Không dùng mã'] }, value: { $sum: 1 } } },
      ]),
      Order.find().sort({ createdAt: -1 }).limit(8).select({ customer: 1, total: 1, status: 1, createdAt: 1 }).lean(),
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
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: '$customer.phone', totalSpent: { $sum: '$total' } } },
      ]),
      User.find({ role: 'user' }).select({ phone: 1 }).lean(),
    ]);

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

    const spentMap = new Map(spentByPhone.map((x) => [x._id, Number(x.totalSpent || 0)]));
    const tierMap = { Đồng: 0, Bạc: 0, Vàng: 0, 'Kim Cương': 0 };
    users.forEach((u) => {
      const tier = getMembershipTier(spentMap.get(u.phone) || 0);
      tierMap[tier] += 1;
    });

    return {
      filter: { preset, from, to, previousFrom: prevFrom, previousTo: prevTo },
      kpis: {
        // KPI cards luôn theo hôm nay, không phụ thuộc global time filter.
        revenue: Number(todayRevenue[0]?.total || 0),
        orders: todayOrders,
        newCustomers: todayUsers,
        products: activeProducts,
      },
      kpiChangeVsYesterday: {
        revenue: calcPercent(Number(todayRevenue[0]?.total || 0), Number(yesterdayRevenue[0]?.total || 0)),
        orders: calcPercent(todayOrders, yesterdayOrders),
        newCustomers: calcPercent(todayUsers, yesterdayUsers),
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
      orderStatusPie: statusPie.map((x) => ({ label: x._id || 'unknown', value: Number(x.value || 0) })),
      promotionPie: promotionPie.map((x) => ({ label: x._id || 'Không dùng mã', value: Number(x.value || 0) })),
      customerTierPie: Object.entries(tierMap).map(([label, value]) => ({ label, value })),
      recentOrders: recentOrders.map((o) => ({
        orderId: String(o._id),
        customerName: o.customer?.fullName || '',
        total: Number(o.total || 0),
        status: o.status || 'pending',
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
      rows.push(toCsvRow([o.orderId, o.customerName, o.total, o.status, o.createdAt]));
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
