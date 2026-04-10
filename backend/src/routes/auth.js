const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// ============================================
// ĐĂNG NHẬP
// ============================================
router.post('/login', [
  body('email').isEmail().withMessage('Email không hợp lệ'),
  body('password').notEmpty().withMessage('Mật khẩu không được để trống'),
  validate,
], async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db('users')
      .join('roles', 'users.role_id', 'roles.id')
      .where('users.email', email)
      .where('users.is_active', true)
      .select('users.*', 'roles.code as role_code', 'roles.name as role_name', 'roles.permissions')
      .first();

    if (!user) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    // Cập nhật thời gian đăng nhập
    await db('users').where('id', user.id).update({ last_login: new Date() });

    // Ghi log đăng nhập
    await db('audit_logs').insert({
      user_id: user.id,
      user_name: user.full_name,
      action: 'login',
      entity_type: 'auth',
      ip_address: req.ip,
      description: `${user.full_name} đã đăng nhập`,
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role_code },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        role_code: user.role_code,
        role_name: user.role_name,
        permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Lỗi đăng nhập' });
  }
});

// ============================================
// LẤY THÔNG TIN USER HIỆN TẠI
// ============================================
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

// ============================================
// ĐỔI MẬT KHẨU
// ============================================
router.put('/change-password', authenticate, [
  body('currentPassword').notEmpty().withMessage('Mật khẩu hiện tại không được để trống'),
  body('newPassword').isLength({ min: 6 }).withMessage('Mật khẩu mới phải ít nhất 6 ký tự'),
  validate,
], async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await db('users').where('id', req.user.id).first();

    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await db('users').where('id', req.user.id).update({ password_hash: hash });

    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Lỗi đổi mật khẩu' });
  }
});

module.exports = router;
