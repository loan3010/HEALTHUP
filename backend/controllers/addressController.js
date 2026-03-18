// backend/controllers/addressController.js

const Address = require('../models/Address');
const mongoose = require('mongoose');

// GET /api/addresses - Lấy tất cả địa chỉ của user
exports.getAddresses = async (req, res) => {
  try {
    const userId = req.user.id; // Lấy từ token

    const addresses = await Address.find({ userId })
      .sort({ isDefault: -1, createdAt: -1 }); // Default trước, mới nhất sau

    res.status(200).json(addresses);
  } catch (error) {
    console.error('Error getting addresses:', error);
    res.status(500).json({ 
      message: 'Lỗi khi lấy danh sách địa chỉ',
      error: error.message 
    });
  }
};

// POST /api/addresses - Thêm địa chỉ mới
exports.createAddress = async (req, res) => {
  try {
    const { name, phone, address, isDefault } = req.body;
    const userId = req.user.id; // Lấy từ token

    // Validation
    if (!name || !phone || !address) {
      return res.status(400).json({ 
        message: 'Vui lòng điền đầy đủ thông tin' 
      });
    }

    // Nếu set làm mặc định, bỏ default của các địa chỉ khác
    if (isDefault) {
      await Address.updateMany(
        { userId },
        { $set: { isDefault: false } }
      );
    }

    // Tạo địa chỉ mới
    const newAddress = new Address({
      userId,
      name,
      phone,
      address,
      isDefault: isDefault || false
    });

    await newAddress.save();

    res.status(201).json(newAddress);
  } catch (error) {
    console.error('Error creating address:', error);
    
    // Validation error từ Mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: messages.join(', ') 
      });
    }

    res.status(500).json({ 
      message: 'Lỗi khi thêm địa chỉ',
      error: error.message 
    });
  }
};

// PUT /api/addresses/:id - Cập nhật địa chỉ
exports.updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address, isDefault } = req.body;
    const userId = req.user.id; // Lấy từ token

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    // Tìm địa chỉ
    const existingAddress = await Address.findById(id);
    
    if (!existingAddress) {
      return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
    }

    // Kiểm tra quyền sở hữu
    if (existingAddress.userId.toString() !== userId) {
      return res.status(403).json({ 
        message: 'Bạn không có quyền sửa địa chỉ này' 
      });
    }

    // Validation
    if (!name || !phone || !address) {
      return res.status(400).json({ 
        message: 'Vui lòng điền đầy đủ thông tin' 
      });
    }

    // Nếu set làm mặc định, bỏ default của các địa chỉ khác
    if (isDefault) {
      await Address.updateMany(
        { userId, _id: { $ne: id } },
        { $set: { isDefault: false } }
      );
    }

    // Cập nhật địa chỉ
    existingAddress.name = name;
    existingAddress.phone = phone;
    existingAddress.address = address;
    existingAddress.isDefault = isDefault || false;

    await existingAddress.save();

    res.status(200).json(existingAddress);
  } catch (error) {
    console.error('Error updating address:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }

    res.status(500).json({ 
      message: 'Lỗi khi cập nhật địa chỉ',
      error: error.message 
    });
  }
};

// DELETE /api/addresses/:id - Xóa địa chỉ
exports.deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id; // Lấy từ token

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    // Tìm địa chỉ
    const existingAddress = await Address.findById(id);
    
    if (!existingAddress) {
      return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
    }

    // Kiểm tra quyền sở hữu
    if (existingAddress.userId.toString() !== userId) {
      return res.status(403).json({ 
        message: 'Bạn không có quyền xóa địa chỉ này' 
      });
    }

    await Address.findByIdAndDelete(id);

    res.status(200).json({ message: 'Xóa địa chỉ thành công' });
  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).json({ 
      message: 'Lỗi khi xóa địa chỉ',
      error: error.message 
    });
  }
};

// PUT /api/addresses/:id/set-default - Đặt địa chỉ làm mặc định
exports.setDefaultAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id; // Lấy từ token

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    // Tìm địa chỉ
    const existingAddress = await Address.findById(id);
    
    if (!existingAddress) {
      return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
    }

    // Kiểm tra quyền sở hữu
    if (existingAddress.userId.toString() !== userId) {
      return res.status(403).json({ 
        message: 'Bạn không có quyền sửa địa chỉ này' 
      });
    }

    // Bỏ default của tất cả địa chỉ của user
    await Address.updateMany(
      { userId },
      { $set: { isDefault: false } }
    );

    // Set địa chỉ này làm mặc định
    existingAddress.isDefault = true;
    await existingAddress.save();

    res.status(200).json({ message: 'Đã đặt làm địa chỉ mặc định' });
  } catch (error) {
    console.error('Error setting default address:', error);
    res.status(500).json({ 
      message: 'Lỗi khi đặt địa chỉ mặc định',
      error: error.message 
    });
  }
};