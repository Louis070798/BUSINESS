const express = require('express');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();
router.use(authenticate);

// ============================================
// DANH SÁCH GÓI CƯỚC
// ============================================
router.get('/', authorize('service_plans', 'view'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, plan_type, status } = req.query;
    const offset = (page - 1) * limit;

    let query = db('service_plans');

    // Mặc định chỉ hiện gói cước đang hoạt động
    if (!status) {
      query = query.where('is_active', true);
    }

    if (search) {
      query = query.where(function () {
        this.where('name', 'ilike', `%${search}%`)
          .orWhere('code', 'ilike', `%${search}%`);
      });
    }
    if (plan_type) query = query.where('plan_type', plan_type);
    if (status) query = query.where('status', status);

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
    console.error('Get service plans error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách gói cước' });
  }
});

// ============================================
// CHI TIẾT GÓI CƯỚC
// ============================================
router.get('/:id', authorize('service_plans', 'view'), async (req, res) => {
  try {
    const plan = await db('service_plans').where('id', req.params.id).first();
    if (!plan) {
      return res.status(404).json({ error: 'Không tìm thấy gói cước' });
    }

    // Đếm subscriptions đang active
    const activeCount = await db('subscriptions')
      .where('service_plan_id', req.params.id)
      .where('status', 'active')
      .count('* as count')
      .first();

    res.json({
      data: plan,
      activeSubscriptions: parseInt(activeCount.count),
    });
  } catch (error) {
    console.error('Get service plan detail error:', error);
    res.status(500).json({ error: 'Lỗi lấy thông tin gói cước' });
  }
});

// ============================================
// TẠO GÓI CƯỚC
// ============================================
router.post('/', authorize('service_plans', 'create'), [
  body('name').notEmpty().withMessage('Tên gói cước không được để trống'),
  body('retail_price').isFloat({ min: 0 }).withMessage('Giá bán lẻ phải >= 0'),
  validate,
], auditLog('create', 'service_plans'), async (req, res) => {
  try {
    // Tự động tạo mã gói cước nếu không có
    if (!req.body.code) {
      const last = await db('service_plans').orderBy('id', 'desc').first();
      const nextNum = (last?.id || 0) + 1;
      req.body.code = `GC${String(nextNum).padStart(3, '0')}`;
    }

    const exists = await db('service_plans').where('code', req.body.code).first();
    if (exists) {
      return res.status(400).json({ error: 'Mã gói cước đã tồn tại' });
    }

    const [plan] = await db('service_plans').insert(req.body).returning('*');
    res.status(201).json({ id: plan.id, message: 'Tạo gói cước thành công' });
  } catch (error) {
    console.error('Create service plan error:', error);
    res.status(500).json({ error: 'Lỗi tạo gói cước' });
  }
});

// ============================================
// CẬP NHẬT GÓI CƯỚC
// ============================================
router.put('/:id', authorize('service_plans', 'edit'), [
  body('name').notEmpty().withMessage('Tên gói cước không được để trống'),
  validate,
], auditLog('update', 'service_plans'), async (req, res) => {
  try {
    const { id, code, ...updateData } = req.body;
    await db('service_plans').where('id', req.params.id).update({
      ...updateData,
      updated_at: new Date(),
    });
    res.json({ message: 'Cập nhật gói cước thành công' });
  } catch (error) {
    console.error('Update service plan error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật gói cước' });
  }
});

// ============================================
// XÓA GÓI CƯỚC (soft delete)
// ============================================
router.delete('/:id', authorize('service_plans', 'delete'), auditLog('delete', 'service_plans'), async (req, res) => {
  try {
    await db('service_plans').where('id', req.params.id).update({ is_active: false, status: 'inactive' });
    res.json({ message: 'Đã vô hiệu hóa gói cước' });
  } catch (error) {
    console.error('Delete service plan error:', error);
    res.status(500).json({ error: 'Lỗi xóa gói cước' });
  }
});

module.exports = router;
