const Address = require('../models/Address');
const mongoose = require('mongoose');

// GET /api/addresses
exports.getAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    const addresses = await Address.find({ userId })
      .sort({ isDefault: -1, createdAt: -1 });
    res.status(200).json(addresses);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách địa chỉ', error: error.message });
  }
};

// POST /api/addresses
exports.createAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name, phone, address,
      street, wardName, wardCode,
      districtName, districtCode,
      provinceName, provinceCode,
      isDefault
    } = req.body;

    if (!name || !phone || !address) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin' });
    }

    if (isDefault) {
      await Address.updateMany({ userId }, { $set: { isDefault: false } });
    }

    const newAddress = new Address({
      userId,
      name,
      phone,
      address,
      street:       street       || '',
      wardName:     wardName     || '',
      wardCode:     wardCode     || null,
      districtName: districtName || '',
      districtCode: districtCode || null,
      provinceName: provinceName || '',
      provinceCode: provinceCode || null,
      isDefault:    isDefault    || false,
    });

    await newAddress.save();
    res.status(201).json(newAddress);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: 'Lỗi khi thêm địa chỉ', error: error.message });
  }
};

// PUT /api/addresses/:id
exports.updateAddress = async (req, res) => {
  try {
    const { id }  = req.params;
    const userId  = req.user.id;
    const {
      name, phone, address,
      street, wardName, wardCode,
      districtName, districtCode,
      provinceName, provinceCode,
      isDefault
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const existingAddress = await Address.findById(id);
    if (!existingAddress) {
      return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
    }

    if (existingAddress.userId.toString() !== userId) {
      return res.status(403).json({ message: 'Bạn không có quyền sửa địa chỉ này' });
    }

    if (!name || !phone || !address) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin' });
    }

    if (isDefault) {
      await Address.updateMany(
        { userId, _id: { $ne: id } },
        { $set: { isDefault: false } }
      );
    }

    // ✅ Cập nhật tất cả field, giữ lại giá trị cũ nếu không truyền mới
    existingAddress.name         = name;
    existingAddress.phone        = phone;
    existingAddress.address      = address;
    existingAddress.street       = street       !== undefined ? street       : existingAddress.street;
    existingAddress.wardName     = wardName     !== undefined ? wardName     : existingAddress.wardName;
    existingAddress.wardCode     = wardCode     !== undefined ? wardCode     : existingAddress.wardCode;
    existingAddress.districtName = districtName !== undefined ? districtName : existingAddress.districtName;
    existingAddress.districtCode = districtCode !== undefined ? districtCode : existingAddress.districtCode;
    existingAddress.provinceName = provinceName !== undefined ? provinceName : existingAddress.provinceName;
    existingAddress.provinceCode = provinceCode !== undefined ? provinceCode : existingAddress.provinceCode;
    existingAddress.isDefault    = isDefault    || false;

    await existingAddress.save();
    res.status(200).json(existingAddress);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: 'Lỗi khi cập nhật địa chỉ', error: error.message });
  }
};

// DELETE /api/addresses/:id
exports.deleteAddress = async (req, res) => {
  try {
    const { id }  = req.params;
    const userId  = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const existingAddress = await Address.findById(id);
    if (!existingAddress) {
      return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
    }

    if (existingAddress.userId.toString() !== userId) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa địa chỉ này' });
    }

    await Address.findByIdAndDelete(id);
    res.status(200).json({ message: 'Xóa địa chỉ thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xóa địa chỉ', error: error.message });
  }
};

// PUT /api/addresses/:id/set-default
exports.setDefaultAddress = async (req, res) => {
  try {
    const { id }  = req.params;
    const userId  = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const existingAddress = await Address.findById(id);
    if (!existingAddress) {
      return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
    }

    if (existingAddress.userId.toString() !== userId) {
      return res.status(403).json({ message: 'Bạn không có quyền sửa địa chỉ này' });
    }

    await Address.updateMany({ userId }, { $set: { isDefault: false } });
    existingAddress.isDefault = true;
    await existingAddress.save();

    res.status(200).json({ message: 'Đã đặt làm địa chỉ mặc định' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi đặt địa chỉ mặc định', error: error.message });
  }
};