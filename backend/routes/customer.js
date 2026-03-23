const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const {
  buildCustomerListStatsMaps,
  statsForUser,
  normalizePhone,
  membershipTierFromTotalSpent90d,
} = require('../helpers/customerOrderStats');
const { emitAccountDisabled } = require('../services/userAccountRealtime');

/** Ghép địa chỉ giao trên Order.customer thành một dòng (giống cách hay hiển thị). */
function joinOrderCustomerAddress(c) {
  if (!c) return '';
  const parts = [c.address, c.ward, c.district, c.province]
    .map((x) => String(x || '').trim())
    .filter((p) => p.length > 0 && !/^n\/a$/i.test(p));
  return parts.length ? parts.join(', ') : String(c.address || '').trim();
}

/** Khóa so sánh để không trùng giữa sổ địa chỉ và gợi ý từ đơn. */
function addrDedupeKey(name, phone, addressLine) {
  return `${String(name || '').trim().toLowerCase()}|${normalizePhone(phone)}|${String(addressLine || '').trim().toLowerCase()}`;
}

/**
 * Lý do + audit khi tài khoản đang khóa (admin xem lại trong chi tiết KH).
 * @param {Record<string, unknown>} u — document User (lean hoặc mongoose doc)
 */
function deactivationAuditForDoc(u) {
  const active = typeof u.isActive === 'boolean' ? u.isActive : true;
  if (active) {
    return {
      deactivationReason: '',
      deactivatedBy: '',
      deactivatedAt: null,
    };
  }
  return {
    deactivationReason: u.deactivationReason ? String(u.deactivationReason) : '',
    deactivatedBy: u.deactivatedBy ? String(u.deactivatedBy) : '',
    deactivatedAt: u.deactivatedAt ? new Date(u.deactivatedAt).toISOString() : null,
  };
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
    const tierParam = String(req.query.tier || '').trim().toLowerCase();

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

    // Gộp đơn theo userId + đơn không userId theo SĐT chuẩn hóa (tránh 0 đơn khi SĐT trên đơn ≠ SĐT profile).
    const statsMaps = await buildCustomerListStatsMaps(Order);

    /** @type {Array<Record<string, unknown>>} */
    let data = users.map(u => {
      const stats = statsForUser(u, statsMaps);
      const membershipTier = membershipTierFromTotalSpent90d(stats.totalSpent90d);

      const audit = deactivationAuditForDoc(u);
      return {
        id:           String(u._id),
        customerID:   u.customerID || '',
        username:     u.username,
        phone:        u.phone,
        email:        u.email || '',
        address:      u.address || '',
        membershipTier,
        isActive:     typeof u.isActive === 'boolean' ? u.isActive : true,
        deactivationReason: audit.deactivationReason,
        deactivatedBy:    audit.deactivatedBy,
        deactivatedAt:    audit.deactivatedAt,
        createdAt:    u.createdAt,
        totalOrders:  stats.totalOrders,
        totalSpent:   stats.totalSpent,
        /** true khi có đơn delivered đang requested|approved — tiền/hạng vẫn cộng nhưng đang chờ kết quả hoàn. */
        hasProvisionalSpend: !!stats.hasProvisionalSpend,
      };
    });

    if (tierParam === 'member' || tierParam === 'vip') {
      data = data.filter((x) => String(x.membershipTier) === tierParam);
    }

    const tierRank = { member: 1, vip: 2 };

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

// GET /api/admin/customers/:id/addresses — sổ địa chỉ (form tạo đơn hotline / admin).
// Đăng ký TRƯỚC route /:id để không bị coi "addresses" là ObjectId.
// Dùng findById (không lọc role) để khớp đúng bản ghi mà GET /users/:id/addresses trả về cho khách
// (tránh lệch khi dữ liệu cũ / role không đồng nhất).
router.get('/:id/addresses', async (req, res) => {
  try {
    const rawId = String(req.params.id || '').trim();
    if (!mongoose.Types.ObjectId.isValid(rawId)) {
      return res.status(400).json({ message: 'ID khách không hợp lệ' });
    }

    const user = await User.findById(rawId).select('addresses role').lean();
    if (!user) return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Không lấy sổ địa chỉ cho tài khoản admin' });
    }

    const embedded = Array.isArray(user.addresses) ? user.addresses : [];
    const keySet = new Set(
      embedded.map((a) => addrDedupeKey(a.name, a.phone, a.address))
    );

    // Gộp thêm địa chỉ nhận từ các đơn có userId (trùng sổ thì bỏ qua) — hỗ trợ khi UI khách và admin lệch nguồn.
    const fromOrders = await Order.find({ userId: rawId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('customer orderCode')
      .lean();

    const extras = [];
    for (const o of fromOrders) {
      const c = o.customer;
      if (!c?.fullName || !c?.phone || !c?.address) continue;
      const line = joinOrderCustomerAddress(c);
      if (!line) continue;
      const k = addrDedupeKey(c.fullName, c.phone, line);
      if (keySet.has(k)) continue;
      keySet.add(k);
      extras.push({
        _id: `ordaddr_${String(o._id)}`,
        name: String(c.fullName).trim(),
        phone: String(c.phone).trim(),
        address: line,
        isDefault: false,
        fromOrder: true,
        orderCode: o.orderCode ? String(o.orderCode) : '',
      });
    }

    res.json({ addresses: [...embedded, ...extras] });
  } catch (err) {
    console.error('GET /api/admin/customers/:id/addresses error:', err);
    res.status(500).json({ message: err.message || 'Lỗi server' });
  }
});

// GET /api/admin/customers/:id
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'user' }).lean();
    if (!user) return res.status(404).json({ message: 'Không tìm thấy khách hàng' });

    const statsMaps = await buildCustomerListStatsMaps(Order);
    const stats = statsForUser(user, statsMaps);
    const membershipTier = membershipTierFromTotalSpent90d(stats.totalSpent90d);

    const audit = deactivationAuditForDoc(user);
    res.json({
      id:           String(user._id),
      customerID:   user.customerID || '',
      username:     user.username,
      phone:        user.phone,
      email:        user.email || '',
      address:      user.address || '',
      membershipTier,
      isActive:     typeof user.isActive === 'boolean' ? user.isActive : true,
      deactivationReason: audit.deactivationReason,
      deactivatedBy:    audit.deactivatedBy,
      deactivatedAt:    audit.deactivatedAt,
      createdAt:    user.createdAt,
      totalOrders:  stats.totalOrders,
      totalSpent:   stats.totalSpent,
      hasProvisionalSpend: !!stats.hasProvisionalSpend,
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

    // Bật lại qua PUT: xóa lý do + audit khóa (cùng hành vi với toggle-active)
    if (update.isActive === true) {
      update.deactivationReason = '';
      update.deactivatedBy = '';
      update.deactivatedAt = null;
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'user' },
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!user) return res.status(404).json({ message: 'Không tìm thấy khách hàng' });

    const statsMaps = await buildCustomerListStatsMaps(Order);
    const stats = statsForUser(user, statsMaps);
    const membershipTier = membershipTierFromTotalSpent90d(stats.totalSpent90d);
    const audit = deactivationAuditForDoc(user);

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
        deactivationReason: audit.deactivationReason,
        deactivatedBy:    audit.deactivatedBy,
        deactivatedAt:    audit.deactivatedAt,
        createdAt:    user.createdAt,
        totalOrders:  stats.totalOrders,
        totalSpent:   stats.totalSpent,
        hasProvisionalSpend: !!stats.hasProvisionalSpend,
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
// Khi chuyển sang khóa: body { reason } bắt buộc (khách sẽ thấy khi đăng nhập).
// Khi mở khóa: xóa deactivationReason.
router.patch('/:id/toggle-active', async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'user' });
    if (!user) return res.status(404).json({ message: 'Không tìm thấy khách hàng' });

    const currentlyActive = typeof user.isActive === 'boolean' ? user.isActive : true;
    const newStatus = !currentlyActive;

    if (newStatus === false) {
      const reason = String(req.body?.reason ?? '').trim();
      // Bắt buộc có lý do (không được để trống) — khách và admin đều thấy rõ.
      if (reason.length === 0) {
        return res.status(400).json({
          message: 'Vui lòng nhập lý do vô hiệu hóa.',
        });
      }
      const performedBy = String(req.body?.performedBy ?? '').trim().slice(0, 200) || 'Quản trị viên';
      user.isActive = false;
      user.deactivationReason = reason.slice(0, 2000);
      user.deactivatedBy = performedBy;
      user.deactivatedAt = new Date();
    } else {
      user.isActive = true;
      user.deactivationReason = '';
      user.deactivatedBy = '';
      user.deactivatedAt = null;
    }

    await user.save();

    if (newStatus === false) {
      emitAccountDisabled(String(user._id), {
        reason: String(user.deactivationReason || ''),
        deactivatedBy: String(user.deactivatedBy || ''),
        deactivatedAt: user.deactivatedAt ? user.deactivatedAt.toISOString() : new Date().toISOString(),
      });
    }

    const audit = deactivationAuditForDoc(user);
    res.json({
      message:  newStatus ? 'Đã kích hoạt tài khoản' : 'Đã khóa tài khoản',
      isActive: newStatus,
      deactivationReason: audit.deactivationReason,
      deactivatedBy:    audit.deactivatedBy,
      deactivatedAt:    audit.deactivatedAt,
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

