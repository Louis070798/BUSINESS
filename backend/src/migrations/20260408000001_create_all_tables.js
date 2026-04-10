/**
 * Migration: Tạo toàn bộ cấu trúc database
 * Hệ thống quản lý kế toán và kinh doanh thiết bị + gói cước
 */

exports.up = async function (knex) {
  // ============================================
  // 1. BẢNG ROLES - Vai trò người dùng
  // ============================================
  await knex.schema.createTable('roles', (table) => {
    table.increments('id').primary();
    table.string('code', 50).notNullable().unique(); // admin, accountant, sales, warehouse, manager
    table.string('name', 100).notNullable();
    table.text('description');
    table.jsonb('permissions').defaultTo('{}'); // JSON chứa quyền chi tiết
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  // ============================================
  // 2. BẢNG USERS - Người dùng
  // ============================================
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('username', 100).notNullable().unique();
    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('full_name', 200).notNullable();
    table.string('phone', 20);
    table.integer('role_id').unsigned().references('id').inTable('roles').onDelete('SET NULL');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('last_login');
    table.timestamps(true, true);
  });

  // ============================================
  // 3. BẢNG CUSTOMER_GROUPS - Nhóm khách hàng
  // ============================================
  await knex.schema.createTable('customer_groups', (table) => {
    table.increments('id').primary();
    table.string('code', 50).notNullable().unique(); // agent_level1, agent_level2, retail
    table.string('name', 100).notNullable();
    table.text('description');
    table.decimal('discount_percent', 5, 2).defaultTo(0);
    table.decimal('credit_limit', 18, 2).defaultTo(0); // Hạn mức công nợ mặc định
    table.integer('payment_term_days').defaultTo(0); // Số ngày thanh toán mặc định
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  // ============================================
  // 4. BẢNG CUSTOMERS - Khách hàng
  // ============================================
  await knex.schema.createTable('customers', (table) => {
    table.increments('id').primary();
    table.string('code', 50).notNullable().unique();
    table.string('company_name', 255);
    table.string('customer_name', 255).notNullable();
    table.string('contact_person', 200);
    table.string('phone', 20);
    table.string('email', 255);
    table.text('address');
    table.string('tax_code', 50); // Mã số thuế
    table.integer('group_id').unsigned().references('id').inTable('customer_groups').onDelete('SET NULL');
    table.decimal('credit_limit', 18, 2).defaultTo(0); // Hạn mức công nợ riêng
    table.integer('payment_term_days').defaultTo(0); // Điều khoản thanh toán (ngày)
    table.decimal('current_debt', 18, 2).defaultTo(0); // Công nợ hiện tại
    table.boolean('is_active').defaultTo(true);
    table.text('notes');
    table.integer('created_by').unsigned().references('id').inTable('users');
    table.timestamps(true, true);
  });

  // ============================================
  // 5. BẢNG SUPPLIERS - Nhà cung cấp
  // ============================================
  await knex.schema.createTable('suppliers', (table) => {
    table.increments('id').primary();
    table.string('code', 50).notNullable().unique();
    table.string('name', 255).notNullable();
    table.string('contact_person', 200);
    table.string('phone', 20);
    table.string('email', 255);
    table.text('address');
    table.string('tax_code', 50);
    table.string('bank_account', 50);
    table.string('bank_name', 200);
    table.decimal('current_debt', 18, 2).defaultTo(0); // Công nợ phải trả
    table.integer('payment_term_days').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.text('notes');
    table.timestamps(true, true);
  });

  // ============================================
  // 6. BẢNG PRODUCT_CATEGORIES - Danh mục thiết bị
  // ============================================
  await knex.schema.createTable('product_categories', (table) => {
    table.increments('id').primary();
    table.string('code', 50).notNullable().unique();
    table.string('name', 200).notNullable();
    table.text('description');
    table.integer('parent_id').unsigned().references('id').inTable('product_categories').onDelete('SET NULL');
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  // ============================================
  // 7. BẢNG PRODUCTS - Thiết bị
  // ============================================
  await knex.schema.createTable('products', (table) => {
    table.increments('id').primary();
    table.string('code', 50).notNullable().unique();
    table.string('name', 255).notNullable();
    table.integer('category_id').unsigned().references('id').inTable('product_categories').onDelete('SET NULL');
    table.string('serial_number', 100);
    table.string('imei', 50);
    table.string('unit', 50).defaultTo('Cái'); // Đơn vị tính
    table.decimal('cost_price', 18, 2).defaultTo(0); // Giá nhập
    table.decimal('retail_price', 18, 2).defaultTo(0); // Giá bán lẻ
    table.decimal('agent_level1_price', 18, 2).defaultTo(0); // Giá đại lý cấp 1
    table.decimal('agent_level2_price', 18, 2).defaultTo(0); // Giá đại lý cấp 2
    table.integer('stock_quantity').defaultTo(0); // Tồn kho
    table.integer('min_stock_level').defaultTo(5); // Tồn kho tối thiểu
    table.integer('supplier_id').unsigned().references('id').inTable('suppliers').onDelete('SET NULL');
    table.string('status', 50).defaultTo('active'); // active, inactive, discontinued
    table.string('warranty_months', 10).defaultTo('12'); // Bảo hành
    table.text('description');
    table.text('notes');
    table.string('image_url', 500);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  // ============================================
  // 8. BẢNG SERVICE_PLANS - Gói cước hàng tháng
  // ============================================
  await knex.schema.createTable('service_plans', (table) => {
    table.increments('id').primary();
    table.string('code', 50).notNullable().unique();
    table.string('name', 255).notNullable();
    table.string('plan_type', 100); // Loại gói: internet, truyền hình, combo...
    table.decimal('cost_price', 18, 2).defaultTo(0); // Giá vốn
    table.decimal('retail_price', 18, 2).defaultTo(0); // Giá bán lẻ
    table.decimal('agent_level1_price', 18, 2).defaultTo(0); // Giá đại lý cấp 1
    table.decimal('agent_level2_price', 18, 2).defaultTo(0); // Giá đại lý cấp 2
    table.string('billing_cycle', 20).defaultTo('monthly'); // monthly, quarterly, yearly
    table.integer('duration_months').defaultTo(1); // Thời hạn gói (tháng)
    table.string('status', 50).defaultTo('active'); // active, inactive, discontinued
    table.text('features'); // Tính năng gói cước
    table.text('description');
    table.text('notes');
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  // ============================================
  // 9. BẢNG PURCHASE_ORDERS - Đơn nhập hàng
  // ============================================
  await knex.schema.createTable('purchase_orders', (table) => {
    table.increments('id').primary();
    table.string('order_number', 50).notNullable().unique();
    table.integer('supplier_id').unsigned().references('id').inTable('suppliers').onDelete('SET NULL');
    table.date('order_date').notNullable().defaultTo(knex.fn.now());
    table.date('delivery_date');
    table.decimal('total_amount', 18, 2).defaultTo(0);
    table.decimal('discount_amount', 18, 2).defaultTo(0);
    table.decimal('tax_amount', 18, 2).defaultTo(0);
    table.decimal('grand_total', 18, 2).defaultTo(0);
    table.string('status', 50).defaultTo('draft'); // draft, confirmed, received, cancelled
    table.string('payment_status', 50).defaultTo('unpaid'); // unpaid, partial, paid
    table.decimal('paid_amount', 18, 2).defaultTo(0);
    table.text('notes');
    table.integer('created_by').unsigned().references('id').inTable('users');
    table.integer('approved_by').unsigned().references('id').inTable('users');
    table.timestamps(true, true);
  });

  // ============================================
  // 10. BẢNG PURCHASE_ORDER_ITEMS - Chi tiết đơn nhập
  // ============================================
  await knex.schema.createTable('purchase_order_items', (table) => {
    table.increments('id').primary();
    table.integer('purchase_order_id').unsigned().references('id').inTable('purchase_orders').onDelete('CASCADE');
    table.integer('product_id').unsigned().references('id').inTable('products').onDelete('SET NULL');
    table.integer('quantity').notNullable().defaultTo(1);
    table.decimal('unit_price', 18, 2).notNullable().defaultTo(0);
    table.decimal('discount_percent', 5, 2).defaultTo(0);
    table.decimal('discount_amount', 18, 2).defaultTo(0);
    table.decimal('tax_percent', 5, 2).defaultTo(10); // VAT 10%
    table.decimal('tax_amount', 18, 2).defaultTo(0);
    table.decimal('total_amount', 18, 2).defaultTo(0);
    table.string('serial_numbers', 500); // Danh sách serial nhập
    table.text('notes');
    table.timestamps(true, true);
  });

  // ============================================
  // 11. BẢNG SALES_ORDERS - Đơn bán hàng
  // ============================================
  await knex.schema.createTable('sales_orders', (table) => {
    table.increments('id').primary();
    table.string('order_number', 50).notNullable().unique();
    table.integer('customer_id').unsigned().references('id').inTable('customers').onDelete('SET NULL');
    table.string('customer_group_code', 50); // Lưu nhóm KH tại thời điểm bán
    table.date('order_date').notNullable().defaultTo(knex.fn.now());
    table.date('delivery_date');
    table.decimal('subtotal', 18, 2).defaultTo(0); // Tạm tính
    table.decimal('discount_percent', 5, 2).defaultTo(0);
    table.decimal('discount_amount', 18, 2).defaultTo(0);
    table.decimal('tax_amount', 18, 2).defaultTo(0);
    table.decimal('grand_total', 18, 2).defaultTo(0); // Tổng thanh toán
    table.decimal('cost_total', 18, 2).defaultTo(0); // Tổng giá vốn
    table.decimal('profit', 18, 2).defaultTo(0); // Lợi nhuận
    table.string('status', 50).defaultTo('draft'); // draft, confirmed, delivered, cancelled
    table.string('payment_status', 50).defaultTo('unpaid'); // unpaid, partial, paid
    table.decimal('paid_amount', 18, 2).defaultTo(0);
    table.string('payment_method', 50); // cash, transfer, debt
    table.text('notes');
    table.text('delivery_address');
    table.integer('created_by').unsigned().references('id').inTable('users');
    table.integer('approved_by').unsigned().references('id').inTable('users');
    table.timestamps(true, true);
  });

  // ============================================
  // 12. BẢNG SALES_ORDER_ITEMS - Chi tiết đơn bán hàng
  // ============================================
  await knex.schema.createTable('sales_order_items', (table) => {
    table.increments('id').primary();
    table.integer('sales_order_id').unsigned().references('id').inTable('sales_orders').onDelete('CASCADE');
    table.string('item_type', 20).notNullable().defaultTo('product'); // product hoặc service_plan
    table.integer('product_id').unsigned().references('id').inTable('products').onDelete('SET NULL');
    table.integer('service_plan_id').unsigned().references('id').inTable('service_plans').onDelete('SET NULL');
    table.integer('quantity').notNullable().defaultTo(1);
    table.decimal('unit_price', 18, 2).notNullable().defaultTo(0); // Giá bán
    table.decimal('cost_price', 18, 2).defaultTo(0); // Giá vốn tại thời điểm bán
    table.decimal('discount_percent', 5, 2).defaultTo(0);
    table.decimal('discount_amount', 18, 2).defaultTo(0);
    table.decimal('tax_percent', 5, 2).defaultTo(10);
    table.decimal('tax_amount', 18, 2).defaultTo(0);
    table.decimal('total_amount', 18, 2).defaultTo(0);
    table.decimal('profit', 18, 2).defaultTo(0); // Lợi nhuận dòng
    table.string('serial_numbers', 500);
    table.text('notes');
    table.timestamps(true, true);
  });

  // ============================================
  // 13. BẢNG SUBSCRIPTIONS - Đăng ký gói cước
  // ============================================
  await knex.schema.createTable('subscriptions', (table) => {
    table.increments('id').primary();
    table.string('subscription_number', 50).notNullable().unique();
    table.integer('customer_id').unsigned().references('id').inTable('customers').onDelete('SET NULL');
    table.integer('service_plan_id').unsigned().references('id').inTable('service_plans').onDelete('SET NULL');
    table.integer('product_id').unsigned().references('id').inTable('products').onDelete('SET NULL'); // Thiết bị liên kết
    table.string('device_serial', 100); // Serial thiết bị đang dùng
    table.date('start_date').notNullable();
    table.date('end_date');
    table.date('next_billing_date');
    table.decimal('monthly_amount', 18, 2).defaultTo(0); // Số tiền hàng tháng
    table.string('billing_cycle', 20).defaultTo('monthly');
    table.string('status', 50).defaultTo('active'); // active, suspended, expired, cancelled
    table.boolean('auto_renew').defaultTo(true);
    table.text('notes');
    table.integer('sales_order_id').unsigned().references('id').inTable('sales_orders');
    table.integer('created_by').unsigned().references('id').inTable('users');
    table.timestamps(true, true);
  });

  // ============================================
  // 14. BẢNG SUBSCRIPTION_BILLING - Lịch sử thanh toán gói cước
  // ============================================
  await knex.schema.createTable('subscription_billing', (table) => {
    table.increments('id').primary();
    table.integer('subscription_id').unsigned().references('id').inTable('subscriptions').onDelete('CASCADE');
    table.date('billing_date').notNullable();
    table.date('period_start').notNullable();
    table.date('period_end').notNullable();
    table.decimal('amount', 18, 2).notNullable();
    table.decimal('tax_amount', 18, 2).defaultTo(0);
    table.decimal('total_amount', 18, 2).notNullable();
    table.string('status', 50).defaultTo('pending'); // pending, invoiced, paid, overdue
    table.integer('invoice_id').unsigned(); // Liên kết hóa đơn
    table.date('paid_date');
    table.text('notes');
    table.timestamps(true, true);
  });

  // ============================================
  // 15. BẢNG INVOICES - Hóa đơn
  // ============================================
  await knex.schema.createTable('invoices', (table) => {
    table.increments('id').primary();
    table.string('invoice_number', 50).notNullable().unique();
    table.string('invoice_type', 50).notNullable().defaultTo('sales'); // sales, quotation, delivery, receipt, debt
    table.integer('customer_id').unsigned().references('id').inTable('customers').onDelete('SET NULL');
    table.integer('sales_order_id').unsigned().references('id').inTable('sales_orders').onDelete('SET NULL');
    table.date('invoice_date').notNullable().defaultTo(knex.fn.now());
    table.date('due_date');
    table.decimal('subtotal', 18, 2).defaultTo(0);
    table.decimal('discount_amount', 18, 2).defaultTo(0);
    table.decimal('tax_amount', 18, 2).defaultTo(0);
    table.decimal('grand_total', 18, 2).defaultTo(0);
    table.string('status', 50).defaultTo('draft'); // draft, issued, paid, cancelled
    table.string('payment_status', 50).defaultTo('unpaid'); // unpaid, partial, paid
    table.decimal('paid_amount', 18, 2).defaultTo(0);
    table.text('notes');
    table.text('terms'); // Điều khoản
    table.string('template', 50).defaultTo('default'); // Mẫu hóa đơn
    table.integer('created_by').unsigned().references('id').inTable('users');
    table.timestamps(true, true);
  });

  // ============================================
  // 16. BẢNG INVOICE_ITEMS - Chi tiết hóa đơn
  // ============================================
  await knex.schema.createTable('invoice_items', (table) => {
    table.increments('id').primary();
    table.integer('invoice_id').unsigned().references('id').inTable('invoices').onDelete('CASCADE');
    table.string('item_type', 20).defaultTo('product'); // product, service_plan, other
    table.integer('product_id').unsigned().references('id').inTable('products').onDelete('SET NULL');
    table.integer('service_plan_id').unsigned().references('id').inTable('service_plans').onDelete('SET NULL');
    table.string('description', 500);
    table.string('unit', 50);
    table.integer('quantity').defaultTo(1);
    table.decimal('unit_price', 18, 2).defaultTo(0);
    table.decimal('discount_percent', 5, 2).defaultTo(0);
    table.decimal('discount_amount', 18, 2).defaultTo(0);
    table.decimal('tax_percent', 5, 2).defaultTo(10);
    table.decimal('tax_amount', 18, 2).defaultTo(0);
    table.decimal('total_amount', 18, 2).defaultTo(0);
    table.timestamps(true, true);
  });

  // ============================================
  // 17. BẢNG PAYMENTS - Thanh toán
  // ============================================
  await knex.schema.createTable('payments', (table) => {
    table.increments('id').primary();
    table.string('payment_number', 50).notNullable().unique();
    table.string('payment_type', 50).notNullable(); // receivable (thu), payable (chi)
    table.integer('customer_id').unsigned().references('id').inTable('customers').onDelete('SET NULL');
    table.integer('supplier_id').unsigned().references('id').inTable('suppliers').onDelete('SET NULL');
    table.integer('invoice_id').unsigned().references('id').inTable('invoices').onDelete('SET NULL');
    table.integer('sales_order_id').unsigned().references('id').inTable('sales_orders').onDelete('SET NULL');
    table.integer('purchase_order_id').unsigned().references('id').inTable('purchase_orders').onDelete('SET NULL');
    table.date('payment_date').notNullable().defaultTo(knex.fn.now());
    table.decimal('amount', 18, 2).notNullable();
    table.string('payment_method', 50).notNullable(); // cash, transfer, debt
    table.string('reference_number', 100); // Số chứng từ
    table.string('bank_name', 200);
    table.string('bank_account', 50);
    table.string('status', 50).defaultTo('completed'); // completed, pending, cancelled
    table.text('notes');
    table.integer('created_by').unsigned().references('id').inTable('users');
    table.timestamps(true, true);
  });

  // ============================================
  // 18. BẢNG RECEIVABLES - Công nợ phải thu
  // ============================================
  await knex.schema.createTable('receivables', (table) => {
    table.increments('id').primary();
    table.integer('customer_id').unsigned().references('id').inTable('customers').onDelete('CASCADE');
    table.integer('invoice_id').unsigned().references('id').inTable('invoices').onDelete('SET NULL');
    table.integer('sales_order_id').unsigned().references('id').inTable('sales_orders').onDelete('SET NULL');
    table.decimal('original_amount', 18, 2).notNullable();
    table.decimal('paid_amount', 18, 2).defaultTo(0);
    table.decimal('remaining_amount', 18, 2).notNullable();
    table.date('due_date');
    table.string('status', 50).defaultTo('outstanding'); // outstanding, partial, paid, overdue
    table.text('notes');
    table.timestamps(true, true);
  });

  // ============================================
  // 19. BẢNG PAYABLES - Công nợ phải trả
  // ============================================
  await knex.schema.createTable('payables', (table) => {
    table.increments('id').primary();
    table.integer('supplier_id').unsigned().references('id').inTable('suppliers').onDelete('CASCADE');
    table.integer('purchase_order_id').unsigned().references('id').inTable('purchase_orders').onDelete('SET NULL');
    table.decimal('original_amount', 18, 2).notNullable();
    table.decimal('paid_amount', 18, 2).defaultTo(0);
    table.decimal('remaining_amount', 18, 2).notNullable();
    table.date('due_date');
    table.string('status', 50).defaultTo('outstanding'); // outstanding, partial, paid, overdue
    table.text('notes');
    table.timestamps(true, true);
  });

  // ============================================
  // 20. BẢNG INVENTORY_TRANSACTIONS - Lịch sử kho
  // ============================================
  await knex.schema.createTable('inventory_transactions', (table) => {
    table.increments('id').primary();
    table.integer('product_id').unsigned().references('id').inTable('products').onDelete('CASCADE');
    table.string('transaction_type', 50).notNullable(); // import, export, adjustment, return
    table.string('reference_type', 50); // purchase_order, sales_order, adjustment
    table.integer('reference_id').unsigned(); // ID đơn hàng liên quan
    table.integer('quantity').notNullable(); // Dương = nhập, Âm = xuất
    table.integer('stock_before').defaultTo(0);
    table.integer('stock_after').defaultTo(0);
    table.decimal('unit_price', 18, 2).defaultTo(0);
    table.string('serial_numbers', 500);
    table.text('notes');
    table.integer('created_by').unsigned().references('id').inTable('users');
    table.timestamps(true, true);
  });

  // ============================================
  // 21. BẢNG AUDIT_LOGS - Log thao tác
  // ============================================
  await knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.string('user_name', 200);
    table.string('action', 50).notNullable(); // create, update, delete, login, logout, export, import
    table.string('entity_type', 100).notNullable(); // Bảng/đối tượng thao tác
    table.integer('entity_id').unsigned();
    table.text('old_values'); // JSON giá trị cũ
    table.text('new_values'); // JSON giá trị mới
    table.string('ip_address', 50);
    table.string('user_agent', 500);
    table.text('description');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ============================================
  // TẠO INDEXES để tối ưu truy vấn
  // ============================================
  await knex.schema.raw('CREATE INDEX idx_customers_group ON customers(group_id)');
  await knex.schema.raw('CREATE INDEX idx_customers_code ON customers(code)');
  await knex.schema.raw('CREATE INDEX idx_products_category ON products(category_id)');
  await knex.schema.raw('CREATE INDEX idx_products_code ON products(code)');
  await knex.schema.raw('CREATE INDEX idx_products_supplier ON products(supplier_id)');
  await knex.schema.raw('CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id)');
  await knex.schema.raw('CREATE INDEX idx_sales_orders_date ON sales_orders(order_date)');
  await knex.schema.raw('CREATE INDEX idx_sales_orders_status ON sales_orders(status)');
  await knex.schema.raw('CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id)');
  await knex.schema.raw('CREATE INDEX idx_invoices_customer ON invoices(customer_id)');
  await knex.schema.raw('CREATE INDEX idx_invoices_date ON invoices(invoice_date)');
  await knex.schema.raw('CREATE INDEX idx_payments_customer ON payments(customer_id)');
  await knex.schema.raw('CREATE INDEX idx_payments_date ON payments(payment_date)');
  await knex.schema.raw('CREATE INDEX idx_subscriptions_customer ON subscriptions(customer_id)');
  await knex.schema.raw('CREATE INDEX idx_subscriptions_status ON subscriptions(status)');
  await knex.schema.raw('CREATE INDEX idx_subscriptions_next_billing ON subscriptions(next_billing_date)');
  await knex.schema.raw('CREATE INDEX idx_inventory_product ON inventory_transactions(product_id)');
  await knex.schema.raw('CREATE INDEX idx_audit_logs_user ON audit_logs(user_id)');
  await knex.schema.raw('CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id)');
  await knex.schema.raw('CREATE INDEX idx_receivables_customer ON receivables(customer_id)');
  await knex.schema.raw('CREATE INDEX idx_payables_supplier ON payables(supplier_id)');
};

exports.down = async function (knex) {
  const tables = [
    'audit_logs',
    'inventory_transactions',
    'payables',
    'receivables',
    'payments',
    'invoice_items',
    'invoices',
    'subscription_billing',
    'subscriptions',
    'sales_order_items',
    'sales_orders',
    'purchase_order_items',
    'purchase_orders',
    'products',
    'product_categories',
    'service_plans',
    'suppliers',
    'customers',
    'customer_groups',
    'users',
    'roles',
  ];

  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
};
