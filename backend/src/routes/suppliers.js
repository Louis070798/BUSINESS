const express = require('express');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    let query = db('suppliers').where('is_active', true);

    if (search) {
      query = query.where(function () {
        this.where('name', 'ilike', `%${search}%`)
          .orWhere('code', 'ilike', `%${search}%`)
          .orWhere('phone', 'ilike', `%${search}%`);
      });
    }

    const total = await query.clone().clearSelect().count('* as count').first();
    const data = await query.orderBy('created_at', 'desc').limit(limit).offset(offset);

    res.json({
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.count),
        totalPages: Math.ceil(total.count / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy danh sách NCC' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const supplier = await db('suppliers').where('id', req.params.id).first();
    if (!supplier) return res.status(404).json({ error: 'Không tìm thấy NCC' });
    res.json({ data: supplier });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy thông tin NCC' });
  }
});

router.post('/', authorize('purchases', 'create'), [
  body('name').notEmpty().withMessage('Tên NCC không được để trống'),
  validate,
], auditLog('create', 'suppliers'), async (req, res) => {
  try {
    // Tự động tạo mã NCC nếu không có
    if (!req.body.code) {
      const last = await db('suppliers').orderBy('id', 'desc').first();
      const nextNum = (last?.id || 0) + 1;
      req.body.code = `NCC${String(nextNum).padStart(3, '0')}`;
    }

    const exists = await db('suppliers').where('code', req.body.code).first();
    if (exists) return res.status(400).json({ error: 'Mã NCC đã tồn tại' });

    const [supplier] = await db('suppliers').insert(req.body).returning('*');
    res.status(201).json({ id: supplier.id, message: 'Tạo NCC thành công' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi tạo NCC' });
  }
});

router.put('/:id', authorize('purchases', 'edit'), [
  body('name').notEmpty().withMessage('Tên NCC không được để trống'),
  validate,
], auditLog('update', 'suppliers'), async (req, res) => {
  try {
    const { id, code, ...updateData } = req.body;
    await db('suppliers').where('id', req.params.id).update({ ...updateData, updated_at: new Date() });
    res.json({ message: 'Cập nhật NCC thành công' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi cập nhật NCC' });
  }
});

router.delete('/:id', authorize('purchases', 'delete'), auditLog('delete', 'suppliers'), async (req, res) => {
  try {
    await db('suppliers').where('id', req.params.id).update({ is_active: false });
    res.json({ message: 'Đã vô hiệu hóa NCC' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi xóa NCC' });
  }
});

module.exports = router;
