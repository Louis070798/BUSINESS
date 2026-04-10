const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ============================================
// TỔNG QUAN KHO
// ============================================
router.get('/summary', authorize('inventory', 'view'), async (req, res) => {
  try {
    const totalProducts = await db('products').where('is_active', true).count('* as count').first();
    const totalStock = await db('products').where('is_active', true).sum('stock_quantity as total').first();
    const lowStock = await db('products')
      .whereRaw('stock_quantity <= min_stock_level')
      .where('is_active', true)
      .count('* as count').first();
    const stockValue = await db('products')
      .where('is_active', true)
      .select(db.raw('SUM(stock_quantity * cost_price) as value'))
      .first();

    res.json({
      totalProducts: parseInt(totalProducts.count),
      totalStock: parseInt(totalStock.total || 0),
      lowStockCount: parseInt(lowStock.count),
      stockValue: parseFloat(stockValue.value || 0),
    });
  } catch (error) {
    console.error('Inventory summary error:', error);
    res.status(500).json({ error: 'Lỗi lấy tổng quan kho' });
  }
});

// ============================================
// LỊCH SỬ XUẤT NHẬP KHO
// ============================================
router.get('/transactions', authorize('inventory', 'view'), async (req, res) => {
  try {
    const { page = 1, limit = 20, product_id, transaction_type, date_from, date_to } = req.query;
    const offset = (page - 1) * limit;

    let query = db('inventory_transactions')
      .leftJoin('products', 'inventory_transactions.product_id', 'products.id')
      .leftJoin('users', 'inventory_transactions.created_by', 'users.id')
      .select('inventory_transactions.*',
        'products.name as product_name', 'products.code as product_code',
        'users.full_name as created_by_name');

    if (product_id) query = query.where('inventory_transactions.product_id', product_id);
    if (transaction_type) query = query.where('inventory_transactions.transaction_type', transaction_type);
    if (date_from) query = query.where('inventory_transactions.created_at', '>=', date_from);
    if (date_to) query = query.where('inventory_transactions.created_at', '<=', date_to);

    const total = await query.clone().clearSelect().count('* as count').first();
    const data = await query.orderBy('inventory_transactions.created_at', 'desc').limit(limit).offset(offset);

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
    console.error('Get inventory transactions error:', error);
    res.status(500).json({ error: 'Lỗi lấy lịch sử kho' });
  }
});

// ============================================
// ĐIỀU CHỈNH KHO
// ============================================
router.post('/adjust', authorize('inventory', 'edit'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const { product_id, quantity, notes } = req.body;

    const product = await trx('products').where('id', product_id).first();
    if (!product) {
      await trx.rollback();
      return res.status(404).json({ error: 'Không tìm thấy thiết bị' });
    }

    const newStock = product.stock_quantity + quantity;
    if (newStock < 0) {
      await trx.rollback();
      return res.status(400).json({ error: 'Tồn kho không thể âm' });
    }

    await trx('products').where('id', product_id).update({ stock_quantity: newStock });

    await trx('inventory_transactions').insert({
      product_id,
      transaction_type: 'adjustment',
      reference_type: 'adjustment',
      quantity,
      stock_before: product.stock_quantity,
      stock_after: newStock,
      notes: notes || 'Điều chỉnh kho thủ công',
      created_by: req.user.id,
    });

    await trx.commit();
    res.json({ message: 'Điều chỉnh kho thành công', newStock });
  } catch (error) {
    await trx.rollback();
    console.error('Adjust inventory error:', error);
    res.status(500).json({ error: 'Lỗi điều chỉnh kho' });
  }
});

module.exports = router;
