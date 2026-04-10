const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ============================================
// DANH SÁCH THIẾT BỊ STARLINK
// ============================================
router.get('/', authorize('sales', 'view'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, customer_id } = req.query;
    const offset = (page - 1) * limit;

    let query = db('starlink_devices')
      .leftJoin('customers', 'starlink_devices.customer_id', 'customers.id')
      .leftJoin('customer_groups', 'customers.group_id', 'customer_groups.id')
      .leftJoin('service_plans', 'starlink_devices.service_plan_id', 'service_plans.id')
      .leftJoin('products', 'starlink_devices.product_id', 'products.id')
      .select(
        'starlink_devices.*',
        'customers.customer_name', 'customers.phone as customer_phone',
        'customers.address as customer_address',
        'customer_groups.name as group_name',
        'service_plans.name as plan_name', 'service_plans.code as plan_code',
        'products.name as product_name'
      );

    if (search) {
      query = query.where(function () {
        this.where('starlink_devices.kit_number', 'ilike', `%${search}%`)
          .orWhere('starlink_devices.serial_number', 'ilike', `%${search}%`)
          .orWhere('starlink_devices.account_number', 'ilike', `%${search}%`)
          .orWhere('customers.customer_name', 'ilike', `%${search}%`);
      });
    }
    if (status) query = query.where('starlink_devices.status', status);
    if (customer_id) query = query.where('starlink_devices.customer_id', customer_id);

    const total = await query.clone().clearSelect().count('* as count').first();
    const data = await query.orderBy('starlink_devices.created_at', 'desc').limit(limit).offset(offset);

    // Thống kê
    const stats = await db('starlink_devices')
      .select(
        db.raw("COUNT(*) as total"),
        db.raw("COUNT(*) FILTER (WHERE status = 'active') as active"),
        db.raw("COUNT(*) FILTER (WHERE status = 'suspended') as suspended"),
        db.raw("COUNT(*) FILTER (WHERE status = 'inactive') as inactive"),
        db.raw("COALESCE(SUM(monthly_fee) FILTER (WHERE status = 'active'), 0) as total_monthly_fee")
      )
      .first();

    res.json({
      data,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total.count),
        totalPages: Math.ceil(total.count / limit),
      },
    });
  } catch (error) {
    console.error('Get starlink devices error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách thiết bị Starlink' });
  }
});

// ============================================
// CHI TIẾT THIẾT BỊ
// ============================================
router.get('/:id', authorize('sales', 'view'), async (req, res) => {
  try {
    const device = await db('starlink_devices')
      .leftJoin('customers', 'starlink_devices.customer_id', 'customers.id')
      .leftJoin('customer_groups', 'customers.group_id', 'customer_groups.id')
      .leftJoin('service_plans', 'starlink_devices.service_plan_id', 'service_plans.id')
      .leftJoin('products', 'starlink_devices.product_id', 'products.id')
      .where('starlink_devices.id', req.params.id)
      .select(
        'starlink_devices.*',
        'customers.customer_name', 'customers.phone as customer_phone',
        'customers.address as customer_address', 'customers.email as customer_email',
        'customer_groups.name as group_name',
        'service_plans.name as plan_name', 'service_plans.code as plan_code',
        'service_plans.retail_price as plan_price',
        'products.name as product_name', 'products.code as product_code'
      )
      .first();

    if (!device) return res.status(404).json({ error: 'Không tìm thấy thiết bị' });

    // Lịch sử gia hạn
    const billings = await db('starlink_billings')
      .leftJoin('service_plans', 'starlink_billings.service_plan_id', 'service_plans.id')
      .where('starlink_billings.device_id', req.params.id)
      .select('starlink_billings.*', 'service_plans.name as plan_name')
      .orderBy('starlink_billings.billing_period_start', 'desc');

    res.json({ data: device, billings });
  } catch (error) {
    console.error('Get device detail error:', error);
    res.status(500).json({ error: 'Lỗi lấy chi tiết thiết bị' });
  }
});

// ============================================
// THÊM THIẾT BỊ
// ============================================
router.post('/', authorize('sales', 'create'), async (req, res) => {
  try {
    const {
      kit_number, serial_number, account_number, customer_id, service_plan_id,
      product_id, device_model, firmware_version, install_date, install_address,
      lat, lng, monthly_fee, billing_start_date, next_billing_date,
      subscription_end_date, status, notes,
    } = req.body;

    if (!kit_number) {
      return res.status(400).json({ error: 'Mã KIT không được để trống' });
    }

    // Check trùng KIT
    const exists = await db('starlink_devices').where('kit_number', kit_number).first();
    if (exists) {
      return res.status(400).json({ error: `Mã KIT "${kit_number}" đã tồn tại` });
    }

    // Lấy monthly_fee từ gói cước nếu không truyền
    let fee = monthly_fee;
    if (!fee && service_plan_id) {
      const plan = await db('service_plans').where('id', service_plan_id).first();
      if (plan) fee = plan.retail_price;
    }

    const [device] = await db('starlink_devices').insert({
      kit_number,
      serial_number: serial_number || null,
      account_number: account_number || null,
      customer_id: customer_id || null,
      service_plan_id: service_plan_id || null,
      product_id: product_id || null,
      device_model: device_model || 'Starlink Standard',
      firmware_version: firmware_version || null,
      install_date: install_date || null,
      install_address: install_address || null,
      lat: lat || null,
      lng: lng || null,
      monthly_fee: fee || 0,
      billing_start_date: billing_start_date || null,
      next_billing_date: next_billing_date || null,
      subscription_end_date: subscription_end_date || null,
      status: status || 'active',
      notes: notes || null,
      created_by: req.user.id,
    }).returning('*');

    res.status(201).json({ data: device, message: 'Thêm thiết bị Starlink thành công' });
  } catch (error) {
    console.error('Create starlink device error:', error);
    res.status(500).json({ error: 'Lỗi thêm thiết bị: ' + error.message });
  }
});

// ============================================
// CẬP NHẬT THIẾT BỊ
// ============================================
router.put('/:id', authorize('sales', 'edit'), async (req, res) => {
  try {
    const device = await db('starlink_devices').where('id', req.params.id).first();
    if (!device) return res.status(404).json({ error: 'Không tìm thấy thiết bị' });

    const {
      kit_number, serial_number, account_number, customer_id, service_plan_id,
      product_id, device_model, firmware_version, install_date, install_address,
      lat, lng, monthly_fee, billing_start_date, next_billing_date,
      subscription_end_date, status, notes,
    } = req.body;

    // Check trùng KIT nếu thay đổi
    if (kit_number && kit_number !== device.kit_number) {
      const exists = await db('starlink_devices').where('kit_number', kit_number).whereNot('id', req.params.id).first();
      if (exists) return res.status(400).json({ error: `Mã KIT "${kit_number}" đã tồn tại` });
    }

    const updateData = { updated_at: new Date() };
    if (kit_number !== undefined) updateData.kit_number = kit_number;
    if (serial_number !== undefined) updateData.serial_number = serial_number;
    if (account_number !== undefined) updateData.account_number = account_number;
    if (customer_id !== undefined) updateData.customer_id = customer_id || null;
    if (service_plan_id !== undefined) updateData.service_plan_id = service_plan_id || null;
    if (product_id !== undefined) updateData.product_id = product_id || null;
    if (device_model !== undefined) updateData.device_model = device_model;
    if (firmware_version !== undefined) updateData.firmware_version = firmware_version;
    if (install_date !== undefined) updateData.install_date = install_date;
    if (install_address !== undefined) updateData.install_address = install_address;
    if (lat !== undefined) updateData.lat = lat;
    if (lng !== undefined) updateData.lng = lng;
    if (monthly_fee !== undefined) updateData.monthly_fee = monthly_fee;
    if (billing_start_date !== undefined) updateData.billing_start_date = billing_start_date;
    if (next_billing_date !== undefined) updateData.next_billing_date = next_billing_date;
    if (subscription_end_date !== undefined) updateData.subscription_end_date = subscription_end_date;
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    await db('starlink_devices').where('id', req.params.id).update(updateData);

    const updated = await db('starlink_devices')
      .leftJoin('customers', 'starlink_devices.customer_id', 'customers.id')
      .leftJoin('service_plans', 'starlink_devices.service_plan_id', 'service_plans.id')
      .where('starlink_devices.id', req.params.id)
      .select('starlink_devices.*', 'customers.customer_name', 'service_plans.name as plan_name')
      .first();

    res.json({ data: updated, message: 'Cập nhật thiết bị thành công' });
  } catch (error) {
    console.error('Update starlink device error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật thiết bị: ' + error.message });
  }
});

// ============================================
// GIA HẠN GÓI CƯỚC (TẠO 1 BILLING → KẾ TOÁN)
// ============================================
router.post('/:id/renew', authorize('sales', 'create'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const device = await trx('starlink_devices').where('id', req.params.id).first();
    if (!device) {
      await trx.rollback();
      return res.status(404).json({ error: 'Không tìm thấy thiết bị' });
    }
    if (!device.customer_id) {
      await trx.rollback();
      return res.status(400).json({ error: 'Thiết bị chưa gán khách hàng, không thể gia hạn' });
    }
    if (!device.service_plan_id) {
      await trx.rollback();
      return res.status(400).json({ error: 'Thiết bị chưa có gói cước, không thể gia hạn' });
    }

    const { months = 1, amount, notes } = req.body;

    const plan = await trx('service_plans').where('id', device.service_plan_id).first();
    const fee = amount || parseFloat(device.monthly_fee) || (plan ? parseFloat(plan.retail_price) : 0);
    const totalAmount = fee * months;

    // Tính kỳ gia hạn
    const periodStart = device.subscription_end_date
      ? new Date(new Date(device.subscription_end_date).getTime() + 86400000)
      : (device.next_billing_date ? new Date(device.next_billing_date) : new Date());
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + months);

    const nextBilling = new Date(periodEnd);
    nextBilling.setDate(nextBilling.getDate() + 1);

    // 1. Tạo bản ghi billing
    const [billing] = await trx('starlink_billings').insert({
      device_id: device.id,
      customer_id: device.customer_id,
      service_plan_id: device.service_plan_id,
      billing_period_start: periodStart,
      billing_period_end: periodEnd,
      amount: totalAmount,
      status: 'billed',
      notes: notes || `Gia hạn ${months} tháng - KIT: ${device.kit_number}`,
      created_by: req.user.id,
    }).returning('*');

    // 2. Tạo hoá đơn
    const lastInvoice = await trx('invoices').orderBy('id', 'desc').first();
    const invNum = lastInvoice ? parseInt((lastInvoice.invoice_number || '').replace('HD', '')) + 1 : 1;
    const invoiceNumber = `HD${String(invNum).padStart(6, '0')}`;

    const subtotal = totalAmount;
    const taxAmount = Math.round(subtotal * 0.1);
    const grandTotal = subtotal + taxAmount;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const [invoice] = await trx('invoices').insert({
      invoice_number: invoiceNumber,
      invoice_type: 'subscription',
      customer_id: device.customer_id,
      invoice_date: new Date(),
      due_date: dueDate,
      subtotal: subtotal,
      tax_amount: taxAmount,
      grand_total: grandTotal,
      status: 'issued',
      payment_status: 'unpaid',
      paid_amount: 0,
      notes: `Gia hạn gói cước ${plan ? plan.name : ''} - KIT: ${device.kit_number} (${months} tháng)`,
      created_by: req.user.id,
    }).returning('*');

    // 2b. Tạo chi tiết hoá đơn
    await trx('invoice_items').insert({
      invoice_id: invoice.id,
      item_type: 'service_plan',
      service_plan_id: device.service_plan_id,
      description: `Gói cước ${plan ? plan.name : ''} - KIT: ${device.kit_number} (${months} tháng, ${periodStart.toISOString().slice(0, 10)} → ${periodEnd.toISOString().slice(0, 10)})`,
      quantity: months,
      unit_price: fee,
      tax_percent: 10,
      tax_amount: taxAmount,
      total_amount: grandTotal,
    });

    // 3. Tạo công nợ phải thu
    const [receivable] = await trx('receivables').insert({
      customer_id: device.customer_id,
      invoice_id: invoice.id,
      original_amount: grandTotal,
      paid_amount: 0,
      remaining_amount: grandTotal,
      due_date: dueDate,
      status: 'outstanding',
      notes: `Gia hạn Starlink KIT: ${device.kit_number}`,
    }).returning('*');

    // 4. Cập nhật billing với invoice_id và receivable_id
    await trx('starlink_billings').where('id', billing.id).update({
      invoice_id: invoice.id,
      receivable_id: receivable.id,
      status: 'billed',
    });

    // 5. Cập nhật thiết bị
    await trx('starlink_devices').where('id', device.id).update({
      subscription_end_date: periodEnd,
      next_billing_date: nextBilling,
      updated_at: new Date(),
    });

    // 6. Tăng công nợ khách hàng
    await trx('customers').where('id', device.customer_id)
      .increment('current_debt', grandTotal);

    await trx.commit();

    res.status(201).json({
      message: `Gia hạn ${months} tháng thành công. Hoá đơn: ${invoiceNumber}`,
      billing,
      invoice: { id: invoice.id, invoice_number: invoiceNumber, grand_total: grandTotal },
      receivable: { id: receivable.id },
      period: {
        start: periodStart.toISOString().slice(0, 10),
        end: periodEnd.toISOString().slice(0, 10),
      },
    });
  } catch (error) {
    await trx.rollback();
    console.error('Renew starlink device error:', error);
    res.status(500).json({ error: 'Lỗi gia hạn: ' + error.message });
  }
});

// ============================================
// LỊCH SỬ GIA HẠN CỦA THIẾT BỊ
// ============================================
router.get('/:id/billings', authorize('sales', 'view'), async (req, res) => {
  try {
    const billings = await db('starlink_billings')
      .leftJoin('service_plans', 'starlink_billings.service_plan_id', 'service_plans.id')
      .leftJoin('invoices', 'starlink_billings.invoice_id', 'invoices.id')
      .where('starlink_billings.device_id', req.params.id)
      .select(
        'starlink_billings.*',
        'service_plans.name as plan_name',
        'invoices.invoice_number',
        'invoices.payment_status'
      )
      .orderBy('starlink_billings.billing_period_start', 'desc');

    res.json({ data: billings });
  } catch (error) {
    console.error('Get billings error:', error);
    res.status(500).json({ error: 'Lỗi lấy lịch sử gia hạn' });
  }
});

// ============================================
// XÓA THIẾT BỊ
// ============================================
router.delete('/:id', authorize('sales', 'delete'), async (req, res) => {
  try {
    const device = await db('starlink_devices').where('id', req.params.id).first();
    if (!device) return res.status(404).json({ error: 'Không tìm thấy thiết bị' });

    await db('starlink_devices').where('id', req.params.id).del();
    res.json({ message: 'Xóa thiết bị thành công' });
  } catch (error) {
    console.error('Delete starlink device error:', error);
    res.status(500).json({ error: 'Lỗi xóa thiết bị' });
  }
});

module.exports = router;
