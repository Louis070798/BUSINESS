const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ============================================
// DANH SÁCH HÓA ĐƠN
// ============================================
router.get('/', authorize('invoices', 'view'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, invoice_type, status, payment_status,
      customer_id, date_from, date_to } = req.query;
    const offset = (page - 1) * limit;

    let query = db('invoices')
      .leftJoin('customers', 'invoices.customer_id', 'customers.id')
      .leftJoin('users', 'invoices.created_by', 'users.id')
      .select('invoices.*',
        'customers.customer_name', 'customers.company_name',
        'users.full_name as created_by_name');

    if (search) {
      query = query.where(function () {
        this.where('invoices.invoice_number', 'ilike', `%${search}%`)
          .orWhere('customers.customer_name', 'ilike', `%${search}%`);
      });
    }
    if (invoice_type) query = query.where('invoices.invoice_type', invoice_type);
    if (status) query = query.where('invoices.status', status);
    if (payment_status) query = query.where('invoices.payment_status', payment_status);
    if (customer_id) query = query.where('invoices.customer_id', customer_id);
    if (date_from) query = query.where('invoices.invoice_date', '>=', date_from);
    if (date_to) query = query.where('invoices.invoice_date', '<=', date_to);

    const total = await query.clone().clearSelect().count('* as count').first();
    const data = await query.orderBy('invoices.created_at', 'desc').limit(limit).offset(offset);

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
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách hóa đơn' });
  }
});

// ============================================
// CHI TIẾT HÓA ĐƠN
// ============================================
router.get('/:id', authorize('invoices', 'view'), async (req, res) => {
  try {
    const invoice = await db('invoices')
      .leftJoin('customers', 'invoices.customer_id', 'customers.id')
      .where('invoices.id', req.params.id)
      .select('invoices.*',
        'customers.customer_name', 'customers.company_name',
        'customers.address as customer_address', 'customers.phone as customer_phone',
        'customers.tax_code', 'customers.email as customer_email')
      .first();

    if (!invoice) return res.status(404).json({ error: 'Không tìm thấy hóa đơn' });

    const items = await db('invoice_items')
      .leftJoin('products', 'invoice_items.product_id', 'products.id')
      .leftJoin('service_plans', 'invoice_items.service_plan_id', 'service_plans.id')
      .where('invoice_items.invoice_id', req.params.id)
      .select('invoice_items.*',
        'products.name as product_name', 'products.code as product_code',
        'service_plans.name as plan_name');

    const payments = await db('payments')
      .where('invoice_id', req.params.id)
      .orderBy('payment_date', 'desc');

    res.json({ data: invoice, items, payments });
  } catch (error) {
    console.error('Get invoice detail error:', error);
    res.status(500).json({ error: 'Lỗi lấy chi tiết hóa đơn' });
  }
});

// ============================================
// TẠO HÓA ĐƠN TỪ ĐƠN HÀNG
// ============================================
router.post('/from-order/:orderId', authorize('invoices', 'create'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const order = await trx('sales_orders').where('id', req.params.orderId).first();
    if (!order) {
      await trx.rollback();
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    // Tạo số hóa đơn
    const lastInvoice = await trx('invoices').orderBy('id', 'desc').first();
    const invNum = lastInvoice ? parseInt(lastInvoice.invoice_number.replace('HD', '')) + 1 : 1;
    const invoice_number = `HD${String(invNum).padStart(6, '0')}`;

    const { invoice_type = 'sales' } = req.body;

    const [invoice] = await trx('invoices').insert({
      invoice_number,
      invoice_type,
      customer_id: order.customer_id,
      sales_order_id: order.id,
      invoice_date: new Date(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subtotal: order.subtotal,
      discount_amount: order.discount_amount,
      tax_amount: order.tax_amount,
      grand_total: order.grand_total,
      status: 'issued',
      payment_status: order.payment_status,
      paid_amount: order.paid_amount,
      created_by: req.user.id,
    }).returning('*');

    // Copy items
    const orderItems = await trx('sales_order_items').where('sales_order_id', order.id);
    for (const item of orderItems) {
      await trx('invoice_items').insert({
        invoice_id: invoice.id,
        item_type: item.item_type,
        product_id: item.product_id,
        service_plan_id: item.service_plan_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent,
        discount_amount: item.discount_amount,
        tax_percent: item.tax_percent,
        tax_amount: item.tax_amount,
        total_amount: item.total_amount,
      });
    }

    await trx.commit();
    res.status(201).json({
      id: invoice.id,
      invoice_number,
      message: 'Tạo hóa đơn thành công',
    });
  } catch (error) {
    await trx.rollback();
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Lỗi tạo hóa đơn: ' + error.message });
  }
});

// ============================================
// CẬP NHẬT HÓA ĐƠN
// ============================================
router.put('/:id', authorize('invoices', 'create'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const invoice = await trx('invoices').where('id', req.params.id).first();
    if (!invoice) {
      await trx.rollback();
      return res.status(404).json({ error: 'Không tìm thấy hóa đơn' });
    }

    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      await trx.rollback();
      return res.status(400).json({ error: 'Không thể sửa hóa đơn đã thanh toán hoặc đã hủy' });
    }

    const { customer_id, invoice_type, invoice_date, due_date, status, notes, terms, items } = req.body;

    // Cập nhật thông tin hóa đơn
    const updateData = { updated_at: new Date() };
    if (customer_id) updateData.customer_id = customer_id;
    if (invoice_type) updateData.invoice_type = invoice_type;
    if (invoice_date) updateData.invoice_date = invoice_date;
    if (due_date) updateData.due_date = due_date;
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (terms !== undefined) updateData.terms = terms;

    // Nếu có cập nhật items
    if (items && items.length > 0) {
      // Xóa items cũ
      await trx('invoice_items').where('invoice_id', req.params.id).del();

      let subtotal = 0;
      for (const item of items) {
        const lineTotal = (item.unit_price || 0) * (item.quantity || 0);
        const discountAmt = item.discount_amount || 0; // Use provided discount amount
        const afterDiscount = lineTotal - discountAmt;
        subtotal += afterDiscount;

        await trx('invoice_items').insert({
          invoice_id: req.params.id,
          item_type: item.item_type || 'product',
          product_id: item.product_id || null,
          service_plan_id: item.service_plan_id || null,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: 0, // No percent calculation
          discount_amount: discountAmt,
          tax_percent: 0, // No percent at line level
          tax_amount: 0,
          total_amount: afterDiscount,
        });
      }

      const taxAmount = subtotal * 0.1;
      updateData.subtotal = subtotal;
      updateData.tax_amount = taxAmount;
      updateData.grand_total = subtotal + taxAmount;
    }

    await trx('invoices').where('id', req.params.id).update(updateData);

    await trx.commit();

    // Trả về hóa đơn đã cập nhật
    const updated = await db('invoices')
      .leftJoin('customers', 'invoices.customer_id', 'customers.id')
      .where('invoices.id', req.params.id)
      .select('invoices.*', 'customers.customer_name')
      .first();

    res.json({ data: updated, message: 'Cập nhật hóa đơn thành công' });
  } catch (error) {
    await trx.rollback();
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật hóa đơn: ' + error.message });
  }
});

// ============================================
// TẠO BÁO GIÁ
// ============================================
router.post('/quotation', authorize('invoices', 'create'), async (req, res) => {
  try {
    const { customer_id, items, notes, terms } = req.body;

    const lastInvoice = await db('invoices').where('invoice_type', 'quotation').orderBy('id', 'desc').first();
    const invNum = lastInvoice ? parseInt(lastInvoice.invoice_number.replace('BG', '')) + 1 : 1;
    const invoice_number = `BG${String(invNum).padStart(6, '0')}`;

    let subtotal = 0;

    const [invoice] = await db('invoices').insert({
      invoice_number,
      invoice_type: 'quotation',
      customer_id,
      invoice_date: new Date(),
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày hiệu lực
      status: 'draft',
      payment_status: 'unpaid',
      notes,
      terms: terms || 'Báo giá có hiệu lực trong 7 ngày.',
      created_by: req.user.id,
    }).returning('*');

    for (const item of items) {
      const lineTotal = item.unit_price * item.quantity;
      const taxAmt = lineTotal * (item.tax_percent || 10) / 100;
      subtotal += lineTotal;

      await db('invoice_items').insert({
        invoice_id: invoice.id,
        item_type: item.item_type || 'product',
        product_id: item.product_id,
        service_plan_id: item.service_plan_id,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_percent: item.tax_percent || 10,
        tax_amount: taxAmt,
        total_amount: lineTotal + taxAmt,
      });
    }

    const taxAmount = subtotal * 0.1;
    await db('invoices').where('id', invoice.id).update({
      subtotal,
      tax_amount: taxAmount,
      grand_total: subtotal + taxAmount,
    });

    res.status(201).json({
      id: invoice.id,
      invoice_number,
      message: 'Tạo báo giá thành công',
    });
  } catch (error) {
    console.error('Create quotation error:', error);
    res.status(500).json({ error: 'Lỗi tạo báo giá: ' + error.message });
  }
});

module.exports = router;
