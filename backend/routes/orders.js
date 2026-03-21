const express  = require('express');
const mongoose = require('mongoose');
const router   = express.Router();

const Order     = require('../models/Order');
const Product   = require('../models/Product');
const Cart      = require('../models/Cart');
const Promotion = require('../models/Promotion');

// ======================= HELPER =======================

function isValidPhoneVN(phone) {
  return /^0\d{9}$/.test(String(phone || '').trim());
}

function calcShipping(subTotal, shippingMethod) {
  if (shippingMethod === 'express') return 30000;
  return subTotal > 500000 ? 0 : 20000;
}

/**
 * Tính discount từ DB theo type của promo.
 * Trả về { discountAmount, discountOnType }
 */
async function calcDiscountFromDB(voucherCode, subTotal, shippingFee) {
  if (!voucherCode) return { discountAmount: 0, discountOnType: null };

  const now   = new Date();
  const promo = await Promotion.findOne({
    code:      voucherCode.trim().toUpperCase(),
    status:    'ongoing',
    startDate: { $lte: now },
    endDate:   { $gte: now },
  });

  if (!promo) return { discountAmount: 0, discountOnType: null };
  if (promo.totalLimit > 0 && promo.usedCount >= promo.totalLimit) {
    return { discountAmount: 0, discountOnType: null };
  }
  if (subTotal < promo.minOrder) return { discountAmount: 0, discountOnType: null };

  let discountAmount = 0;
  // Dùng promo.type làm chuẩn phân loại (order | shipping)
  const discountOnType = (promo.type === 'shipping') ? 'shipping' : 'items';

  if (promo.type === 'shipping') {
    // Mã giảm phí vận chuyển
    if (promo.discountType === 'percent') {
      discountAmount = Math.round(Number(shippingFee) * promo.discountValue / 100);
      if (promo.maxDiscount > 0 && discountAmount > promo.maxDiscount) {
        discountAmount = promo.maxDiscount;
      }
    } else if (promo.discountType === 'fixed') {
      discountAmount = Math.min(promo.discountValue, Number(shippingFee));
    } else {
      // freeship → giảm toàn bộ phí ship
      discountAmount = Number(shippingFee);
    }
  } else {
    // Mã giảm tiền hàng (promo.type === 'order')
    if (promo.discountType === 'percent') {
      discountAmount = Math.round(subTotal * promo.discountValue / 100);
      if (promo.maxDiscount > 0 && discountAmount > promo.maxDiscount) {
        discountAmount = promo.maxDiscount;
      }
    } else if (promo.discountType === 'fixed') {
      discountAmount = promo.discountValue;
    }
  }

  return { discountAmount, discountOnType };
}

// ======================= CREATE ORDER =======================

router.post('/', async (req, res) => {
  try {
    const {
      customer,
      items,
      shippingMethod,
      paymentMethod,
      voucherCode,     // mã giảm tiền hàng
      shipVoucherCode, // mã giảm phí vận chuyển
      userId
    } = req.body;

    // Validate customer
    if (!customer?.fullName || !customer?.phone || !customer?.address) {
      return res.status(400).json({ message: 'Thiếu thông tin khách hàng' });
    }
    if (!isValidPhoneVN(customer.phone)) {
      return res.status(400).json({ message: 'Số điện thoại không hợp lệ' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Giỏ hàng trống' });
    }

    // Validate items
    const normalizedIn = items.map(i => ({
      productId:    String(i.productId || '').trim(),
      variantId:    String(i.variantId || '').trim(),
      variantLabel: String(i.variantLabel || '').trim(),
      quantity:     Math.max(1, Number(i.quantity || 1)),
    }));

    const invalidIds = normalizedIn
      .filter(i => !mongoose.Types.ObjectId.isValid(i.productId))
      .map(i => i.productId);

    if (invalidIds.length) {
      return res.status(400).json({ message: 'productId không hợp lệ', invalidIds });
    }

    const invalidVariantIds = normalizedIn
      .filter(i => i.variantId && !mongoose.Types.ObjectId.isValid(i.variantId))
      .map(i => i.variantId);

    if (invalidVariantIds.length) {
      return res.status(400).json({ message: 'variantId không hợp lệ', invalidVariantIds });
    }

    const ids      = normalizedIn.map(i => new mongoose.Types.ObjectId(i.productId));
    const products = await Product.find({ _id: { $in: ids } }).lean();
    const map      = new Map(products.map(p => [String(p._id), p]));

    const missing = normalizedIn
      .filter(i => !map.has(i.productId))
      .map(i => i.productId);

    if (missing.length) {
      return res.status(400).json({ message: 'Có sản phẩm không tồn tại', missing });
    }

    // Build order items
    let subTotal   = 0;
    const orderItems = [];

    for (const i of normalizedIn) {
      const p = map.get(i.productId);
      let variant = null;

      if (i.variantId && mongoose.Types.ObjectId.isValid(i.variantId)) {
        variant = (p.variants || []).find(v => String(v._id) === String(i.variantId));
        if (!variant) {
          return res.status(400).json({
            message: `Biến thể không tồn tại cho sản phẩm ${p.name}`
          });
        }
      }

      const qty       = i.quantity;
      const available = Number(variant?.stock ?? p.stock ?? 0);
      if (qty > available) {
        return res.status(400).json({
          message: `Sản phẩm "${p.name}" chỉ còn ${available} trong kho`
        });
      }

      const price = Number(variant?.price ?? p.price ?? 0);
      subTotal   += price * qty;

      orderItems.push({
        productId:    p._id,
        variantId:    variant?._id || null,
        variantLabel: variant?.label || i.variantLabel || '',
        name:         p.name || 'Product',
        price,
        quantity:     qty,
        imageUrl:     p.images?.[0] ?? null,
      });
    }

    const ship = calcShipping(subTotal, shippingMethod);

    // Tính discount tiền hàng (voucherCode)
    const { discountAmount: discOrder, discountOnType: typeOrder } =
      await calcDiscountFromDB(voucherCode, subTotal, ship);

    // Tính discount phí ship (shipVoucherCode)
    const { discountAmount: discShip, discountOnType: typeShip } =
      await calcDiscountFromDB(shipVoucherCode, subTotal, ship);

    const totalDiscount = discOrder + discShip;
    const total = Math.max(0, subTotal - discOrder + ship - discShip);

    // Build order data
    const orderData = {
      customer: {
        fullName: customer.fullName,
        phone:    customer.phone,
        email:    customer.email || '',
        address:  customer.address,
        province: customer.province || 'N/A',
        district: customer.district || 'N/A',
        ward:     customer.ward     || 'N/A',
        note:     customer.note     || '',
      },
      items:           orderItems,
      shippingMethod:  shippingMethod || 'standard',
      paymentMethod:   paymentMethod  || 'cod',
      voucherCode:     voucherCode     || null,
      shipVoucherCode: shipVoucherCode || null,
      subTotal,
      shippingFee:     ship,
      discount:        totalDiscount,
      discountOnItems:    discOrder,
      discountOnShipping: discShip,
      total,
      status:  'pending',
      userId:  null,
    };

    if (userId && mongoose.Types.ObjectId.isValid(String(userId))) {
      orderData.userId = new mongoose.Types.ObjectId(String(userId));
    }

    const order = await Order.create(orderData);

    // Tăng usedCount cho cả 2 voucher nếu có
    const voucherUpdates = [];
    if (voucherCode) {
      voucherUpdates.push(
        Promotion.updateOne(
          { code: voucherCode.trim().toUpperCase() },
          { $inc: { usedCount: 1 } }
        )
      );
    }
    if (shipVoucherCode) {
      voucherUpdates.push(
        Promotion.updateOne(
          { code: shipVoucherCode.trim().toUpperCase() },
          { $inc: { usedCount: 1 } }
        )
      );
    }
    if (voucherUpdates.length) await Promise.all(voucherUpdates);

    // Xóa sản phẩm đã mua khỏi cart trên DB
    if (order.userId) {
      const boughtIds = orderItems.map(i => String(i.productId));
      try {
        const cart = await Cart.findOne({ userId: order.userId });
        if (cart) {
          cart.items = cart.items.filter(i => !boughtIds.includes(String(i.productId)));
          await cart.save();
        }
      } catch (e) { /* không chặn response nếu lỗi xóa cart */ }
    }

    // Trừ kho + cộng sold sau khi tạo đơn thành công
    for (const item of orderItems) {
      const p = await Product.findById(item.productId);
      if (!p) continue;

      if (item.variantId) {
        const idx = (p.variants || []).findIndex(
          v => String(v._id) === String(item.variantId)
        );
        if (idx >= 0) {
          p.variants[idx].stock = Math.max(
            0,
            Number(p.variants[idx].stock || 0) - Number(item.quantity || 0)
          );
        }
      } else {
        p.stock = Math.max(
          0,
          Number(p.stock || 0) - Number(item.quantity || 0)
        );
      }

      // Đồng bộ stock tổng từ variants
      if (Array.isArray(p.variants) && p.variants.length > 0) {
        p.stock = p.variants.reduce((sum, v) => sum + Number(v.stock || 0), 0);
      }

      // FIX: Cộng số lượng đã bán
      p.sold = Number(p.sold || 0) + Number(item.quantity || 0);

      await p.save();
    }

    return res.status(201).json({ orderId: order._id });

  } catch (err) {
    console.error(err);
    if (err?.name === 'CastError') {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }
    return res.status(500).json({ message: err?.message || 'Server error' });
  }
});

// ======================= GET ALL / GET BY USER =======================

router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    const filter = userId && mongoose.Types.ObjectId.isValid(userId)
      ? { userId: new mongoose.Types.ObjectId(userId) }
      : {};
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ======================= GET ORDERS BY USER =======================

router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'userId không hợp lệ' });
    }
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ======================= GET ORDER BY ID =======================

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }
    const order = await Order.findById(req.params.id).populate('items.productId');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    return res.json(order);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// ======================= UPDATE STATUS =======================

router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Status không hợp lệ' });
    }
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ======================= DELETE ORDER =======================

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }
    const order = await Order.findByIdAndDelete(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json({ message: 'Đã hủy đơn hàng', orderId: id });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;