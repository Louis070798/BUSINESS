const express = require('express');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();
router.use(authenticate);

// ============================================
// DANH MỤC SẢN PHẨM (phải đặt trước /:id)
// ============================================
router.get('/categories/all', async (req, res) => {
  try {
    const categories = await db('product_categories').where('is_active', true).orderBy('name');
    res.json({ data: categories });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy danh mục' });
  }
});

// ============================================
// CẢNH BÁO TỒN KHO THẤP (phải đặt trước /:id)
// ============================================
router.get('/alerts/low-stock', authorize('products', 'view'), async (req, res) => {
  try {
    const products = await db('products')
      .whereRaw('stock_quantity <= min_stock_level')
      .where('is_active', true)
      .orderBy('stock_quantity', 'asc');

    res.json({ data: products, count: products.length });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy cảnh báo tồn kho' });
  }
});

// ============================================
// DANH SÁCH THIẾT BỊ
// ============================================
router.get('/', authorize('products', 'view'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, category_id, supplier_id, status, low_stock } = req.query;
    const offset = (page - 1) * limit;

    let query = db('products')
      .where('products.is_active', true)
      .leftJoin('product_categories', 'products.category_id', 'product_categories.id')
      .leftJoin('suppliers', 'products.supplier_id', 'suppliers.id')
      .select('products.*',
        'product_categories.name as category_name',
        'suppliers.name as supplier_name');

    if (search) {
      query = query.where(function () {
        this.where('products.name', 'ilike', `%${search}%`)
          .orWhere('products.code', 'ilike', `%${search}%`)
          .orWhere('products.serial_number', 'ilike', `%${search}%`)
          .orWhere('products.imei', 'ilike', `%${search}%`);
      });
    }
    if (category_id) query = query.where('products.category_id', category_id);
    if (supplier_id) query = query.where('products.supplier_id', supplier_id);
    if (status) query = query.where('products.status', status);
    if (low_stock === 'true') {
      query = query.whereRaw('products.stock_quantity <= products.min_stock_level');
    }

    const total = await query.clone().clearSelect().count('* as count').first();
    const data = await query.orderBy('products.created_at', 'desc').limit(limit).offset(offset);

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
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách thiết bị' });
  }
});

// ============================================
// CHI TIẾT THIẾT BỊ
// ============================================
router.get('/:id', authorize('products', 'view'), async (req, res) => {
  try {
    const product = await db('products')
      .leftJoin('product_categories', 'products.category_id', 'product_categories.id')
      .leftJoin('suppliers', 'products.supplier_id', 'suppliers.id')
      .where('products.id', req.params.id)
      .select('products.*', 'product_categories.name as category_name', 'suppliers.name as supplier_name')
      .first();

    if (!product) {
      return res.status(404).json({ error: 'Không tìm thấy thiết bị' });
    }

    // Lịch sử kho
    const inventoryHistory = await db('inventory_transactions')
      .where('product_id', req.params.id)
      .orderBy('created_at', 'desc')
      .limit(20);

    res.json({ data: product, inventoryHistory });
  } catch (error) {
    console.error('Get product detail error:', error);
    res.status(500).json({ error: 'Lỗi lấy thông tin thiết bị' });
  }
});

// ============================================
// TẠO THIẾT BỊ
// ============================================
router.post('/', authorize('products', 'create'), [
  body('name').notEmpty().withMessage('Tên thiết bị không được để trống'),
  validate,
], auditLog('create', 'products'), async (req, res) => {
  try {
    // Tự động tạo mã SP nếu không có
    if (!req.body.code) {
      const last = await db('products').orderBy('id', 'desc').first();
      const nextNum = (last?.id || 0) + 1;
      req.body.code = `TB${String(nextNum).padStart(3, '0')}`;
    }

    const exists = await db('products').where('code', req.body.code).first();
    if (exists) {
      return res.status(400).json({ error: 'Mã thiết bị đã tồn tại' });
    }

    // Whitelist fields
    const {
      code, name, category_id, serial_number, imei, unit, type,
      cost_price, retail_price, agent_level1_price, agent_level2_price,
      stock_quantity, min_stock_level, supplier_id, status,
      warranty_months, description, notes, image_url,
    } = req.body;

    const insertData = {
      code: req.body.code,
      name,
      category_id: category_id || null,
      serial_number: serial_number || null,
      imei: imei || null,
      unit: unit || 'Cái',
      type: type || 'equipment',
      cost_price: cost_price || 0,
      retail_price: retail_price || 0,
      agent_level1_price: agent_level1_price || 0,
      agent_level2_price: agent_level2_price || 0,
      stock_quantity: stock_quantity || 0,
      min_stock_level: min_stock_level != null ? min_stock_level : 5,
      supplier_id: supplier_id || null,
      status: status || 'active',
      warranty_months: warranty_months || '12',
      description: description || null,
      notes: notes || null,
      image_url: image_url || null,
    };

    const [product] = await db('products').insert(insertData).returning('*');
    res.status(201).json({ id: product.id, data: product, message: 'Tạo thiết bị thành công' });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Lỗi tạo thiết bị: ' + error.message });
  }
});

// ============================================
// CẬP NHẬT THIẾT BỊ
// ============================================
router.put('/:id', authorize('products', 'edit'), [
  body('name').notEmpty().withMessage('Tên thiết bị không được để trống'),
  validate,
], auditLog('update', 'products'), async (req, res) => {
  try {
    const allowedFields = [
      'name', 'category_id', 'serial_number', 'imei', 'unit', 'type',
      'cost_price', 'retail_price', 'agent_level1_price', 'agent_level2_price',
      'stock_quantity', 'min_stock_level', 'supplier_id', 'status',
      'warranty_months', 'description', 'notes', 'image_url',
    ];
    const updateData = { updated_at: new Date() };
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    });

    await db('products').where('id', req.params.id).update(updateData);
    res.json({ message: 'Cập nhật thiết bị thành công' });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Lỗi cập nhật thiết bị: ' + error.message });
  }
});

// ============================================
// XÓA THIẾT BỊ (soft delete)
// ============================================
router.delete('/:id', authorize('products', 'delete'), auditLog('delete', 'products'), async (req, res) => {
  try {
    await db('products').where('id', req.params.id).update({ is_active: false, status: 'inactive' });
    res.json({ message: 'Đã vô hiệu hóa thiết bị' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Lỗi xóa thiết bị' });
  }
});

module.exports = router;
