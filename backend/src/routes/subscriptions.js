const express = require('express');
const db = require('../config/database');
const { authenticate, authorize, auditLog } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ============================================
// DANH SÁCH SUBSCRIPTIONS
// ============================================
router.get('/', authorize('sales', 'view'), async (req, res) => {
  try {
    const { page = 1, limit = 20, customer_id, status, expiring_days } = req.query;
    const offset = (page - 1) * limit;

    let query = db('subscriptions')
      .leftJoin('customers', 'subscriptions.customer_id', 'customers.id')
      .leftJoin('service_plans', 'subscriptions.service_plan_id', 'service_plans.id')
      .leftJoin('products', 'subscriptions.product_id', 'products.id')
      .select('subscriptions.*',
        'customers.customer_name', 'customers.company_name',
        'service_plans.name as plan_name', 'service_plans.code as plan_code',
        'products.name as product_name');

    if (customer_id) query = query.where('subscriptions.customer_id', customer_id);
    if (status) query = query.where('subscriptions.status', status);

    // Lọc gói sắp hết hạn
    if (expiring_days) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + parseInt(expiring_days));
      query = query.where('subscriptions.end_date', '<=', futureDate)
        .where('subscriptions.status', 'active');
    }

    const total = await query.clone().clearSelect().count('* as count').first();
    const data = await query.orderBy('subscriptions.created_at', 'desc').limit(limit).offset(offset);

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
    console.error('Get subscriptions error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách gói cước' });
  }
});

// ============================================
// GÓI CƯỚC SẮP HẾT HẠN
// ============================================
router.get('/expiring', authorize('sales', 'view'), async (req, res) => {
  try {
    const days = parseInt(req.query.days || 30);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const data = await db('subscriptions')
      .leftJoin('customers', 'subscriptions.customer_id', 'customers.id')
      .leftJoin('service_plans', 'subscriptions.service_plan_id', 'service_plans.id')
      .where('subscriptions.end_date', '<=', futureDate)
      .where('subscriptions.status', 'active')
      .select('subscriptions.*',
        'customers.customer_name', 'customers.phone as customer_phone',
        'service_plans.name as plan_name')
      .orderBy('subscriptions.end_date', 'asc');

    res.json({ data, count: data.length });
  } catch (error) {
    console.error('Get expiring subscriptions error:', error);
    res.status(500).json({ error: 'Lỗi lấy gói cước sắp hết hạn' });
  }
});

// ============================================
// GÓI CƯỚC CẦN LẬP HÓA ĐƠN
// ============================================
router.get('/pending-billing', authorize('sales', 'view'), async (req, res) => {
  try {
    const today = new Date();

    const data = await db('subscriptions')
      .leftJoin('customers', 'subscriptions.customer_id', 'customers.id')
      .leftJoin('service_plans', 'subscriptions.service_plan_id', 'service_plans.id')
      .where('subscriptions.next_billing_date', '<=', today)
      .where('subscriptions.status', 'active')
      .select('subscriptions.*',
        'customers.customer_name', 'customers.company_name',
        'service_plans.name as plan_name')
      .orderBy('subscriptions.next_billing_date', 'asc');

    res.json({ data, count: data.length });
  } catch (error) {
    console.error('Get pending billing error:', error);
    res.status(500).json({ error: 'Lỗi lấy gói cước cần lập hóa đơn' });
  }
});

// ============================================
// LẬP HÓA ĐƠN HÀNG LOẠT
// ============================================
router.post('/batch-billing', authorize('invoices', 'create'), auditLog('create', 'batch_billing'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const { subscription_ids } = req.body;

    if (!subscription_ids || subscription_ids.length === 0) {
      await trx.rollback();
      return res.status(400).json({ error: 'Chưa chọn gói cước nào' });
    }

    const invoices = [];

    for (const subId of subscription_ids) {
      const sub = await trx('subscriptions')
        .leftJoin('customers', 'subscriptions.customer_id', 'customers.id')
        .leftJoin('service_plans', 'subscriptions.service_plan_id', 'service_plans.id')
        .where('subscriptions.id', subId)
        .where('subscriptions.status', 'active')
        .select('subscriptions.*', 'service_plans.name as plan_name',
          'customers.customer_name')
        .first();

      if (!sub) continue;

      // Tạo hóa đơn
      const invoiceNum = `HD${Date.now()}${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
      const taxAmt = sub.monthly_amount * 0.1;
      const total = sub.monthly_amount + taxAmt;

      const periodStart = new Date(sub.next_billing_date);
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const [invoice] = await trx('invoices').insert({
        invoice_number: invoiceNum,
        invoice_type: 'sales',
        customer_id: sub.customer_id,
        invoice_date: new Date(),
        due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        subtotal: sub.monthly_amount,
        tax_amount: taxAmt,
        grand_total: total,
        status: 'issued',
        payment_status: 'unpaid',
        notes: `Hóa đơn gói cước ${sub.plan_name} kỳ ${periodStart.toLocaleDateString('vi-VN')} - ${periodEnd.toLocaleDateString('vi-VN')}`,
        created_by: req.user.id,
      }).returning('*');

      await trx('invoice_items').insert({
        invoice_id: invoice.id,
        item_type: 'service_plan',
        service_plan_id: sub.service_plan_id,
        description: `${sub.plan_name} (${periodStart.toLocaleDateString('vi-VN')} - ${periodEnd.toLocaleDateString('vi-VN')})`,
        quantity: 1,
        unit_price: sub.monthly_amount,
        tax_percent: 10,
        tax_amount: taxAmt,
        total_amount: total,
      });

      // Ghi nhận billing
      await trx('subscription_billing').insert({
        subscription_id: subId,
        billing_date: new Date(),
        period_start: periodStart,
        period_end: periodEnd,
        amount: sub.monthly_amount,
        tax_amount: taxAmt,
        total_amount: total,
        status: 'invoiced',
        invoice_id: invoice.id,
      });

      // Cập nhật next_billing_date
      const nextBilling = new Date(sub.next_billing_date);
      nextBilling.setMonth(nextBilling.getMonth() + 1);
      await trx('subscriptions').where('id', subId).update({
        next_billing_date: nextBilling,
      });

      // Tạo công nợ
      await trx('receivables').insert({
        customer_id: sub.customer_id,
        invoice_id: invoice.id,
        original_amount: total,
        remaining_amount: total,
        due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        status: 'outstanding',
      });

      invoices.push({
        invoice_id: invoice.id,
        invoice_number: invoiceNum,
        customer_name: sub.customer_name,
        plan_name: sub.plan_name,
        total,
      });
    }

    await trx.commit();
    res.json({
      message: `Đã lập ${invoices.length} hóa đơn thành công`,
      invoices,
    });
  } catch (error) {
    await trx.rollback();
    console.error('Batch billing error:', error);
    res.status(500).json({ error: 'Lỗi lập hóa đơn hàng loạt: ' + error.message });
  }
});

// ============================================
// GIA HẠN GÓI CƯỚC
// ============================================
router.post('/:id/renew', authorize('sales', 'edit'), auditLog('renew', 'subscriptions'), async (req, res) => {
  try {
    const { months = 12 } = req.body;
    const sub = await db('subscriptions').where('id', req.params.id).first();
    if (!sub) return res.status(404).json({ error: 'Không tìm thấy subscription' });

    const newEndDate = new Date(sub.end_date);
    newEndDate.setMonth(newEndDate.getMonth() + months);

    await db('subscriptions').where('id', req.params.id).update({
      end_date: newEndDate,
      status: 'active',
      updated_at: new Date(),
    });

    res.json({ message: `Gia hạn ${months} tháng thành công`, new_end_date: newEndDate });
  } catch (error) {
    console.error('Renew subscription error:', error);
    res.status(500).json({ error: 'Lỗi gia hạn gói cước' });
  }
});

module.exports = router;
