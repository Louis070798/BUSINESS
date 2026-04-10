const express = require('express');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();
router.use(authenticate);

// ============================================
// DANH SÁCH NHÓM KHÁCH HÀNG (phải đặt trước /:id)
// ============================================
router.get('/groups/all', async (req, res) => {
  try {
    const groups = await db('customer_groups').where('is_active', true).orderBy('id');
    res.json({ data: groups });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy nhóm khách hàng' });
  }
});

// ============================================
// DANH SÁCH KHÁCH HÀNG
// ============================================
router.get('/', authorize('customers', 'view'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, group_id, is_active } = req.query;
    const offset = (page - 1) * limit;

    let query = db('customers')
      .leftJoin('customer_groups', 'customers.group_id', 'customer_groups.id')
      .select('customers.*', 'customer_groups.name as group_name', 'customer_groups.code as group_code');

    if (search) {
      query = query.where(function () {
        this.where('customers.customer_name', 'ilike', `%${search}%`)
          .orWhere('customers.company_name', 'ilike', `%${search}%`)
          .orWhere('customers.code', 'ilike', `%${search}%`)
          .orWhere('customers.phone', 'ilike', `%${search}%`)
          .orWhere('customers.email', 'ilike', `%${search}%`);
      });
    }
    if (group_id) query = query.where('customers.group_id', group_id);
    // Mặc định chỉ hiện khách hàng active, trừ khi gửi is_active=false
    if (is_active === undefined || is_active === 'true') {
      query = query.where('customers.is_active', true);
    } else if (is_active === 'false') {
      query = query.where('customers.is_active', false);
    }

    const total = await query.clone().clearSelect().count('* as count').first();
    const data = await query.orderBy('customers.created_at', 'desc').limit(limit).offset(offset);

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
    console.error('Get customers error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách khách hàng' });
  }
});

// ============================================
// CHI TIẾT KHÁCH HÀNG
// ============================================
router.get('/:id', authorize('customers', 'view'), async (req, res) => {
  try {
    const customer = await db('customers')
      .leftJoin('customer_groups', 'customers.group_id', 'customer_groups.id')
      .where('customers.id', req.params.id)
      .select('customers.*', 'customer_groups.name as group_name', 'customer_groups.code as group_code')
      .first();

    if (!customer) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    }

    // Lấy lịch sử đơn hàng gần đây
    const recentOrders = await db('sales_orders')
      .where('customer_id', req.params.id)
      .orderBy('order_date', 'desc')
      .limit(10);

    // Lấy gói cước đang hoạt động
    const activeSubscriptions = await db('subscriptions')
      .leftJoin('service_plans', 'subscriptions.service_plan_id', 'service_plans.id')
      .where('subscriptions.customer_id', req.params.id)
      .where('subscriptions.status', 'active')
      .select('subscriptions.*', 'service_plans.name as plan_name');

    // Tính công nợ
    const debt = await db('receivables')
      .where('customer_id', req.params.id)
      .where('status', '!=', 'paid')
      .sum('remaining_amount as total_debt')
      .first();

    res.json({
      data: customer,
      recentOrders,
      activeSubscriptions,
      totalDebt: parseFloat(debt?.total_debt || 0),
    });
  } catch (error) {
    console.error('Get customer detail error:', error);
    res.status(500).json({ error: 'Lỗi lấy thông tin khách hàng' });
  }
});

// ============================================
// TẠO KHÁCH HÀNG
// ============================================
router.post('/', authorize('customers', 'create'), [
  body('customer_name').optional(),
  body('group_id').isInt().withMessage('Nhóm khách hàng không hợp lệ'),
  validate,
], auditLog('create', 'customers'), async (req, res) => {
  try {
    // Hỗ trợ cả field name "customer_name" và "name" từ frontend
    if (!req.body.customer_name && req.body.name) {
      req.body.customer_name = req.body.name;
      delete req.body.name;
    }
    if (!req.body.customer_name) {
      return res.status(400).json({ error: 'Tên khách hàng không được để trống' });
    }

    // Tự động tạo mã KH nếu không có
    if (!req.body.code) {
      const last = await db('customers').orderBy('id', 'desc').first();
      const nextNum = (last?.id || 0) + 1;
      req.body.code = `KH${String(nextNum).padStart(3, '0')}`;
    }

    const exists = await db('customers').where('code', req.body.code).first();
    if (exists) {
      return res.status(400).json({ error: 'Mã khách hàng đã tồn tại' });
    }

    const [customer] = await db('customers').insert({
      ...req.body,
      created_by: req.user.id,
    }).returning('*');

    res.status(201).json({ id: customer.id, message: 'Tạo khách hàng thành công' });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Lỗi tạo khách hàng' });
  }
});

// ============================================
// CẬP NHẬT KHÁCH HÀNG
// ============================================
router.put('/:id', authorize('customers', 'edit'), [
  validate,
], auditLog('update', 'customers'), async (req, res) => {
  try {
    // Hỗ trợ cả field name "customer_name" và "name"
    if (!req.body.customer_name && req.body.name) {
      req.body.customer_name = req.body.name;
      delete req.body.name;
    }
    if (!req.body.customer_name) {
      return res.status(400).json({ error: 'Tên khách hàng không được để trống' });
    }
    const { code, created_by, id, ...updateData } = req.body;
    await db('customers').where('id', req.params.id).update({
      ...updateData,
      updated_at: new Date(),
    });

    res.json({ message: 'Cập nhật khách hàng thành công' });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật khách hàng' });
  }
});

// ============================================
// XÓA KHÁCH HÀNG (soft delete)
// ============================================
router.delete('/:id', authorize('customers', 'delete'), auditLog('delete', 'customers'), async (req, res) => {
  try {
    await db('customers').where('id', req.params.id).update({ is_active: false });
    res.json({ message: 'Đã vô hiệu hóa khách hàng' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ error: 'Lỗi xóa khách hàng' });
  }
});

module.exports = router;
