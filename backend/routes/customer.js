const router = require('express').Router();
const User   = require('../models/User');
const Order  = require('../models/Order');

// Helper: tính thống kê mua hàng theo phone cho danh sách phone
async function buildStatsByPhone() {
  // Gom đơn hàng theo số điện thoại để tính tổng đơn và tổng tiền
  const agg = await Order.aggregate([
    {
      $group: {
        _id: '$customer.phone',
        totalOrders: { $sum: 1 },
        totalSpent:  { $sum: '$total' },
      },
    },
  ]);

  const map = new Map();
  for (const row of agg) {
    if (!row._id) continue;
    map.set(row._id, {
      totalOrders: row.totalOrders || 0,
      totalSpent:  row.totalSpent  || 0,
    });
  }
  return map;
}

// Helper: xếp hạng thành viên dựa trên tổng chi tiêu
function getMembershipTier(totalSpent) {
  if (!totalSpent || totalSpent <= 0) return 'Đồng';
  if (totalSpent < 5_000_000) return 'Đồng';
  if (totalSpent < 10_000_000) return 'Bạc';
  if (totalSpent < 20_000_000) return 'Vàng';
  return 'Kim Cương';
}

// Lưu ý:
// - Ứng dụng my-admin hiện chưa có luồng đăng nhập + gửi token.
// - Để màn hình customer kết nối được dữ liệu thật ngay trong môi trường dev,
//   tạm thời KHÔNG bắt middleware auth tại route này.
// - Khi hoàn thiện auth cho my-admin, hãy mở lại dòng dưới:
// router.use(authenticateToken, requireAdmin);

// GET /api/admin/customers
// Lấy danh sách khách hàng với phân trang + tìm kiếm
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page, 10)  || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const search = (req.query.search || '').trim();
    const isActiveParam = req.query.isActive;

    const filter = { role: 'user' };

    // Lọc theo trạng thái hoạt động nếu có
    if (typeof isActiveParam === 'string') {
      if (isActiveParam === 'true')  filter.isActive = true;
      if (isActiveParam === 'false') filter.isActive = false;
    }

    // Tìm theo username / phone / customerID / email
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { username:   regex },
        { phone:      regex },
        { customerID: regex },
        { email:      regex },
      ];
    }

    // sortBy / sortDir: sắp xếp toàn bộ kết quả khớp filter rồi mới phân trang
    // (đơn giản, phù hợp quy mô admin thông thường; có thể tối ưu aggregation sau)
    const sortBy = String(req.query.sortBy || 'createdAt').trim();
    const sortDirRaw = String(req.query.sortDir || 'desc').toLowerCase();
    const sortDir = sortDirRaw === 'asc' ? 1 : -1;

    const users = await User.find(filter).lean();

    const statsMap = await buildStatsByPhone();

    /** @type {Array<Record<string, unknown>>} */
    let data = users.map(u => {
      const stats = statsMap.get(u.phone) || { totalOrders: 0, totalSpent: 0 };
      const membershipTier = getMembershipTier(stats.totalSpent);

      return {
        id:           String(u._id),
        customerID:   u.customerID || '',
        username:     u.username,
        phone:        u.phone,
        email:        u.email || '',
        address:      u.address || '',
        membershipTier,
        isActive:     typeof u.isActive === 'boolean' ? u.isActive : true,
        createdAt:    u.createdAt,
        totalOrders:  stats.totalOrders,
        totalSpent:   stats.totalSpent,
      };
    });

    const tierRank = { 'Đồng': 1, 'Bạc': 2, 'Vàng': 3, 'Kim Cương': 4 };

    data.sort((a, b) => {
      let va;
      let vb;
      switch (sortBy) {
        case 'username': {
          va = String(a.username || '').toLowerCase();
          vb = String(b.username || '').toLowerCase();
          return va.localeCompare(vb, 'vi') * sortDir;
        }
        case 'customerID': {
          va = String(a.customerID || '');
          vb = String(b.customerID || '');
          return va.localeCompare(vb, undefined, { numeric: true }) * sortDir;
        }
        case 'phone': {
          va = String(a.phone || '');
          vb = String(b.phone || '');
          return va.localeCompare(vb, undefined, { numeric: true }) * sortDir;
        }
        case 'totalOrders':
          return ((a.totalOrders || 0) - (b.totalOrders || 0)) * sortDir;
        case 'totalSpent':
          return ((a.totalSpent || 0) - (b.totalSpent || 0)) * sortDir;
        case 'membershipTier': {
          va = tierRank[a.membershipTier] || 0;
          vb = tierRank[b.membershipTier] || 0;
          return (va - vb) * sortDir;
        }
        case 'isActive':
          return ((a.isActive ? 1 : 0) - (b.isActive ? 1 : 0)) * sortDir;
        case 'createdAt':
        default: {
          va = new Date(a.createdAt).getTime();
          vb = new Date(b.createdAt).getTime();
          return (va - vb) * sortDir;
        }
      }
    });

    const total = data.length;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    let safePage = page;
    if (safePage > totalPages) safePage = totalPages;
    if (safePage < 1) safePage = 1;
    const skip = (safePage - 1) * limit;
    const pageData = data.slice(skip, skip + limit);

    res.json({
      data: pageData,
      total,
      page: safePage,
      totalPages,
    });
  } catch (err) {
    console.error('GET /api/admin/customers error:', err);
    res.status(500).json({ message: err.message || 'Lỗi server' });
  }
});

// GET /api/admin/customers/:id
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'user' }).lean();
    if (!user) return res.status(404).json({ message: 'Không tìm thấy khách hàng' });

    const statsMap = await buildStatsByPhone();
    const stats = statsMap.get(user.phone) || { totalOrders: 0, totalSpent: 0 };
    const membershipTier = getMembershipTier(stats.totalSpent);

    res.json({
      id:           String(user._id),
      customerID:   user.customerID || '',
      username:     user.username,
      phone:        user.phone,
      email:        user.email || '',
      address:      user.address || '',
      membershipTier,
      isActive:     typeof user.isActive === 'boolean' ? user.isActive : true,
      createdAt:    user.createdAt,
      totalOrders:  stats.totalOrders,
      totalSpent:   stats.totalSpent,
    });
  } catch (err) {
    console.error('GET /api/admin/customers/:id error:', err);
    res.status(500).json({ message: err.message || 'Lỗi server' });
  }
});

// PUT /api/admin/customers/:id
// Cập nhật một số thông tin cơ bản (username, phone, email, address, isActive)
router.put('/:id', async (req, res) => {
  try {
    const allowedFields = ['username', 'phone', 'email', 'address', 'isActive'];
    const update = {};

    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        update[key] = req.body[key];
      }
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'user' },
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!user) return res.status(404).json({ message: 'Không tìm thấy khách hàng' });

    const statsMap = await buildStatsByPhone();
    const stats = statsMap.get(user.phone) || { totalOrders: 0, totalSpent: 0 };
    const membershipTier = getMembershipTier(stats.totalSpent);

    res.json({
      message: 'Cập nhật khách hàng thành công',
      user: {
        id:           String(user._id),
        customerID:   user.customerID || '',
        username:     user.username,
        phone:        user.phone,
        email:        user.email || '',
        address:      user.address || '',
        membershipTier,
        isActive:     typeof user.isActive === 'boolean' ? user.isActive : true,
        createdAt:    user.createdAt,
        totalOrders:  stats.totalOrders,
        totalSpent:   stats.totalSpent,
      }
    });
  } catch (err) {
    console.error('PUT /api/admin/customers/:id error:', err);
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Username / email / SĐT đã tồn tại' });
    }
    res.status(500).json({ message: err.message || 'Lỗi server' });
  }
});

// PATCH /api/admin/customers/:id/toggle-active
router.patch('/:id/toggle-active', async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'user' });
    if (!user) return res.status(404).json({ message: 'Không tìm thấy khách hàng' });

    const newStatus = !Boolean(user.isActive);
    user.isActive = newStatus;
    await user.save();

    res.json({
      message:  newStatus ? 'Đã kích hoạt tài khoản' : 'Đã khóa tài khoản',
      isActive: newStatus,
    });
  } catch (err) {
    console.error('PATCH /api/admin/customers/:id/toggle-active error:', err);
    res.status(500).json({ message: err.message || 'Lỗi server' });
  }
});

// DELETE /api/admin/customers/:id
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ _id: req.params.id, role: 'user' });
    if (!user) return res.status(404).json({ message: 'Không tìm thấy khách hàng' });

    // Không xóa đơn hàng lịch sử, chỉ xóa tài khoản
    res.json({ message: 'Đã xóa khách hàng thành công' });
  } catch (err) {
    console.error('DELETE /api/admin/customers/:id error:', err);
    res.status(500).json({ message: err.message || 'Lỗi server' });
  }
});

module.exports = router;

