const express = require('express');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();
router.use(authenticate);

// ============================================
// DANH SÁCH THANH TOÁN
// ============================================
router.get('/', authorize('payments', 'view'), async (req, res) => {
  try {
    const { page = 1, limit = 20, payment_type, customer_id, supplier_id, date_from, date_to } = req.query;
    const offset = (page - 1) * limit;

    let query = db('payments')
      .leftJoin('customers', 'payments.customer_id', 'customers.id')
      .leftJoin('suppliers', 'payments.supplier_id', 'suppliers.id')
      .leftJoin('users', 'payments.created_by', 'users.id')
      .select('payments.*',
        'customers.customer_name', 'suppliers.name as supplier_name',
        'users.full_name as created_by_name');

    if (payment_type) query = query.where('payments.payment_type', payment_type);
    if (customer_id) query = query.where('payments.customer_id', customer_id);
    if (supplier_id) query = query.where('payments.supplier_id', supplier_id);
    if (date_from) query = query.where('payments.payment_date', '>=', date_from);
    if (date_to) query = query.where('payments.payment_date', '<=', date_to);

    const total = await query.clone().clearSelect().count('* as count').first();
    const data = await query.orderBy('payments.created_at', 'desc').limit(limit).offset(offset);

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
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách thanh toán' });
  }
});

// ============================================
// GHI NHẬN THANH TOÁN - PHẢI THU
// ============================================
router.post('/receive', authorize('payments', 'create'), [
  body('customer_id').isInt().withMessage('Khách hàng không hợp lệ'),
  body('amount').isFloat({ min: 1 }).withMessage('Số tiền phải > 0'),
  body('payment_method').notEmpty().withMessage('Phương thức thanh toán không được để trống'),
  validate,
], auditLog('create', 'payments'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const { customer_id, amount, payment_method, invoice_id, sales_order_id,
      reference_number, bank_name, bank_account, notes } = req.body;

    // Tạo mã phiếu thu
    const lastPayment = await trx('payments').where('payment_type', 'receivable').orderBy('id', 'desc').first();
    const payNum = lastPayment ? parseInt(lastPayment.payment_number.replace('PT', '')) + 1 : 1;
    const payment_number = `PT${String(payNum).padStart(6, '0')}`;

    const [payment] = await trx('payments').insert({
      payment_number,
      payment_type: 'receivable',
      customer_id,
      invoice_id,
      sales_order_id,
      payment_date: new Date(),
      amount,
      payment_method,
      reference_number,
      bank_name,
      bank_account,
      status: 'completed',
      notes,
      created_by: req.user.id,
    }).returning('*');

    // Cập nhật công nợ
    let remainingAmount = amount;

    // Nếu chỉ định invoice cụ thể
    if (invoice_id) {
      const invoice = await trx('invoices').where('id', invoice_id).first();
      if (invoice) {
        const newPaid = parseFloat(invoice.paid_amount) + amount;
        const paidStatus = newPaid >= parseFloat(invoice.grand_total) ? 'paid' : 'partial';
        await trx('invoices').where('id', invoice_id).update({
          paid_amount: Math.min(newPaid, parseFloat(invoice.grand_total)),
          payment_status: paidStatus,
          status: paidStatus === 'paid' ? 'paid' : invoice.status,
        });
      }

      // Cập nhật receivable
      const receivable = await trx('receivables').where('invoice_id', invoice_id).first();
      if (receivable) {
        const newRemaining = Math.max(0, parseFloat(receivable.remaining_amount) - amount);
        await trx('receivables').where('id', receivable.id).update({
          paid_amount: parseFloat(receivable.paid_amount) + amount,
          remaining_amount: newRemaining,
          status: newRemaining <= 0 ? 'paid' : 'partial',
        });
      }
    } else {
      // Phân bổ thanh toán cho các công nợ cũ nhất
      const receivables = await trx('receivables')
        .where('customer_id', customer_id)
        .whereIn('status', ['outstanding', 'partial', 'overdue'])
        .orderBy('due_date', 'asc');

      for (const rec of receivables) {
        if (remainingAmount <= 0) break;

        const payForThis = Math.min(remainingAmount, parseFloat(rec.remaining_amount));
        const newRemaining = parseFloat(rec.remaining_amount) - payForThis;

        await trx('receivables').where('id', rec.id).update({
          paid_amount: parseFloat(rec.paid_amount) + payForThis,
          remaining_amount: newRemaining,
          status: newRemaining <= 0 ? 'paid' : 'partial',
        });

        // Cập nhật invoice liên quan
        if (rec.invoice_id) {
          const inv = await trx('invoices').where('id', rec.invoice_id).first();
          if (inv) {
            const newPaid = parseFloat(inv.paid_amount) + payForThis;
            await trx('invoices').where('id', rec.invoice_id).update({
              paid_amount: Math.min(newPaid, parseFloat(inv.grand_total)),
              payment_status: newPaid >= parseFloat(inv.grand_total) ? 'paid' : 'partial',
            });
          }
        }

        // Cập nhật sales order liên quan
        if (rec.sales_order_id) {
          const so = await trx('sales_orders').where('id', rec.sales_order_id).first();
          if (so) {
            const newPaid = parseFloat(so.paid_amount) + payForThis;
            await trx('sales_orders').where('id', rec.sales_order_id).update({
              paid_amount: Math.min(newPaid, parseFloat(so.grand_total)),
              payment_status: newPaid >= parseFloat(so.grand_total) ? 'paid' : 'partial',
            });
          }
        }

        remainingAmount -= payForThis;
      }
    }

    // Giảm công nợ khách hàng
    await trx('customers').where('id', customer_id)
      .decrement('current_debt', amount);

    await trx.commit();
    res.status(201).json({
      id: payment.id,
      payment_number,
      message: 'Ghi nhận thanh toán thành công',
    });
  } catch (error) {
    await trx.rollback();
    console.error('Receive payment error:', error);
    res.status(500).json({ error: 'Lỗi ghi nhận thanh toán: ' + error.message });
  }
});

// ============================================
// GHI NHẬN THANH TOÁN - PHẢI TRẢ (cho NCC)
// ============================================
router.post('/pay', authorize('payments', 'create'), [
  body('supplier_id').isInt().withMessage('Nhà cung cấp không hợp lệ'),
  body('amount').isFloat({ min: 1 }).withMessage('Số tiền phải > 0'),
  body('payment_method').notEmpty().withMessage('Phương thức thanh toán không được để trống'),
  validate,
], auditLog('create', 'payments'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const { supplier_id, amount, payment_method, purchase_order_id,
      reference_number, bank_name, bank_account, notes } = req.body;

    const lastPayment = await trx('payments').where('payment_type', 'payable').orderBy('id', 'desc').first();
    const payNum = lastPayment ? parseInt(lastPayment.payment_number.replace('PC', '')) + 1 : 1;
    const payment_number = `PC${String(payNum).padStart(6, '0')}`;

    const [payment] = await trx('payments').insert({
      payment_number,
      payment_type: 'payable',
      supplier_id,
      purchase_order_id,
      payment_date: new Date(),
      amount,
      payment_method,
      reference_number,
      bank_name,
      bank_account,
      status: 'completed',
      notes,
      created_by: req.user.id,
    }).returning('*');

    // Phân bổ cho các công nợ phải trả
    let remainingAmount = amount;
    const payables = await trx('payables')
      .where('supplier_id', supplier_id)
      .whereIn('status', ['outstanding', 'partial', 'overdue'])
      .orderBy('due_date', 'asc');

    for (const pay of payables) {
      if (remainingAmount <= 0) break;

      const payForThis = Math.min(remainingAmount, parseFloat(pay.remaining_amount));
      const newRemaining = parseFloat(pay.remaining_amount) - payForThis;

      await trx('payables').where('id', pay.id).update({
        paid_amount: parseFloat(pay.paid_amount) + payForThis,
        remaining_amount: newRemaining,
        status: newRemaining <= 0 ? 'paid' : 'partial',
      });

      if (pay.purchase_order_id) {
        const po = await trx('purchase_orders').where('id', pay.purchase_order_id).first();
        if (po) {
          const newPaid = parseFloat(po.paid_amount) + payForThis;
          await trx('purchase_orders').where('id', pay.purchase_order_id).update({
            paid_amount: Math.min(newPaid, parseFloat(po.grand_total)),
            payment_status: newPaid >= parseFloat(po.grand_total) ? 'paid' : 'partial',
          });
        }
      }

      remainingAmount -= payForThis;
    }

    // Giảm công nợ nhà cung cấp
    await trx('suppliers').where('id', supplier_id).decrement('current_debt', amount);

    await trx.commit();
    res.status(201).json({
      id: payment.id,
      payment_number,
      message: 'Ghi nhận thanh toán NCC thành công',
    });
  } catch (error) {
    await trx.rollback();
    console.error('Pay supplier error:', error);
    res.status(500).json({ error: 'Lỗi thanh toán NCC: ' + error.message });
  }
});

// ============================================
// CÔNG NỢ PHẢI THU
// ============================================
router.get('/receivables', authorize('payments', 'view'), async (req, res) => {
  try {
    const { customer_id, status } = req.query;

    let query = db('receivables')
      .leftJoin('customers', 'receivables.customer_id', 'customers.id')
      .leftJoin('invoices', 'receivables.invoice_id', 'invoices.id')
      .leftJoin('sales_orders', 'receivables.sales_order_id', 'sales_orders.id')
      .select('receivables.*',
        'customers.customer_name', 'customers.company_name',
        'invoices.invoice_number',
        'sales_orders.order_number');

    if (customer_id) query = query.where('receivables.customer_id', customer_id);
    if (status) query = query.where('receivables.status', status);
    else query = query.whereIn('receivables.status', ['outstanding', 'partial', 'overdue']);

    const data = await query.orderBy('receivables.due_date', 'asc');

    // Tổng cộng
    const totals = await db('receivables')
      .whereIn('status', ['outstanding', 'partial', 'overdue'])
      .select(
        db.raw('SUM(remaining_amount) as total_remaining'),
        db.raw('SUM(original_amount) as total_original'),
        db.raw('COUNT(*) as count')
      )
      .first();

    res.json({ data, totals });
  } catch (error) {
    console.error('Get receivables error:', error);
    res.status(500).json({ error: 'Lỗi lấy công nợ phải thu' });
  }
});

// ============================================
// CÔNG NỢ PHẢI TRẢ
// ============================================
router.get('/payables', authorize('payments', 'view'), async (req, res) => {
  try {
    const { supplier_id, status } = req.query;

    let query = db('payables')
      .leftJoin('suppliers', 'payables.supplier_id', 'suppliers.id')
      .leftJoin('purchase_orders', 'payables.purchase_order_id', 'purchase_orders.id')
      .select('payables.*', 'suppliers.name as supplier_name',
        'purchase_orders.order_number');

    if (supplier_id) query = query.where('payables.supplier_id', supplier_id);
    if (status) query = query.where('payables.status', status);
    else query = query.whereIn('payables.status', ['outstanding', 'partial', 'overdue']);

    const data = await query.orderBy('payables.due_date', 'asc');

    const totals = await db('payables')
      .whereIn('status', ['outstanding', 'partial', 'overdue'])
      .select(
        db.raw('SUM(remaining_amount) as total_remaining'),
        db.raw('SUM(original_amount) as total_original'),
        db.raw('COUNT(*) as count')
      )
      .first();

    res.json({ data, totals });
  } catch (error) {
    console.error('Get payables error:', error);
    res.status(500).json({ error: 'Lỗi lấy công nợ phải trả' });
  }
});

// ============================================
// CẢNH BÁO CÔNG NỢ QUÁ HẠN
// ============================================
router.get('/overdue', authorize('payments', 'view'), async (req, res) => {
  try {
    const today = new Date();

    const overdueReceivables = await db('receivables')
      .leftJoin('customers', 'receivables.customer_id', 'customers.id')
      .where('receivables.due_date', '<', today)
      .whereIn('receivables.status', ['outstanding', 'partial'])
      .select('receivables.*', 'customers.customer_name', 'customers.phone')
      .orderBy('receivables.due_date', 'asc');

    const overduePayables = await db('payables')
      .leftJoin('suppliers', 'payables.supplier_id', 'suppliers.id')
      .where('payables.due_date', '<', today)
      .whereIn('payables.status', ['outstanding', 'partial'])
      .select('payables.*', 'suppliers.name as supplier_name')
      .orderBy('payables.due_date', 'asc');

    // Cập nhật trạng thái quá hạn
    await db('receivables')
      .where('due_date', '<', today)
      .whereIn('status', ['outstanding', 'partial'])
      .update({ status: 'overdue' });

    await db('payables')
      .where('due_date', '<', today)
      .whereIn('status', ['outstanding', 'partial'])
      .update({ status: 'overdue' });

    res.json({
      overdueReceivables,
      overduePayables,
      totalOverdueReceivable: overdueReceivables.reduce((s, r) => s + parseFloat(r.remaining_amount), 0),
      totalOverduePayable: overduePayables.reduce((s, p) => s + parseFloat(p.remaining_amount), 0),
    });
  } catch (error) {
    console.error('Get overdue error:', error);
    res.status(500).json({ error: 'Lỗi lấy công nợ quá hạn' });
  }
});

module.exports = router;
