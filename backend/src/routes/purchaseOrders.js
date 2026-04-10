const express = require('express');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();
router.use(authenticate);

// ============================================
// DANH SÁCH ĐƠN NHẬP HÀNG
// ============================================
router.get('/', authorize('purchases', 'view'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, supplier_id, status, date_from, date_to } = req.query;
    const offset = (page - 1) * limit;

    let query = db('purchase_orders')
      .leftJoin('suppliers', 'purchase_orders.supplier_id', 'suppliers.id')
      .leftJoin('users', 'purchase_orders.created_by', 'users.id')
      .select('purchase_orders.*', 'suppliers.name as supplier_name', 'users.full_name as created_by_name');

    if (search) {
      query = query.where(function () {
        this.where('purchase_orders.order_number', 'ilike', `%${search}%`)
          .orWhere('suppliers.name', 'ilike', `%${search}%`);
      });
    }
    if (supplier_id) query = query.where('purchase_orders.supplier_id', supplier_id);
    if (status) query = query.where('purchase_orders.status', status);
    if (date_from) query = query.where('purchase_orders.order_date', '>=', date_from);
    if (date_to) query = query.where('purchase_orders.order_date', '<=', date_to);

    const total = await query.clone().clearSelect().count('* as count').first();
    const data = await query.orderBy('purchase_orders.created_at', 'desc').limit(limit).offset(offset);

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
    console.error('Get purchase orders error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách đơn nhập' });
  }
});

// ============================================
// CHI TIẾT ĐƠN NHẬP
// ============================================
router.get('/:id', authorize('purchases', 'view'), async (req, res) => {
  try {
    const order = await db('purchase_orders')
      .leftJoin('suppliers', 'purchase_orders.supplier_id', 'suppliers.id')
      .where('purchase_orders.id', req.params.id)
      .select('purchase_orders.*', 'suppliers.name as supplier_name',
        'suppliers.phone as supplier_phone', 'suppliers.address as supplier_address')
      .first();

    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn nhập' });

    const items = await db('purchase_order_items')
      .leftJoin('products', 'purchase_order_items.product_id', 'products.id')
      .where('purchase_order_items.purchase_order_id', req.params.id)
      .select('purchase_order_items.*', 'products.name as product_name', 'products.code as product_code');

    res.json({ data: order, items });
  } catch (error) {
    console.error('Get purchase order detail error:', error);
    res.status(500).json({ error: 'Lỗi lấy chi tiết đơn nhập' });
  }
});

// ============================================
// TẠO ĐƠN NHẬP HÀNG
// ============================================
router.post('/', authorize('purchases', 'create'), [
  body('supplier_id').isInt().withMessage('Nhà cung cấp không hợp lệ'),
  body('items').isArray({ min: 1 }).withMessage('Phải có ít nhất 1 sản phẩm'),
  validate,
], auditLog('create', 'purchase_orders'), async (req, res) => {
  const trx = await db.transaction();

  try {
    const { supplier_id, items, notes } = req.body;

    // Tạo mã đơn nhập
    const lastOrder = await trx('purchase_orders').orderBy('id', 'desc').first();
    const orderNum = lastOrder ? parseInt(lastOrder.order_number.replace('NK', '')) + 1 : 1;
    const order_number = `NK${String(orderNum).padStart(6, '0')}`;

    let totalAmount = 0;
    let taxTotal = 0;

    // Tạo đơn nhập
    const [order] = await trx('purchase_orders').insert({
      order_number,
      supplier_id,
      order_date: new Date(),
      status: 'received',
      payment_status: 'unpaid',
      notes,
      created_by: req.user.id,
    }).returning('*');

    for (const item of items) {
      const lineTotal = item.unit_price * item.quantity;
      const discountAmt = lineTotal * (item.discount_percent || 0) / 100;
      const afterDiscount = lineTotal - discountAmt;
      const taxAmt = afterDiscount * (item.tax_percent || 10) / 100;
      const itemTotal = afterDiscount + taxAmt;

      totalAmount += afterDiscount;
      taxTotal += taxAmt;

      await trx('purchase_order_items').insert({
        purchase_order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent || 0,
        discount_amount: discountAmt,
        tax_percent: item.tax_percent || 10,
        tax_amount: taxAmt,
        total_amount: itemTotal,
        serial_numbers: item.serial_numbers,
        notes: item.notes,
      });

      // Cập nhật tồn kho và giá nhập
      const product = await trx('products').where('id', item.product_id).first();
      await trx('products').where('id', item.product_id).update({
        stock_quantity: product.stock_quantity + item.quantity,
        cost_price: item.unit_price, // Cập nhật giá nhập mới nhất
      });

      // Ghi log kho
      await trx('inventory_transactions').insert({
        product_id: item.product_id,
        transaction_type: 'import',
        reference_type: 'purchase_order',
        reference_id: order.id,
        quantity: item.quantity,
        stock_before: product.stock_quantity,
        stock_after: product.stock_quantity + item.quantity,
        unit_price: item.unit_price,
        serial_numbers: item.serial_numbers,
        notes: `Nhập kho từ đơn ${order_number}`,
        created_by: req.user.id,
      });
    }

    const grandTotal = totalAmount + taxTotal;

    // Cập nhật tổng tiền đơn nhập
    await trx('purchase_orders').where('id', order.id).update({
      total_amount: totalAmount,
      tax_amount: taxTotal,
      grand_total: grandTotal,
    });

    // Tạo công nợ phải trả
    await trx('payables').insert({
      supplier_id,
      purchase_order_id: order.id,
      original_amount: grandTotal,
      remaining_amount: grandTotal,
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'outstanding',
    });

    await trx.commit();

    res.status(201).json({
      id: order.id,
      order_number,
      grand_total: grandTotal,
      message: 'Tạo đơn nhập hàng thành công',
    });
  } catch (error) {
    await trx.rollback();
    console.error('Create purchase order error:', error);
    res.status(500).json({ error: 'Lỗi tạo đơn nhập hàng: ' + error.message });
  }
});

module.exports = router;
