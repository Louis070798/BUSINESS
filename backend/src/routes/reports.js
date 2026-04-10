const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ============================================
// DASHBOARD TỔNG QUAN
// ============================================
router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);

    // Doanh thu tháng này
    const monthlyRevenue = await db('sales_orders')
      .where('order_date', '>=', firstDayOfMonth)
      .where('status', '!=', 'cancelled')
      .select(
        db.raw('COALESCE(SUM(grand_total), 0) as revenue'),
        db.raw('COALESCE(SUM(profit), 0) as profit'),
        db.raw('COUNT(*) as order_count')
      )
      .first();

    // Doanh thu năm nay
    const yearlyRevenue = await db('sales_orders')
      .where('order_date', '>=', firstDayOfYear)
      .where('status', '!=', 'cancelled')
      .select(
        db.raw('COALESCE(SUM(grand_total), 0) as revenue'),
        db.raw('COALESCE(SUM(profit), 0) as profit')
      )
      .first();

    // Tổng công nợ phải thu
    const totalReceivable = await db('receivables')
      .whereIn('status', ['outstanding', 'partial', 'overdue'])
      .sum('remaining_amount as total')
      .first();

    // Tổng công nợ phải trả
    const totalPayable = await db('payables')
      .whereIn('status', ['outstanding', 'partial', 'overdue'])
      .sum('remaining_amount as total')
      .first();

    // Khách hàng mới tháng này
    const newCustomers = await db('customers')
      .where('created_at', '>=', firstDayOfMonth)
      .count('* as count')
      .first();

    // Sản phẩm tồn kho thấp
    const lowStock = await db('products')
      .whereRaw('stock_quantity <= min_stock_level')
      .where('is_active', true)
      .count('* as count')
      .first();

    // Gói cước sắp hết hạn (30 ngày)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const expiringPlans = await db('subscriptions')
      .where('end_date', '<=', futureDate)
      .where('status', 'active')
      .count('* as count')
      .first();

    // Gói cước active
    const activeSubs = await db('subscriptions')
      .where('status', 'active')
      .count('* as count')
      .first();

    // Giá trị kho
    const stockValue = await db('products')
      .where('is_active', true)
      .select(db.raw('COALESCE(SUM(stock_quantity * cost_price), 0) as value'))
      .first();

    // Hóa đơn chưa thanh toán
    const unpaidInvoices = await db('invoices')
      .where('payment_status', '!=', 'paid')
      .where('status', '!=', 'cancelled')
      .select(
        db.raw('COUNT(*) as count'),
        db.raw('COALESCE(SUM(grand_total - paid_amount), 0) as total')
      )
      .first();

    // Công nợ quá hạn
    const overdueCount = await db('receivables')
      .where('due_date', '<', today)
      .whereIn('status', ['outstanding', 'partial', 'overdue'])
      .count('* as count')
      .first();

    res.json({
      monthlyRevenue: parseFloat(monthlyRevenue.revenue),
      monthlyProfit: parseFloat(monthlyRevenue.profit),
      monthlyOrderCount: parseInt(monthlyRevenue.order_count),
      yearlyRevenue: parseFloat(yearlyRevenue.revenue),
      yearlyProfit: parseFloat(yearlyRevenue.profit),
      totalReceivable: parseFloat(totalReceivable.total || 0),
      totalPayable: parseFloat(totalPayable.total || 0),
      newCustomers: parseInt(newCustomers.count),
      lowStockCount: parseInt(lowStock.count),
      expiringPlans: parseInt(expiringPlans.count),
      activeSubscriptions: parseInt(activeSubs.count),
      stockValue: parseFloat(stockValue.value),
      unpaidInvoiceCount: parseInt(unpaidInvoices.count),
      unpaidInvoiceTotal: parseFloat(unpaidInvoices.total),
      overdueCount: parseInt(overdueCount.count),
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Lỗi lấy dữ liệu dashboard' });
  }
});

// ============================================
// BIỂU ĐỒ DOANH THU THEO THÁNG
// ============================================
router.get('/revenue-chart', authorize('reports', 'view'), async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    const data = await db('sales_orders')
      .where('status', '!=', 'cancelled')
      .whereRaw('EXTRACT(YEAR FROM order_date) = ?', [year])
      .select(
        db.raw("EXTRACT(MONTH FROM order_date) as month"),
        db.raw('COALESCE(SUM(grand_total), 0) as revenue'),
        db.raw('COALESCE(SUM(profit), 0) as profit'),
        db.raw('COALESCE(SUM(cost_total), 0) as cost'),
        db.raw('COUNT(*) as order_count')
      )
      .groupByRaw('EXTRACT(MONTH FROM order_date)')
      .orderByRaw('EXTRACT(MONTH FROM order_date)');

    // Đảm bảo đủ 12 tháng
    const months = [];
    for (let i = 1; i <= 12; i++) {
      const found = data.find(d => parseInt(d.month) === i);
      months.push({
        month: i,
        monthName: `T${i}`,
        revenue: found ? parseFloat(found.revenue) : 0,
        profit: found ? parseFloat(found.profit) : 0,
        cost: found ? parseFloat(found.cost) : 0,
        orderCount: found ? parseInt(found.order_count) : 0,
      });
    }

    res.json({ data: months, year: parseInt(year) });
  } catch (error) {
    console.error('Revenue chart error:', error);
    res.status(500).json({ error: 'Lỗi lấy biểu đồ doanh thu' });
  }
});

// ============================================
// BÁO CÁO BÁN HÀNG
// ============================================
router.get('/sales', authorize('reports', 'view'), async (req, res) => {
  try {
    const { date_from, date_to, group_by = 'day', customer_group } = req.query;

    let dateFormat;
    switch (group_by) {
      case 'month': dateFormat = "TO_CHAR(order_date, 'YYYY-MM')"; break;
      case 'quarter': dateFormat = "TO_CHAR(order_date, 'YYYY') || '-Q' || EXTRACT(QUARTER FROM order_date)"; break;
      case 'year': dateFormat = "TO_CHAR(order_date, 'YYYY')"; break;
      default: dateFormat = "TO_CHAR(order_date, 'YYYY-MM-DD')";
    }

    let query = db('sales_orders')
      .leftJoin('customer_groups', 'sales_orders.customer_group_code', 'customer_groups.code')
      .where('sales_orders.status', '!=', 'cancelled');

    if (date_from) query = query.where('order_date', '>=', date_from);
    if (date_to) query = query.where('order_date', '<=', date_to);
    if (customer_group) query = query.where('customer_group_code', customer_group);

    const data = await query
      .select(
        db.raw(`${dateFormat} as period`),
        db.raw('COALESCE(SUM(grand_total), 0) as revenue'),
        db.raw('COALESCE(SUM(profit), 0) as profit'),
        db.raw('COALESCE(SUM(cost_total), 0) as cost'),
        db.raw('COALESCE(SUM(discount_amount), 0) as discount'),
        db.raw('COALESCE(SUM(tax_amount), 0) as tax'),
        db.raw('COUNT(*) as order_count')
      )
      .groupByRaw(dateFormat)
      .orderByRaw(`${dateFormat}`);

    // Tổng cộng
    const totals = data.reduce((acc, row) => ({
      revenue: acc.revenue + parseFloat(row.revenue),
      profit: acc.profit + parseFloat(row.profit),
      cost: acc.cost + parseFloat(row.cost),
      orderCount: acc.orderCount + parseInt(row.order_count),
    }), { revenue: 0, profit: 0, cost: 0, orderCount: 0 });

    res.json({ data, totals });
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ error: 'Lỗi báo cáo bán hàng' });
  }
});

// ============================================
// BÁO CÁO DOANH THU THEO KHÁCH HÀNG
// ============================================
router.get('/revenue-by-customer', authorize('reports', 'view'), async (req, res) => {
  try {
    const { date_from, date_to, customer_group } = req.query;

    let query = db('sales_orders')
      .leftJoin('customers', 'sales_orders.customer_id', 'customers.id')
      .leftJoin('customer_groups', 'customers.group_id', 'customer_groups.id')
      .where('sales_orders.status', '!=', 'cancelled');

    if (date_from) query = query.where('order_date', '>=', date_from);
    if (date_to) query = query.where('order_date', '<=', date_to);
    if (customer_group) query = query.where('customer_groups.code', customer_group);

    const data = await query
      .select(
        'customers.id as customer_id',
        'customers.customer_name',
        'customers.company_name',
        'customer_groups.name as group_name',
        db.raw('COALESCE(SUM(sales_orders.grand_total), 0) as revenue'),
        db.raw('COALESCE(SUM(sales_orders.profit), 0) as profit'),
        db.raw('COUNT(*) as order_count')
      )
      .groupBy('customers.id', 'customers.customer_name', 'customers.company_name', 'customer_groups.name')
      .orderByRaw('SUM(sales_orders.grand_total) DESC');

    res.json({ data });
  } catch (error) {
    console.error('Revenue by customer error:', error);
    res.status(500).json({ error: 'Lỗi báo cáo doanh thu theo khách hàng' });
  }
});

// ============================================
// BÁO CÁO DOANH THU THEO NHÓM ĐẠI LÝ
// ============================================
router.get('/revenue-by-group', authorize('reports', 'view'), async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    let query = db('sales_orders')
      .leftJoin('customer_groups', 'sales_orders.customer_group_code', 'customer_groups.code')
      .where('sales_orders.status', '!=', 'cancelled');

    if (date_from) query = query.where('order_date', '>=', date_from);
    if (date_to) query = query.where('order_date', '<=', date_to);

    const data = await query
      .select(
        'customer_groups.code as group_code',
        'customer_groups.name as group_name',
        db.raw('COALESCE(SUM(sales_orders.grand_total), 0) as revenue'),
        db.raw('COALESCE(SUM(sales_orders.profit), 0) as profit'),
        db.raw('COUNT(*) as order_count')
      )
      .groupBy('customer_groups.code', 'customer_groups.name')
      .orderByRaw('SUM(sales_orders.grand_total) DESC');

    res.json({ data });
  } catch (error) {
    console.error('Revenue by group error:', error);
    res.status(500).json({ error: 'Lỗi báo cáo theo nhóm đại lý' });
  }
});

// ============================================
// BÁO CÁO LỢI NHUẬN THEO SẢN PHẨM
// ============================================
router.get('/profit-by-product', authorize('reports', 'view'), async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    let query = db('sales_order_items')
      .leftJoin('sales_orders', 'sales_order_items.sales_order_id', 'sales_orders.id')
      .leftJoin('products', 'sales_order_items.product_id', 'products.id')
      .leftJoin('service_plans', 'sales_order_items.service_plan_id', 'service_plans.id')
      .where('sales_orders.status', '!=', 'cancelled');

    if (date_from) query = query.where('sales_orders.order_date', '>=', date_from);
    if (date_to) query = query.where('sales_orders.order_date', '<=', date_to);

    const data = await query
      .select(
        'sales_order_items.item_type',
        db.raw("COALESCE(products.name, service_plans.name) as item_name"),
        db.raw("COALESCE(products.code, service_plans.code) as item_code"),
        db.raw('COALESCE(SUM(sales_order_items.total_amount), 0) as revenue'),
        db.raw('COALESCE(SUM(sales_order_items.profit), 0) as profit'),
        db.raw('COALESCE(SUM(sales_order_items.quantity), 0) as total_quantity')
      )
      .groupBy('sales_order_items.item_type', 'products.name', 'products.code', 'service_plans.name', 'service_plans.code')
      .orderByRaw('SUM(sales_order_items.profit) DESC');

    res.json({ data });
  } catch (error) {
    console.error('Profit by product error:', error);
    res.status(500).json({ error: 'Lỗi báo cáo lợi nhuận theo sản phẩm' });
  }
});

// ============================================
// BÁO CÁO TỒN KHO
// ============================================
router.get('/inventory', authorize('reports', 'view'), async (req, res) => {
  try {
    const data = await db('products')
      .leftJoin('product_categories', 'products.category_id', 'product_categories.id')
      .leftJoin('suppliers', 'products.supplier_id', 'suppliers.id')
      .where('products.is_active', true)
      .select(
        'products.id', 'products.code', 'products.name',
        'products.stock_quantity', 'products.min_stock_level',
        'products.cost_price', 'products.retail_price',
        db.raw('products.stock_quantity * products.cost_price as stock_value'),
        'product_categories.name as category_name',
        'suppliers.name as supplier_name',
        db.raw('CASE WHEN products.stock_quantity <= products.min_stock_level THEN true ELSE false END as is_low_stock')
      )
      .orderBy('products.stock_quantity', 'asc');

    const summary = {
      totalItems: data.length,
      totalStock: data.reduce((s, p) => s + parseInt(p.stock_quantity), 0),
      totalValue: data.reduce((s, p) => s + parseFloat(p.stock_value), 0),
      lowStockItems: data.filter(p => p.is_low_stock).length,
    };

    res.json({ data, summary });
  } catch (error) {
    console.error('Inventory report error:', error);
    res.status(500).json({ error: 'Lỗi báo cáo tồn kho' });
  }
});

// ============================================
// BÁO CÁO CÔNG NỢ KHÁCH HÀNG
// ============================================
router.get('/customer-debt', authorize('reports', 'view'), async (req, res) => {
  try {
    const data = await db('customers')
      .leftJoin('customer_groups', 'customers.group_id', 'customer_groups.id')
      .where('customers.current_debt', '>', 0)
      .select(
        'customers.id', 'customers.code', 'customers.customer_name', 'customers.company_name',
        'customers.phone', 'customers.current_debt', 'customers.credit_limit',
        'customer_groups.name as group_name'
      )
      .orderBy('customers.current_debt', 'desc');

    const totalDebt = data.reduce((s, c) => s + parseFloat(c.current_debt), 0);

    res.json({ data, totalDebt });
  } catch (error) {
    console.error('Customer debt report error:', error);
    res.status(500).json({ error: 'Lỗi báo cáo công nợ khách hàng' });
  }
});

// ============================================
// BÁO CÁO CÔNG NỢ NHÀ CUNG CẤP
// ============================================
router.get('/supplier-debt', authorize('reports', 'view'), async (req, res) => {
  try {
    const data = await db('suppliers')
      .where('current_debt', '>', 0)
      .select('id', 'code', 'name', 'phone', 'current_debt')
      .orderBy('current_debt', 'desc');

    const totalDebt = data.reduce((s, c) => s + parseFloat(c.current_debt), 0);

    res.json({ data, totalDebt });
  } catch (error) {
    console.error('Supplier debt report error:', error);
    res.status(500).json({ error: 'Lỗi báo cáo công nợ NCC' });
  }
});

module.exports = router;
