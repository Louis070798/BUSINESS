const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Tất cả route đều cần xác thực
router.use(authenticate);

// ============================================
// DANH SÁCH ROLES (phải đặt trước /:id)
// ============================================
router.get('/roles/all', async (req, res) => {
  try {
    const roles = await db('roles').where('is_active', true).orderBy('id');
    res.json({ data: roles });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy danh sách vai trò' });
  }
});

// ============================================
// DANH SÁCH USERS
// ============================================
router.get('/', authorize('users', 'view'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role_id, is_active } = req.query;
    const offset = (page - 1) * limit;

    let query = db('users')
      .join('roles', 'users.role_id', 'roles.id')
      .select('users.id', 'users.username', 'users.email', 'users.full_name', 'users.phone',
        'users.is_active', 'users.last_login', 'users.created_at',
        'roles.name as role_name', 'roles.code as role_code');

    if (search) {
      query = query.where(function () {
        this.where('users.full_name', 'ilike', `%${search}%`)
          .orWhere('users.email', 'ilike', `%${search}%`)
          .orWhere('users.username', 'ilike', `%${search}%`);
      });
    }
    if (role_id) query = query.where('users.role_id', role_id);
    // Mặc định chỉ hiện user active, trừ khi gửi is_active=false
    if (is_active === undefined || is_active === 'true') {
      query = query.where('users.is_active', true);
    } else if (is_active === 'false') {
      query = query.where('users.is_active', false);
    }

    const total = await query.clone().clearSelect().count('* as count').first();
    const users = await query.orderBy('users.created_at', 'desc').limit(limit).offset(offset);

    res.json({
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.count),
        totalPages: Math.ceil(total.count / limit),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách người dùng' });
  }
});

// ============================================
// TẠO USER MỚI
// ============================================
router.post('/', authorize('users', 'create'), [
  body('email').isEmail().withMessage('Email không hợp lệ'),
  body('password').isLength({ min: 6 }).withMessage('Mật khẩu phải ít nhất 6 ký tự'),
  body('full_name').notEmpty().withMessage('Họ tên không được để trống'),
  body('role_id').isInt().withMessage('Vai trò không hợp lệ'),
  validate,
], auditLog('create', 'users'), async (req, res) => {
  try {
    let { username, email, password, full_name, phone, role_id } = req.body;

    // Tự động tạo username từ email nếu không có
    if (!username) {
      username = email.split('@')[0];
    }

    // Kiểm tra trùng
    const exists = await db('users')
      .where('email', email)
      .orWhere('username', username)
      .first();
    if (exists) {
      return res.status(400).json({ error: 'Email hoặc tên đăng nhập đã tồn tại' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [user] = await db('users').insert({
      username, email, password_hash, full_name, phone, role_id,
    }).returning('*');

    res.status(201).json({ id: user.id, message: 'Tạo người dùng thành công' });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Lỗi tạo người dùng' });
  }
});

// ============================================
// CẬP NHẬT USER
// ============================================
router.put('/:id', authorize('users', 'edit'), [
  body('full_name').notEmpty().withMessage('Họ tên không được để trống'),
  validate,
], auditLog('update', 'users'), async (req, res) => {
  try {
    const { full_name, phone, role_id, is_active } = req.body;

    await db('users').where('id', req.params.id).update({
      full_name, phone, role_id, is_active,
      updated_at: new Date(),
    });

    res.json({ message: 'Cập nhật thành công' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật người dùng' });
  }
});

// ============================================
// XÓA USER
// ============================================
router.delete('/:id', authorize('users', 'delete'), auditLog('delete', 'users'), async (req, res) => {
  try {
    await db('users').where('id', req.params.id).update({ is_active: false });
    res.json({ message: 'Đã vô hiệu hóa người dùng' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Lỗi xóa người dùng' });
  }
});

module.exports = router;
