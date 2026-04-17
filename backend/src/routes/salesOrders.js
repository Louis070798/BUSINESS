const express = require('express');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();
router.use(authenticate);

// ============================================
// DANH SÁCH ĐƠN BÁN HÀNG
// ============================================
router.get('/', authorize('sales', 'view'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, customer_id, status, payment_status,
      date_from, date_to, customer_group } = req.query;
    const offset = (page - 1) * limit;

    let query = db('sales_orders')
      .leftJoin('customers', 'sales_orders.customer_id', 'customers.id')
      .leftJoin('customer_groups', 'customers.group_id', 'customer_groups.id')
      .leftJoin('users', 'sales_orders.created_by', 'users.id')
      .select('sales_orders.*',
        'customers.customer_name', 'customers.company_name', 'customers.phone as customer_phone',
        'customer_groups.name as group_name', 'customer_groups.code as group_code',
        'users.full_name as created_by_name');

    if (search) {
      query = query.where(function () {
        this.where('sales_orders.order_number', 'ilike', `%${search}%`)
          .orWhere('customers.customer_name', 'ilike', `%${search}%`)
          .orWhere('customers.company_name', 'ilike', `%${search}%`);
      });
    }
    if (customer_id) query = query.where('sales_orders.customer_id', customer_id);
    if (status) query = query.where('sales_orders.status', status);
    if (payment_status) query = query.where('sales_orders.payment_status', payment_status);
    if (date_from) query = query.where('sales_orders.order_date', '>=', date_from);
    if (date_to) query = query.where('sales_orders.order_date', '<=', date_to);
    if (customer_group) query = query.where('customer_groups.code', customer_group);

    const total = await query.clone().clearSelect().count('* as count').first();
    const data = await query.orderBy('sales_orders.created_at', 'desc').limit(limit).offset(offset);

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
    console.error('Get sales orders error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách đơn hàng' });
  }
});

// ============================================
// CHI TIẾT ĐƠN BÁN HÀNG
// ============================================
router.get('/:id', authorize('sales', 'view'), async (req, res) => {
  try {
    const order = await db('sales_orders')
      .leftJoin('customers', 'sales_orders.customer_id', 'customers.id')
      .leftJoin('customer_groups', 'customers.group_id', 'customer_groups.id')
      .where('sales_orders.id', req.params.id)
      .select('sales_orders.*',
        'customers.customer_name', 'customers.company_name', 'customers.phone as customer_phone',
        'customers.address as customer_address', 'customers.tax_code',
        'customer_groups.name as group_name', 'customer_groups.code as group_code')
      .first();

    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    const items = await db('sales_order_items')
      .leftJoin('products', 'sales_order_items.product_id', 'products.id')
      .leftJoin('service_plans', 'sales_order_items.service_plan_id', 'service_plans.id')
      .where('sales_order_items.sales_order_id', req.params.id)
      .select('sales_order_items.*',
        'products.name as product_name', 'products.code as product_code', 'products.unit',
        'service_plans.name as plan_name', 'service_plans.code as plan_code');

    // Lịch sử thanh toán
    const payments = await db('payments')
      .where('sales_order_id', req.params.id)
      .orderBy('payment_date', 'desc');

    res.json({ data: order, items, payments });
  } catch (error) {
    console.error('Get sales order detail error:', error);
    res.status(500).json({ error: 'Lỗi lấy chi tiết đơn hàng' });
  }
});

// ============================================
// TẠO ĐƠN BÁN HÀNG
// ============================================
router.post('/', authorize('sales', 'create'), [
  body('customer_id').isInt().withMessage('Khách hàng không hợp lệ'),
  body('items').isArray({ min: 1 }).withMessage('Đơn hàng phải có ít nhất 1 sản phẩm'),
  validate,
], auditLog('create', 'sales_orders'), async (req, res) => {
  const trx = await db.transaction();

  try {
    const { customer_id, items, discount_percent = 0, payment_method, notes, delivery_address } = req.body;

    // Lấy thông tin khách hàng
    const customer = await trx('customers')
      .leftJoin('customer_groups', 'customers.group_id', 'customer_groups.id')
      .where('customers.id', customer_id)
      .select('customers.*', 'customer_groups.code as group_code')
      .first();

    if (!customer) {
      await trx.rollback();
      return res.status(400).json({ error: 'Khách hàng không tồn tại' });
    }

    // Tự tạo mã đơn hàng
    const lastOrder = await trx('sales_orders').orderBy('id', 'desc').first();
    const orderNum = lastOrder ? parseInt(lastOrder.order_number.replace('DH', '')) + 1 : 1;
    const order_number = `DH${String(orderNum).padStart(6, '0')}`;

    let subtotal = 0;
    let costTotal = 0;
    const orderItems = [];

    for (const item of items) {
      let unitPrice = item.unit_price;
      let costPrice = 0;
      let itemName = '';

      if (item.item_type === 'product' && item.product_id) {
        const product = await trx('products').where('id', item.product_id).first();
        if (!product) {
          await trx.rollback();
          return res.status(400).json({ error: `Thiết bị ID ${item.product_id} không tồn tại` });
        }

        // Kiểm tra tồn kho
        if (product.stock_quantity < item.quantity) {
          await trx.rollback();
          return res.status(400).json({ error: `${product.name} chỉ còn ${product.stock_quantity} trong kho` });
        }

        // Tự động chọn giá theo nhóm khách hàng nếu không truyền giá
        if (!unitPrice) {
          switch (customer.group_code) {
            case 'agent_level1': unitPrice = product.agent_level1_price; break;
            case 'agent_level2': unitPrice = product.agent_level2_price; break;
            default: unitPrice = product.retail_price;
          }
        }

        costPrice = product.cost_price;
        itemName = product.name;

        // Trừ tồn kho
        await trx('products').where('id', item.product_id).decrement('stock_quantity', item.quantity);

        // Ghi log kho
        await trx('inventory_transactions').insert({
          product_id: item.product_id,
          transaction_type: 'export',
          reference_type: 'sales_order',
          quantity: -item.quantity,
          stock_before: product.stock_quantity,
          stock_after: product.stock_quantity - item.quantity,
          unit_price: unitPrice,
          serial_numbers: item.serial_numbers,
          notes: `Xuất kho cho đơn ${order_number}`,
          created_by: req.user.id,
        });

      } else if (item.item_type === 'service_plan' && item.service_plan_id) {
        const plan = await trx('service_plans').where('id', item.service_plan_id).first();
        if (!plan) {
          await trx.rollback();
          return res.status(400).json({ error: `Gói cước ID ${item.service_plan_id} không tồn tại` });
        }

        if (!unitPrice) {
          switch (customer.group_code) {
            case 'agent_level1': unitPrice = plan.agent_level1_price; break;
            case 'agent_level2': unitPrice = plan.agent_level2_price; break;
            default: unitPrice = plan.retail_price;
          }
        }

        costPrice = plan.cost_price;
        itemName = plan.name;
      }

      // discount từ frontend là số tiền cố định, không phải percent
      const lineTotal = unitPrice * item.quantity - (item.discount || 0);
      const profit = lineTotal - (costPrice * item.quantity);

      subtotal += lineTotal;
      costTotal += costPrice * item.quantity;

      orderItems.push({
        item_type: item.item_type || 'product',
        product_id: item.product_id || null,
        service_plan_id: item.service_plan_id || null,
        quantity: item.quantity,
        unit_price: unitPrice,
        cost_price: costPrice,
        discount_percent: 0,
        discount_amount: item.discount || 0,
        tax_percent: 0, // Không tính tax ở từng line, chỉ tính ở cấp đơn
        tax_amount: 0,
        total_amount: lineTotal,
        profit: profit,
        serial_numbers: item.serial_numbers,
        notes: item.notes,
      });
    }

    // Tính tax ở cấp đơn (VAT 10%)
    const taxAmount = subtotal * 0.1;
    const grandTotal = subtotal + taxAmount;
    const profit = subtotal - costTotal;

    // Tạo đơn hàng
    const [order] = await trx('sales_orders').insert({
      order_number,
      customer_id,
      customer_group_code: customer.group_code,
      order_date: new Date(),
      subtotal,
      discount_percent,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      grand_total: grandTotal,
      cost_total: costTotal,
      profit,
      status: 'confirmed',
      payment_status: payment_method === 'debt' ? 'unpaid' : 'paid',
      paid_amount: payment_method === 'debt' ? 0 : grandTotal,
      payment_method: payment_method || 'cash',
      notes,
      delivery_address,
      created_by: req.user.id,
    }).returning('*');

    // Tạo chi tiết đơn hàng
    for (const item of orderItems) {
      await trx('sales_order_items').insert({
        sales_order_id: order.id,
        ...item,
      });
    }

    // Nếu công nợ, tạo receivable
    if (payment_method === 'debt') {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (customer.payment_term_days || 30));

      await trx('receivables').insert({
        customer_id,
        sales_order_id: order.id,
        original_amount: grandTotal,
        remaining_amount: grandTotal,
        due_date: dueDate,
        status: 'outstanding',
      });

      // Cập nhật công nợ khách hàng
      await trx('customers').where('id', customer_id)
        .increment('current_debt', grandTotal);
    } else {
      // Ghi nhận thanh toán
      const paymentNum = `PT${String(order.id).padStart(6, '0')}`;
      await trx('payments').insert({
        payment_number: paymentNum,
        payment_type: 'receivable',
        customer_id,
        sales_order_id: order.id,
        payment_date: new Date(),
        amount: grandTotal,
        payment_method: payment_method || 'cash',
        status: 'completed',
        created_by: req.user.id,
      });
    }

    // Tạo subscriptions nếu có gói cước
    for (const item of items) {
      if (item.item_type === 'service_plan' && item.service_plan_id) {
        const plan = await trx('service_plans').where('id', item.service_plan_id).first();
        const subNum = `SUB${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + (plan.duration_months || 12));
        const nextBilling = new Date();
        nextBilling.setMonth(nextBilling.getMonth() + 1);

        const priceForCustomer = orderItems.find(
          oi => oi.service_plan_id === item.service_plan_id
        )?.unit_price || plan.retail_price;

        await trx('subscriptions').insert({
          subscription_number: subNum,
          customer_id,
          service_plan_id: item.service_plan_id,
          product_id: item.linked_product_id || null,
          device_serial: item.device_serial || null,
          start_date: startDate,
          end_date: endDate,
          next_billing_date: nextBilling,
          monthly_amount: priceForCustomer,
          billing_cycle: plan.billing_cycle,
          status: 'active',
          auto_renew: true,
          sales_order_id: order.id,
          created_by: req.user.id,
        });
      }
    }

    await trx.commit();

    res.status(201).json({
      id: order.id,
      order_number,
      grand_total: grandTotal,
      profit,
      message: 'Tạo đơn hàng thành công',
    });
  } catch (error) {
    await trx.rollback();
    console.error('Create sales order error:', error);
    res.status(500).json({ error: 'Lỗi tạo đơn hàng: ' + error.message });
  }
});

// ============================================
// CẬP NHẬT ĐƠN BÁN HÀNG
// ============================================
router.put('/:id', authorize('sales', 'edit'), async (req, res) => {
  try {
    const order = await db('sales_orders').where('id', req.params.id).first();
    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Không thể sửa đơn hàng đã hủy' });
    }

    const { notes, delivery_address, payment_method, payment_status, status } = req.body;

    const updateData = { updated_at: new Date() };
    if (notes !== undefined) updateData.notes = notes;
    if (delivery_address !== undefined) updateData.delivery_address = delivery_address;
    if (payment_method) updateData.payment_method = payment_method;
    if (payment_status) updateData.payment_status = payment_status;
    if (status) updateData.status = status;

    await db('sales_orders').where('id', req.params.id).update(updateData);

    const updated = await db('sales_orders')
      .leftJoin('customers', 'sales_orders.customer_id', 'customers.id')
      .leftJoin('customer_groups', 'customers.group_id', 'customer_groups.id')
      .where('sales_orders.id', req.params.id)
      .select('sales_orders.*',
        'customers.customer_name', 'customer_groups.name as group_name')
      .first();

    res.json({ data: updated, message: 'Cập nhật đơn hàng thành công' });
  } catch (error) {
    console.error('Update sales order error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật đơn hàng: ' + error.message });
  }
});

// ============================================
// CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG
// ============================================
router.put('/:id/status', authorize('sales', 'edit'), auditLog('update', 'sales_orders'), async (req, res) => {
  try {
    const { status } = req.body;
    await db('sales_orders').where('id', req.params.id).update({
      status,
      updated_at: new Date(),
    });
    res.json({ message: 'Cập nhật trạng thái thành công' });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật trạng thái' });
  }
});

// ============================================
// HỦY ĐƠN HÀNG
// ============================================
router.post('/:id/cancel', authorize('sales', 'edit'), auditLog('cancel', 'sales_orders'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const order = await trx('sales_orders').where('id', req.params.id).first();
    if (!order) {
      await trx.rollback();
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    if (order.status === 'cancelled') {
      await trx.rollback();
      return res.status(400).json({ error: 'Đơn hàng đã được hủy trước đó' });
    }

    // Hoàn kho cho thiết bị
    const items = await trx('sales_order_items')
      .where('sales_order_id', req.params.id)
      .where('item_type', 'product');

    for (const item of items) {
      if (item.product_id) {
        await trx('products').where('id', item.product_id).increment('stock_quantity', item.quantity);

        const product = await trx('products').where('id', item.product_id).first();
        await trx('inventory_transactions').insert({
          product_id: item.product_id,
          transaction_type: 'return',
          reference_type: 'sales_order',
          reference_id: order.id,
          quantity: item.quantity,
          stock_before: product.stock_quantity - item.quantity,
          stock_after: product.stock_quantity,
          notes: `Hoàn kho do hủy đơn ${order.order_number}`,
          created_by: req.user.id,
        });
      }
    }

    // Hủy subscriptions
    await trx('subscriptions')
      .where('sales_order_id', req.params.id)
      .update({ status: 'cancelled' });

    // Xử lý công nợ
    if (order.payment_status === 'unpaid') {
      await trx('receivables')
        .where('sales_order_id', req.params.id)
        .update({ status: 'paid', remaining_amount: 0, notes: 'Hủy do đơn hàng bị hủy' });

      await trx('customers')
        .where('id', order.customer_id)
        .decrement('current_debt', order.grand_total);
    }

    await trx('sales_orders').where('id', req.params.id).update({
      status: 'cancelled',
      updated_at: new Date(),
    });

    await trx.commit();
    res.json({ message: 'Hủy đơn hàng thành công' });
  } catch (error) {
    await trx.rollback();
    console.error('Cancel order error:', error);
    res.status(500).json({ error: 'Lỗi hủy đơn hàng' });
  }
});

module.exports = router;
