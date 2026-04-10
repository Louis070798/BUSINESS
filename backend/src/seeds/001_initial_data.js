const bcrypt = require('bcryptjs');

exports.seed = async function (knex) {
  // Xóa dữ liệu cũ theo thứ tự
  await knex('audit_logs').del();
  await knex('inventory_transactions').del();
  await knex('payables').del();
  await knex('receivables').del();
  await knex('payments').del();
  await knex('invoice_items').del();
  await knex('invoices').del();
  await knex('subscription_billing').del();
  await knex('subscriptions').del();
  await knex('sales_order_items').del();
  await knex('sales_orders').del();
  await knex('purchase_order_items').del();
  await knex('purchase_orders').del();
  await knex('products').del();
  await knex('product_categories').del();
  await knex('service_plans').del();
  await knex('suppliers').del();
  await knex('customers').del();
  await knex('customer_groups').del();
  await knex('users').del();
  await knex('roles').del();

  // ============================================
  // 1. ROLES
  // ============================================
  await knex('roles').insert([
    {
      id: 1,
      code: 'admin',
      name: 'Quản trị viên',
      description: 'Toàn quyền quản trị hệ thống',
      permissions: JSON.stringify({
        users: ['view', 'create', 'edit', 'delete'],
        customers: ['view', 'create', 'edit', 'delete'],
        products: ['view', 'create', 'edit', 'delete'],
        service_plans: ['view', 'create', 'edit', 'delete'],
        sales: ['view', 'create', 'edit', 'delete', 'approve'],
        purchases: ['view', 'create', 'edit', 'delete', 'approve'],
        inventory: ['view', 'create', 'edit', 'delete'],
        invoices: ['view', 'create', 'edit', 'delete', 'export'],
        payments: ['view', 'create', 'edit', 'delete'],
        reports: ['view', 'export'],
        settings: ['view', 'edit'],
      }),
    },
    {
      id: 2,
      code: 'manager',
      name: 'Quản lý',
      description: 'Quản lý nghiệp vụ, duyệt giá, xem báo cáo',
      permissions: JSON.stringify({
        customers: ['view', 'create', 'edit'],
        products: ['view', 'create', 'edit'],
        service_plans: ['view', 'create', 'edit'],
        sales: ['view', 'create', 'edit', 'approve'],
        purchases: ['view', 'create', 'edit', 'approve'],
        inventory: ['view', 'create', 'edit'],
        invoices: ['view', 'create', 'edit', 'export'],
        payments: ['view', 'create', 'edit'],
        reports: ['view', 'export'],
      }),
    },
    {
      id: 3,
      code: 'accountant',
      name: 'Kế toán',
      description: 'Quản lý kế toán, công nợ, thanh toán',
      permissions: JSON.stringify({
        customers: ['view'],
        products: ['view'],
        service_plans: ['view'],
        sales: ['view'],
        purchases: ['view'],
        invoices: ['view', 'create', 'edit', 'export'],
        payments: ['view', 'create', 'edit'],
        reports: ['view', 'export'],
      }),
    },
    {
      id: 4,
      code: 'sales',
      name: 'Kinh doanh',
      description: 'Bán hàng, quản lý khách hàng',
      permissions: JSON.stringify({
        customers: ['view', 'create', 'edit'],
        products: ['view'],
        service_plans: ['view'],
        sales: ['view', 'create', 'edit'],
        invoices: ['view', 'create'],
        reports: ['view'],
      }),
    },
    {
      id: 5,
      code: 'warehouse',
      name: 'Kho',
      description: 'Quản lý kho hàng, nhập xuất',
      permissions: JSON.stringify({
        products: ['view', 'edit'],
        purchases: ['view', 'create'],
        inventory: ['view', 'create', 'edit'],
      }),
    },
  ]);

  // ============================================
  // 2. USERS
  // ============================================
  const passwordHash = await bcrypt.hash('Admin@123', 10);
  const accountantHash = await bcrypt.hash('Ketoan@123', 10);
  const salesHash = await bcrypt.hash('Kinhdoanh@123', 10);

  await knex('users').insert([
    { id: 1, username: 'admin', email: 'admin@company.com', password_hash: passwordHash, full_name: 'Quản trị viên', phone: '0901000001', role_id: 1 },
    { id: 2, username: 'manager', email: 'quanly@company.com', password_hash: passwordHash, full_name: 'Nguyễn Văn Quản Lý', phone: '0901000002', role_id: 2 },
    { id: 3, username: 'ketoan', email: 'ketoan@company.com', password_hash: accountantHash, full_name: 'Trần Thị Kế Toán', phone: '0901000003', role_id: 3 },
    { id: 4, username: 'kinhdoanh', email: 'kinhdoanh@company.com', password_hash: salesHash, full_name: 'Lê Văn Kinh Doanh', phone: '0901000004', role_id: 4 },
    { id: 5, username: 'kho', email: 'kho@company.com', password_hash: passwordHash, full_name: 'Phạm Văn Kho', phone: '0901000005', role_id: 5 },
  ]);

  // ============================================
  // 3. CUSTOMER_GROUPS
  // ============================================
  await knex('customer_groups').insert([
    { id: 1, code: 'agent_level1', name: 'Đại lý cấp 1', description: 'Đại lý phân phối cấp 1', discount_percent: 25, credit_limit: 500000000, payment_term_days: 30 },
    { id: 2, code: 'agent_level2', name: 'Đại lý cấp 2', description: 'Đại lý phân phối cấp 2', discount_percent: 15, credit_limit: 200000000, payment_term_days: 15 },
    { id: 3, code: 'retail', name: 'Khách lẻ', description: 'Khách hàng mua lẻ', discount_percent: 0, credit_limit: 0, payment_term_days: 0 },
  ]);

  // ============================================
  // 4. SUPPLIERS
  // ============================================
  await knex('suppliers').insert([
    { id: 1, code: 'NCC001', name: 'Công ty TNHH Thiết bị Số Việt', contact_person: 'Nguyễn Minh', phone: '0281234567', email: 'contact@soviiet.vn', address: '123 Nguyễn Văn Linh, Q.7, TP.HCM', tax_code: '0312345678' },
    { id: 2, code: 'NCC002', name: 'Công ty CP Công nghệ FPT', contact_person: 'Trần Đức', phone: '0289876543', email: 'sales@fpt.vn', address: '456 Trần Hưng Đạo, Q.1, TP.HCM', tax_code: '0313456789' },
  ]);

  // ============================================
  // 5. PRODUCT_CATEGORIES
  // ============================================
  await knex('product_categories').insert([
    { id: 1, code: 'CAT001', name: 'Bộ phát WiFi', description: 'Các loại router, access point' },
    { id: 2, code: 'CAT002', name: 'Camera IP', description: 'Camera giám sát IP' },
    { id: 3, code: 'CAT003', name: 'Đầu thu', description: 'Đầu thu truyền hình' },
    { id: 4, code: 'CAT004', name: 'Phụ kiện', description: 'Dây cáp, nguồn, adapter' },
  ]);

  // ============================================
  // 6. PRODUCTS
  // ============================================
  await knex('products').insert([
    { id: 1, code: 'TB001', name: 'Router WiFi 6 AX1500', category_id: 1, unit: 'Cái', cost_price: 850000, retail_price: 1200000, agent_level1_price: 950000, agent_level2_price: 1050000, stock_quantity: 150, min_stock_level: 20, supplier_id: 1, status: 'active' },
    { id: 2, code: 'TB002', name: 'Router WiFi Mesh 3 Pack', category_id: 1, unit: 'Bộ', cost_price: 2500000, retail_price: 3500000, agent_level1_price: 2800000, agent_level2_price: 3100000, stock_quantity: 80, min_stock_level: 10, supplier_id: 1, status: 'active' },
    { id: 3, code: 'TB003', name: 'Camera IP 2MP Ngoài Trời', category_id: 2, unit: 'Cái', cost_price: 650000, retail_price: 990000, agent_level1_price: 750000, agent_level2_price: 850000, stock_quantity: 200, min_stock_level: 30, supplier_id: 2, status: 'active' },
    { id: 4, code: 'TB004', name: 'Camera IP 4MP PTZ', category_id: 2, unit: 'Cái', cost_price: 1800000, retail_price: 2500000, agent_level1_price: 2000000, agent_level2_price: 2200000, stock_quantity: 50, min_stock_level: 10, supplier_id: 2, status: 'active' },
    { id: 5, code: 'TB005', name: 'Đầu thu 4K Android', category_id: 3, unit: 'Cái', cost_price: 1200000, retail_price: 1800000, agent_level1_price: 1400000, agent_level2_price: 1600000, stock_quantity: 100, min_stock_level: 15, supplier_id: 1, status: 'active' },
  ]);

  // ============================================
  // 7. SERVICE_PLANS
  // ============================================
  await knex('service_plans').insert([
    { id: 1, code: 'GC001', name: 'Gói Internet 100Mbps', plan_type: 'internet', cost_price: 120000, retail_price: 200000, agent_level1_price: 150000, agent_level2_price: 170000, billing_cycle: 'monthly', duration_months: 12, status: 'active' },
    { id: 2, code: 'GC002', name: 'Gói Internet 200Mbps', plan_type: 'internet', cost_price: 200000, retail_price: 300000, agent_level1_price: 230000, agent_level2_price: 260000, billing_cycle: 'monthly', duration_months: 12, status: 'active' },
    { id: 3, code: 'GC003', name: 'Gói Truyền hình HD 100 kênh', plan_type: 'tv', cost_price: 80000, retail_price: 150000, agent_level1_price: 100000, agent_level2_price: 120000, billing_cycle: 'monthly', duration_months: 12, status: 'active' },
    { id: 4, code: 'GC004', name: 'Gói Combo Internet + TV', plan_type: 'combo', cost_price: 180000, retail_price: 300000, agent_level1_price: 220000, agent_level2_price: 250000, billing_cycle: 'monthly', duration_months: 12, status: 'active' },
    { id: 5, code: 'GC005', name: 'Gói Camera Cloud 30 ngày', plan_type: 'cloud', cost_price: 50000, retail_price: 99000, agent_level1_price: 65000, agent_level2_price: 80000, billing_cycle: 'monthly', duration_months: 1, status: 'active' },
  ]);

  // ============================================
  // 8. CUSTOMERS
  // ============================================
  await knex('customers').insert([
    { id: 1, code: 'KH001', company_name: 'Công ty TNHH Viễn Thông ABC', customer_name: 'Đại lý Viễn Thông ABC', contact_person: 'Nguyễn Văn A', phone: '0901111111', email: 'abc@vienthong.vn', address: '789 Lê Lợi, Q.1, TP.HCM', tax_code: '0315678901', group_id: 1, credit_limit: 500000000, payment_term_days: 30, created_by: 1 },
    { id: 2, code: 'KH002', company_name: 'Cửa hàng Kỹ thuật số XYZ', customer_name: 'Đại lý XYZ', contact_person: 'Trần Văn B', phone: '0902222222', email: 'xyz@kts.vn', address: '456 Hai Bà Trưng, Q.3, TP.HCM', tax_code: '0316789012', group_id: 2, credit_limit: 200000000, payment_term_days: 15, created_by: 1 },
    { id: 3, code: 'KH003', customer_name: 'Lê Thị C', contact_person: 'Lê Thị C', phone: '0903333333', email: 'lethic@gmail.com', address: '123 Nguyễn Huệ, Q.1, TP.HCM', group_id: 3, credit_limit: 0, payment_term_days: 0, created_by: 4 },
    { id: 4, code: 'KH004', company_name: 'Công ty CP Phân phối DEF', customer_name: 'Đại lý DEF', contact_person: 'Phạm Văn D', phone: '0904444444', email: 'def@phanphoi.vn', address: '321 Điện Biên Phủ, Q.Bình Thạnh, TP.HCM', tax_code: '0317890123', group_id: 1, credit_limit: 300000000, payment_term_days: 30, created_by: 1 },
    { id: 5, code: 'KH005', customer_name: 'Hoàng Văn E', contact_person: 'Hoàng Văn E', phone: '0905555555', email: 'hoange@gmail.com', address: '567 Võ Văn Tần, Q.3, TP.HCM', group_id: 3, credit_limit: 0, payment_term_days: 0, created_by: 4 },
  ]);

  // ============================================
  // 9. PURCHASE_ORDERS - Đơn nhập hàng
  // ============================================
  await knex('purchase_orders').insert([
    { id: 1, order_number: 'PO-2026-0001', supplier_id: 1, order_date: '2026-03-01', delivery_date: '2026-03-05', total_amount: 127500000, discount_amount: 0, tax_amount: 12750000, grand_total: 140250000, status: 'received', payment_status: 'paid', paid_amount: 140250000, notes: 'Nhập lô hàng Router WiFi tháng 3', created_by: 5, approved_by: 2 },
    { id: 2, order_number: 'PO-2026-0002', supplier_id: 2, order_date: '2026-03-10', delivery_date: '2026-03-15', total_amount: 78000000, discount_amount: 0, tax_amount: 7800000, grand_total: 85800000, status: 'received', payment_status: 'partial', paid_amount: 50000000, notes: 'Nhập Camera IP đợt 1', created_by: 5, approved_by: 2 },
    { id: 3, order_number: 'PO-2026-0003', supplier_id: 1, order_date: '2026-04-01', delivery_date: '2026-04-05', total_amount: 60000000, discount_amount: 2000000, tax_amount: 5800000, grand_total: 63800000, status: 'confirmed', payment_status: 'unpaid', paid_amount: 0, notes: 'Nhập đầu thu 4K tháng 4', created_by: 5, approved_by: 2 },
  ]);

  await knex('purchase_order_items').insert([
    { id: 1, purchase_order_id: 1, product_id: 1, quantity: 100, unit_price: 850000, tax_percent: 10, tax_amount: 8500000, total_amount: 93500000 },
    { id: 2, purchase_order_id: 1, product_id: 2, quantity: 20, unit_price: 2500000, tax_percent: 10, tax_amount: 5000000, total_amount: 55000000, serial_numbers: 'MESH-001~MESH-020' },
    { id: 3, purchase_order_id: 2, product_id: 3, quantity: 80, unit_price: 650000, tax_percent: 10, tax_amount: 5200000, total_amount: 57200000 },
    { id: 4, purchase_order_id: 2, product_id: 4, quantity: 20, unit_price: 1800000, tax_percent: 10, tax_amount: 3600000, total_amount: 39600000 },
    { id: 5, purchase_order_id: 3, product_id: 5, quantity: 50, unit_price: 1200000, tax_percent: 10, tax_amount: 5800000, total_amount: 63800000 },
  ]);

  // ============================================
  // 10. SALES_ORDERS - Đơn bán hàng
  // ============================================
  await knex('sales_orders').insert([
    { id: 1, order_number: 'SO-2026-0001', customer_id: 1, customer_group_code: 'agent_level1', order_date: '2026-03-10', delivery_date: '2026-03-12', subtotal: 19000000, discount_percent: 0, discount_amount: 0, tax_amount: 1900000, grand_total: 20900000, cost_total: 17000000, profit: 2000000, status: 'delivered', payment_status: 'paid', paid_amount: 20900000, payment_method: 'transfer', created_by: 4, approved_by: 2 },
    { id: 2, order_number: 'SO-2026-0002', customer_id: 2, customer_group_code: 'agent_level2', order_date: '2026-03-15', delivery_date: '2026-03-16', subtotal: 12600000, discount_percent: 0, discount_amount: 0, tax_amount: 1260000, grand_total: 13860000, cost_total: 10400000, profit: 2200000, status: 'delivered', payment_status: 'partial', paid_amount: 10000000, payment_method: 'debt', created_by: 4, approved_by: 2 },
    { id: 3, order_number: 'SO-2026-0003', customer_id: 3, customer_group_code: 'retail', order_date: '2026-03-20', subtotal: 4290000, discount_percent: 0, discount_amount: 0, tax_amount: 429000, grand_total: 4719000, cost_total: 3300000, profit: 990000, status: 'delivered', payment_status: 'paid', paid_amount: 4719000, payment_method: 'cash', created_by: 4 },
    { id: 4, order_number: 'SO-2026-0004', customer_id: 4, customer_group_code: 'agent_level1', order_date: '2026-03-25', delivery_date: '2026-03-28', subtotal: 42000000, discount_percent: 2, discount_amount: 840000, tax_amount: 4116000, grand_total: 45276000, cost_total: 35500000, profit: 5660000, status: 'delivered', payment_status: 'partial', paid_amount: 30000000, payment_method: 'debt', created_by: 4, approved_by: 2 },
    { id: 5, order_number: 'SO-2026-0005', customer_id: 1, customer_group_code: 'agent_level1', order_date: '2026-04-01', subtotal: 28000000, discount_percent: 0, discount_amount: 0, tax_amount: 2800000, grand_total: 30800000, cost_total: 22500000, profit: 5500000, status: 'confirmed', payment_status: 'unpaid', paid_amount: 0, payment_method: 'debt', created_by: 4, approved_by: 2 },
    { id: 6, order_number: 'SO-2026-0006', customer_id: 5, customer_group_code: 'retail', order_date: '2026-04-05', subtotal: 2490000, discount_percent: 0, discount_amount: 0, tax_amount: 249000, grand_total: 2739000, cost_total: 1800000, profit: 690000, status: 'draft', payment_status: 'unpaid', paid_amount: 0, payment_method: 'cash', created_by: 4 },
  ]);

  await knex('sales_order_items').insert([
    // SO-2026-0001: Đại lý ABC mua 10 Router + 2 Mesh
    { id: 1, sales_order_id: 1, item_type: 'product', product_id: 1, quantity: 10, unit_price: 950000, cost_price: 850000, tax_percent: 10, tax_amount: 950000, total_amount: 10450000, profit: 1000000 },
    { id: 2, sales_order_id: 1, item_type: 'product', product_id: 2, quantity: 2, unit_price: 2800000, cost_price: 2500000, tax_percent: 10, tax_amount: 560000, total_amount: 6160000, profit: 600000 },
    { id: 3, sales_order_id: 1, item_type: 'service_plan', service_plan_id: 1, quantity: 10, unit_price: 150000, cost_price: 120000, tax_percent: 10, tax_amount: 150000, total_amount: 1650000, profit: 300000 },
    // SO-2026-0002: Đại lý XYZ mua 5 Camera 2MP + 2 Camera 4MP
    { id: 4, sales_order_id: 2, item_type: 'product', product_id: 3, quantity: 5, unit_price: 850000, cost_price: 650000, tax_percent: 10, tax_amount: 425000, total_amount: 4675000, profit: 1000000 },
    { id: 5, sales_order_id: 2, item_type: 'product', product_id: 4, quantity: 2, unit_price: 2200000, cost_price: 1800000, tax_percent: 10, tax_amount: 440000, total_amount: 4840000, profit: 800000 },
    { id: 6, sales_order_id: 2, item_type: 'service_plan', service_plan_id: 5, quantity: 5, unit_price: 80000, cost_price: 50000, tax_percent: 10, tax_amount: 40000, total_amount: 440000, profit: 150000 },
    // SO-2026-0003: Lê Thị C mua lẻ 1 Router + 1 Camera + gói combo
    { id: 7, sales_order_id: 3, item_type: 'product', product_id: 1, quantity: 1, unit_price: 1200000, cost_price: 850000, tax_percent: 10, tax_amount: 120000, total_amount: 1320000, profit: 350000 },
    { id: 8, sales_order_id: 3, item_type: 'product', product_id: 3, quantity: 1, unit_price: 990000, cost_price: 650000, tax_percent: 10, tax_amount: 99000, total_amount: 1089000, profit: 340000 },
    { id: 9, sales_order_id: 3, item_type: 'service_plan', service_plan_id: 4, quantity: 1, unit_price: 300000, cost_price: 180000, tax_percent: 10, tax_amount: 30000, total_amount: 330000, profit: 120000 },
    // SO-2026-0004: Đại lý DEF mua 20 Router + 10 Mesh
    { id: 10, sales_order_id: 4, item_type: 'product', product_id: 1, quantity: 20, unit_price: 950000, cost_price: 850000, tax_percent: 10, tax_amount: 1900000, total_amount: 20900000, profit: 2000000 },
    { id: 11, sales_order_id: 4, item_type: 'product', product_id: 2, quantity: 10, unit_price: 2800000, cost_price: 2500000, tax_percent: 10, tax_amount: 2800000, total_amount: 30800000, profit: 3000000 },
    // SO-2026-0005: Đại lý ABC mua 10 Mesh
    { id: 12, sales_order_id: 5, item_type: 'product', product_id: 2, quantity: 10, unit_price: 2800000, cost_price: 2500000, tax_percent: 10, tax_amount: 2800000, total_amount: 30800000, profit: 3000000 },
    // SO-2026-0006: Hoàng Văn E mua 1 Camera 4MP
    { id: 13, sales_order_id: 6, item_type: 'product', product_id: 4, quantity: 1, unit_price: 2490000, cost_price: 1800000, tax_percent: 10, tax_amount: 249000, total_amount: 2739000, profit: 690000 },
  ]);

  // ============================================
  // 11. SUBSCRIPTIONS - Đăng ký gói cước
  // ============================================
  await knex('subscriptions').insert([
    { id: 1, subscription_number: 'SUB-2026-0001', customer_id: 1, service_plan_id: 1, product_id: 1, device_serial: 'RTW6-0001', start_date: '2026-03-10', end_date: '2027-03-10', next_billing_date: '2026-05-10', monthly_amount: 150000, billing_cycle: 'monthly', status: 'active', auto_renew: true, sales_order_id: 1, created_by: 4 },
    { id: 2, subscription_number: 'SUB-2026-0002', customer_id: 1, service_plan_id: 1, product_id: 1, device_serial: 'RTW6-0002', start_date: '2026-03-10', end_date: '2027-03-10', next_billing_date: '2026-05-10', monthly_amount: 150000, billing_cycle: 'monthly', status: 'active', auto_renew: true, sales_order_id: 1, created_by: 4 },
    { id: 3, subscription_number: 'SUB-2026-0003', customer_id: 2, service_plan_id: 5, product_id: 3, device_serial: 'CAM2-0001', start_date: '2026-03-15', end_date: '2026-04-15', next_billing_date: '2026-04-15', monthly_amount: 80000, billing_cycle: 'monthly', status: 'active', auto_renew: true, sales_order_id: 2, created_by: 4 },
    { id: 4, subscription_number: 'SUB-2026-0004', customer_id: 3, service_plan_id: 4, product_id: 1, device_serial: 'RTW6-0011', start_date: '2026-03-20', end_date: '2027-03-20', next_billing_date: '2026-05-20', monthly_amount: 300000, billing_cycle: 'monthly', status: 'active', auto_renew: true, sales_order_id: 3, created_by: 4 },
    { id: 5, subscription_number: 'SUB-2026-0005', customer_id: 4, service_plan_id: 2, start_date: '2026-01-01', end_date: '2027-01-01', next_billing_date: '2026-05-01', monthly_amount: 230000, billing_cycle: 'monthly', status: 'active', auto_renew: true, created_by: 1 },
    { id: 6, subscription_number: 'SUB-2026-0006', customer_id: 5, service_plan_id: 3, start_date: '2026-02-01', end_date: '2027-02-01', next_billing_date: '2026-05-01', monthly_amount: 150000, billing_cycle: 'monthly', status: 'suspended', auto_renew: false, notes: 'Tạm ngưng do khách yêu cầu', created_by: 1 },
  ]);

  // ============================================
  // 12. SUBSCRIPTION_BILLING - Lịch sử billing
  // ============================================
  await knex('subscription_billing').insert([
    { id: 1, subscription_id: 1, billing_date: '2026-03-10', period_start: '2026-03-10', period_end: '2026-04-10', amount: 150000, tax_amount: 15000, total_amount: 165000, status: 'paid', paid_date: '2026-03-10' },
    { id: 2, subscription_id: 1, billing_date: '2026-04-10', period_start: '2026-04-10', period_end: '2026-05-10', amount: 150000, tax_amount: 15000, total_amount: 165000, status: 'paid', paid_date: '2026-04-10' },
    { id: 3, subscription_id: 2, billing_date: '2026-03-10', period_start: '2026-03-10', period_end: '2026-04-10', amount: 150000, tax_amount: 15000, total_amount: 165000, status: 'paid', paid_date: '2026-03-10' },
    { id: 4, subscription_id: 2, billing_date: '2026-04-10', period_start: '2026-04-10', period_end: '2026-05-10', amount: 150000, tax_amount: 15000, total_amount: 165000, status: 'pending' },
    { id: 5, subscription_id: 3, billing_date: '2026-03-15', period_start: '2026-03-15', period_end: '2026-04-15', amount: 80000, tax_amount: 8000, total_amount: 88000, status: 'paid', paid_date: '2026-03-15' },
    { id: 6, subscription_id: 4, billing_date: '2026-03-20', period_start: '2026-03-20', period_end: '2026-04-20', amount: 300000, tax_amount: 30000, total_amount: 330000, status: 'paid', paid_date: '2026-03-20' },
    { id: 7, subscription_id: 4, billing_date: '2026-04-20', period_start: '2026-04-20', period_end: '2026-05-20', amount: 300000, tax_amount: 30000, total_amount: 330000, status: 'pending' },
    { id: 8, subscription_id: 5, billing_date: '2026-03-01', period_start: '2026-03-01', period_end: '2026-04-01', amount: 230000, tax_amount: 23000, total_amount: 253000, status: 'paid', paid_date: '2026-03-05' },
    { id: 9, subscription_id: 5, billing_date: '2026-04-01', period_start: '2026-04-01', period_end: '2026-05-01', amount: 230000, tax_amount: 23000, total_amount: 253000, status: 'paid', paid_date: '2026-04-03' },
  ]);

  // ============================================
  // 13. INVOICES - Hóa đơn
  // ============================================
  await knex('invoices').insert([
    { id: 1, invoice_number: 'INV-2026-0001', invoice_type: 'sales', customer_id: 1, sales_order_id: 1, invoice_date: '2026-03-10', due_date: '2026-04-10', subtotal: 19000000, discount_amount: 0, tax_amount: 1900000, grand_total: 20900000, status: 'paid', payment_status: 'paid', paid_amount: 20900000, created_by: 3 },
    { id: 2, invoice_number: 'INV-2026-0002', invoice_type: 'sales', customer_id: 2, sales_order_id: 2, invoice_date: '2026-03-15', due_date: '2026-03-30', subtotal: 12600000, discount_amount: 0, tax_amount: 1260000, grand_total: 13860000, status: 'issued', payment_status: 'partial', paid_amount: 10000000, created_by: 3 },
    { id: 3, invoice_number: 'INV-2026-0003', invoice_type: 'sales', customer_id: 3, sales_order_id: 3, invoice_date: '2026-03-20', subtotal: 4290000, discount_amount: 0, tax_amount: 429000, grand_total: 4719000, status: 'paid', payment_status: 'paid', paid_amount: 4719000, created_by: 3 },
    { id: 4, invoice_number: 'INV-2026-0004', invoice_type: 'sales', customer_id: 4, sales_order_id: 4, invoice_date: '2026-03-25', due_date: '2026-04-25', subtotal: 42000000, discount_amount: 840000, tax_amount: 4116000, grand_total: 45276000, status: 'issued', payment_status: 'partial', paid_amount: 30000000, created_by: 3 },
    { id: 5, invoice_number: 'INV-2026-0005', invoice_type: 'sales', customer_id: 1, sales_order_id: 5, invoice_date: '2026-04-01', due_date: '2026-05-01', subtotal: 28000000, discount_amount: 0, tax_amount: 2800000, grand_total: 30800000, status: 'issued', payment_status: 'unpaid', paid_amount: 0, created_by: 3 },
  ]);

  await knex('invoice_items').insert([
    { id: 1, invoice_id: 1, item_type: 'product', product_id: 1, description: 'Router WiFi 6 AX1500', unit: 'Cái', quantity: 10, unit_price: 950000, tax_percent: 10, tax_amount: 950000, total_amount: 10450000 },
    { id: 2, invoice_id: 1, item_type: 'product', product_id: 2, description: 'Router WiFi Mesh 3 Pack', unit: 'Bộ', quantity: 2, unit_price: 2800000, tax_percent: 10, tax_amount: 560000, total_amount: 6160000 },
    { id: 3, invoice_id: 1, item_type: 'service_plan', service_plan_id: 1, description: 'Gói Internet 100Mbps (12 tháng)', unit: 'Gói', quantity: 10, unit_price: 150000, tax_percent: 10, tax_amount: 150000, total_amount: 1650000 },
    { id: 4, invoice_id: 2, item_type: 'product', product_id: 3, description: 'Camera IP 2MP Ngoài Trời', unit: 'Cái', quantity: 5, unit_price: 850000, tax_percent: 10, tax_amount: 425000, total_amount: 4675000 },
    { id: 5, invoice_id: 2, item_type: 'product', product_id: 4, description: 'Camera IP 4MP PTZ', unit: 'Cái', quantity: 2, unit_price: 2200000, tax_percent: 10, tax_amount: 440000, total_amount: 4840000 },
    { id: 6, invoice_id: 2, item_type: 'service_plan', service_plan_id: 5, description: 'Gói Camera Cloud 30 ngày', unit: 'Gói', quantity: 5, unit_price: 80000, tax_percent: 10, tax_amount: 40000, total_amount: 440000 },
    { id: 7, invoice_id: 3, item_type: 'product', product_id: 1, description: 'Router WiFi 6 AX1500', unit: 'Cái', quantity: 1, unit_price: 1200000, tax_percent: 10, tax_amount: 120000, total_amount: 1320000 },
    { id: 8, invoice_id: 3, item_type: 'product', product_id: 3, description: 'Camera IP 2MP Ngoài Trời', unit: 'Cái', quantity: 1, unit_price: 990000, tax_percent: 10, tax_amount: 99000, total_amount: 1089000 },
    { id: 9, invoice_id: 3, item_type: 'service_plan', service_plan_id: 4, description: 'Gói Combo Internet + TV', unit: 'Gói', quantity: 1, unit_price: 300000, tax_percent: 10, tax_amount: 30000, total_amount: 330000 },
    { id: 10, invoice_id: 4, item_type: 'product', product_id: 1, description: 'Router WiFi 6 AX1500', unit: 'Cái', quantity: 20, unit_price: 950000, tax_percent: 10, tax_amount: 1900000, total_amount: 20900000 },
    { id: 11, invoice_id: 4, item_type: 'product', product_id: 2, description: 'Router WiFi Mesh 3 Pack', unit: 'Bộ', quantity: 10, unit_price: 2800000, tax_percent: 10, tax_amount: 2800000, total_amount: 30800000 },
    { id: 12, invoice_id: 5, item_type: 'product', product_id: 2, description: 'Router WiFi Mesh 3 Pack', unit: 'Bộ', quantity: 10, unit_price: 2800000, tax_percent: 10, tax_amount: 2800000, total_amount: 30800000 },
  ]);

  // ============================================
  // 14. PAYMENTS - Thanh toán
  // ============================================
  await knex('payments').insert([
    // Thu tiền từ khách hàng
    { id: 1, payment_number: 'PT-2026-0001', payment_type: 'receivable', customer_id: 1, invoice_id: 1, sales_order_id: 1, payment_date: '2026-03-10', amount: 20900000, payment_method: 'transfer', reference_number: 'CK-100310-01', bank_name: 'Vietcombank', status: 'completed', notes: 'Đại lý ABC thanh toán đơn SO-2026-0001', created_by: 3 },
    { id: 2, payment_number: 'PT-2026-0002', payment_type: 'receivable', customer_id: 2, invoice_id: 2, sales_order_id: 2, payment_date: '2026-03-18', amount: 10000000, payment_method: 'transfer', reference_number: 'CK-100318-01', bank_name: 'Techcombank', status: 'completed', notes: 'Đại lý XYZ thanh toán 1 phần đơn SO-2026-0002', created_by: 3 },
    { id: 3, payment_number: 'PT-2026-0003', payment_type: 'receivable', customer_id: 3, invoice_id: 3, sales_order_id: 3, payment_date: '2026-03-20', amount: 4719000, payment_method: 'cash', status: 'completed', notes: 'Lê Thị C thanh toán tiền mặt', created_by: 4 },
    { id: 4, payment_number: 'PT-2026-0004', payment_type: 'receivable', customer_id: 4, invoice_id: 4, sales_order_id: 4, payment_date: '2026-03-28', amount: 30000000, payment_method: 'transfer', reference_number: 'CK-100328-01', bank_name: 'BIDV', status: 'completed', notes: 'Đại lý DEF thanh toán đợt 1', created_by: 3 },
    // Chi tiền cho nhà cung cấp
    { id: 5, payment_number: 'PC-2026-0001', payment_type: 'payable', supplier_id: 1, purchase_order_id: 1, payment_date: '2026-03-05', amount: 140250000, payment_method: 'transfer', reference_number: 'CK-050301-01', bank_name: 'Vietcombank', status: 'completed', notes: 'Thanh toán PO-2026-0001 cho Thiết bị Số Việt', created_by: 3 },
    { id: 6, payment_number: 'PC-2026-0002', payment_type: 'payable', supplier_id: 2, purchase_order_id: 2, payment_date: '2026-03-20', amount: 50000000, payment_method: 'transfer', reference_number: 'CK-050320-01', bank_name: 'Vietcombank', status: 'completed', notes: 'Thanh toán 1 phần PO-2026-0002 cho FPT', created_by: 3 },
  ]);

  // ============================================
  // 15. RECEIVABLES - Công nợ phải thu
  // ============================================
  await knex('receivables').insert([
    { id: 1, customer_id: 1, invoice_id: 1, sales_order_id: 1, original_amount: 20900000, paid_amount: 20900000, remaining_amount: 0, due_date: '2026-04-10', status: 'paid' },
    { id: 2, customer_id: 2, invoice_id: 2, sales_order_id: 2, original_amount: 13860000, paid_amount: 10000000, remaining_amount: 3860000, due_date: '2026-03-30', status: 'overdue', notes: 'Quá hạn - cần nhắc nhở' },
    { id: 3, customer_id: 3, invoice_id: 3, sales_order_id: 3, original_amount: 4719000, paid_amount: 4719000, remaining_amount: 0, status: 'paid' },
    { id: 4, customer_id: 4, invoice_id: 4, sales_order_id: 4, original_amount: 45276000, paid_amount: 30000000, remaining_amount: 15276000, due_date: '2026-04-25', status: 'partial' },
    { id: 5, customer_id: 1, invoice_id: 5, sales_order_id: 5, original_amount: 30800000, paid_amount: 0, remaining_amount: 30800000, due_date: '2026-05-01', status: 'outstanding' },
  ]);

  // ============================================
  // 16. PAYABLES - Công nợ phải trả
  // ============================================
  await knex('payables').insert([
    { id: 1, supplier_id: 1, purchase_order_id: 1, original_amount: 140250000, paid_amount: 140250000, remaining_amount: 0, due_date: '2026-03-31', status: 'paid' },
    { id: 2, supplier_id: 2, purchase_order_id: 2, original_amount: 85800000, paid_amount: 50000000, remaining_amount: 35800000, due_date: '2026-04-10', status: 'overdue', notes: 'Còn nợ 35.8 triệu' },
    { id: 3, supplier_id: 1, purchase_order_id: 3, original_amount: 63800000, paid_amount: 0, remaining_amount: 63800000, due_date: '2026-05-01', status: 'outstanding' },
  ]);

  // ============================================
  // 17. INVENTORY_TRANSACTIONS - Lịch sử kho
  // ============================================
  await knex('inventory_transactions').insert([
    // Nhập kho từ PO-2026-0001
    { id: 1, product_id: 1, transaction_type: 'import', reference_type: 'purchase_order', reference_id: 1, quantity: 100, stock_before: 50, stock_after: 150, unit_price: 850000, notes: 'Nhập kho từ PO-2026-0001', created_by: 5 },
    { id: 2, product_id: 2, transaction_type: 'import', reference_type: 'purchase_order', reference_id: 1, quantity: 20, stock_before: 60, stock_after: 80, unit_price: 2500000, serial_numbers: 'MESH-001~MESH-020', notes: 'Nhập kho từ PO-2026-0001', created_by: 5 },
    // Nhập kho từ PO-2026-0002
    { id: 3, product_id: 3, transaction_type: 'import', reference_type: 'purchase_order', reference_id: 2, quantity: 80, stock_before: 120, stock_after: 200, unit_price: 650000, notes: 'Nhập kho từ PO-2026-0002', created_by: 5 },
    { id: 4, product_id: 4, transaction_type: 'import', reference_type: 'purchase_order', reference_id: 2, quantity: 20, stock_before: 30, stock_after: 50, unit_price: 1800000, notes: 'Nhập kho từ PO-2026-0002', created_by: 5 },
    // Xuất kho cho SO-2026-0001
    { id: 5, product_id: 1, transaction_type: 'export', reference_type: 'sales_order', reference_id: 1, quantity: -10, stock_before: 150, stock_after: 140, unit_price: 950000, notes: 'Xuất kho cho SO-2026-0001', created_by: 5 },
    { id: 6, product_id: 2, transaction_type: 'export', reference_type: 'sales_order', reference_id: 1, quantity: -2, stock_before: 80, stock_after: 78, unit_price: 2800000, notes: 'Xuất kho cho SO-2026-0001', created_by: 5 },
    // Xuất kho cho SO-2026-0002
    { id: 7, product_id: 3, transaction_type: 'export', reference_type: 'sales_order', reference_id: 2, quantity: -5, stock_before: 200, stock_after: 195, unit_price: 850000, notes: 'Xuất kho cho SO-2026-0002', created_by: 5 },
    { id: 8, product_id: 4, transaction_type: 'export', reference_type: 'sales_order', reference_id: 2, quantity: -2, stock_before: 50, stock_after: 48, unit_price: 2200000, notes: 'Xuất kho cho SO-2026-0002', created_by: 5 },
    // Xuất kho cho SO-2026-0003
    { id: 9, product_id: 1, transaction_type: 'export', reference_type: 'sales_order', reference_id: 3, quantity: -1, stock_before: 140, stock_after: 139, unit_price: 1200000, notes: 'Xuất kho cho SO-2026-0003', created_by: 5 },
    { id: 10, product_id: 3, transaction_type: 'export', reference_type: 'sales_order', reference_id: 3, quantity: -1, stock_before: 195, stock_after: 194, unit_price: 990000, notes: 'Xuất kho cho SO-2026-0003', created_by: 5 },
    // Xuất kho cho SO-2026-0004
    { id: 11, product_id: 1, transaction_type: 'export', reference_type: 'sales_order', reference_id: 4, quantity: -20, stock_before: 139, stock_after: 119, unit_price: 950000, notes: 'Xuất kho cho SO-2026-0004', created_by: 5 },
    { id: 12, product_id: 2, transaction_type: 'export', reference_type: 'sales_order', reference_id: 4, quantity: -10, stock_before: 78, stock_after: 68, unit_price: 2800000, notes: 'Xuất kho cho SO-2026-0004', created_by: 5 },
  ]);

  // Cập nhật công nợ khách hàng
  await knex('customers').where('id', 2).update({ current_debt: 3860000 });
  await knex('customers').where('id', 4).update({ current_debt: 15276000 });
  await knex('customers').where('id', 1).update({ current_debt: 30800000 });

  // Cập nhật công nợ nhà cung cấp
  await knex('suppliers').where('id', 2).update({ current_debt: 35800000 });

  // Cập nhật tồn kho sau giao dịch
  await knex('products').where('id', 1).update({ stock_quantity: 119 });
  await knex('products').where('id', 2).update({ stock_quantity: 68 });
  await knex('products').where('id', 3).update({ stock_quantity: 194 });
  await knex('products').where('id', 4).update({ stock_quantity: 48 });

  // Reset sequences
  await knex.raw("SELECT setval('roles_id_seq', 5)");
  await knex.raw("SELECT setval('users_id_seq', 5)");
  await knex.raw("SELECT setval('customer_groups_id_seq', 3)");
  await knex.raw("SELECT setval('suppliers_id_seq', 2)");
  await knex.raw("SELECT setval('product_categories_id_seq', 4)");
  await knex.raw("SELECT setval('products_id_seq', 5)");
  await knex.raw("SELECT setval('service_plans_id_seq', 5)");
  await knex.raw("SELECT setval('customers_id_seq', 5)");
  await knex.raw("SELECT setval('purchase_orders_id_seq', 3)");
  await knex.raw("SELECT setval('purchase_order_items_id_seq', 5)");
  await knex.raw("SELECT setval('sales_orders_id_seq', 6)");
  await knex.raw("SELECT setval('sales_order_items_id_seq', 13)");
  await knex.raw("SELECT setval('subscriptions_id_seq', 6)");
  await knex.raw("SELECT setval('subscription_billing_id_seq', 9)");
  await knex.raw("SELECT setval('invoices_id_seq', 5)");
  await knex.raw("SELECT setval('invoice_items_id_seq', 12)");
  await knex.raw("SELECT setval('payments_id_seq', 6)");
  await knex.raw("SELECT setval('receivables_id_seq', 5)");
  await knex.raw("SELECT setval('payables_id_seq', 3)");
  await knex.raw("SELECT setval('inventory_transactions_id_seq', 12)");
};
