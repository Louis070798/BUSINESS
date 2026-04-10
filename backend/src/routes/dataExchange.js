const express = require('express');
const multer = require('multer');
const db = require('../config/database');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const { generateInvoicePDF, generateQuotationPDF } = require('../utils/pdfGenerator');
const {
  exportToExcel, exportToCSV, importFromExcel, importFromCSV,
  PRODUCT_COLUMNS, SERVICE_PLAN_COLUMNS, CUSTOMER_COLUMNS, IMPORT_COLUMN_MAPPING,
} = require('../utils/excelHelper');
const { backupDatabase, restoreDatabase, listBackups } = require('../utils/backup');

const router = express.Router();
router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// ============================================
// EXPORT THIẾT BỊ
// ============================================
router.get('/export/products', authorize('products', 'view'), async (req, res) => {
  try {
    const { format = 'excel' } = req.query;

    const data = await db('products')
      .leftJoin('product_categories', 'products.category_id', 'product_categories.id')
      .where('products.is_active', true)
      .select('products.*', 'product_categories.name as category_name');

    if (format === 'csv') {
      await exportToCSV(data, PRODUCT_COLUMNS, res, 'danh_sach_thiet_bi');
    } else {
      await exportToExcel(data, PRODUCT_COLUMNS, 'Thiết bị', res, 'danh_sach_thiet_bi');
    }
  } catch (error) {
    console.error('Export products error:', error);
    res.status(500).json({ error: 'Lỗi xuất dữ liệu thiết bị' });
  }
});

// ============================================
// EXPORT GÓI CƯỚC
// ============================================
router.get('/export/service-plans', authorize('service_plans', 'view'), async (req, res) => {
  try {
    const { format = 'excel' } = req.query;

    const data = await db('service_plans').where('is_active', true);

    if (format === 'csv') {
      await exportToCSV(data, SERVICE_PLAN_COLUMNS, res, 'danh_sach_goi_cuoc');
    } else {
      await exportToExcel(data, SERVICE_PLAN_COLUMNS, 'Gói cước', res, 'danh_sach_goi_cuoc');
    }
  } catch (error) {
    console.error('Export service plans error:', error);
    res.status(500).json({ error: 'Lỗi xuất dữ liệu gói cước' });
  }
});

// ============================================
// EXPORT KHÁCH HÀNG
// ============================================
router.get('/export/customers', authorize('customers', 'view'), async (req, res) => {
  try {
    const { format = 'excel' } = req.query;

    const data = await db('customers')
      .leftJoin('customer_groups', 'customers.group_id', 'customer_groups.id')
      .where('customers.is_active', true)
      .select('customers.*', 'customer_groups.name as group_name');

    if (format === 'csv') {
      await exportToCSV(data, CUSTOMER_COLUMNS, res, 'danh_sach_khach_hang');
    } else {
      await exportToExcel(data, CUSTOMER_COLUMNS, 'Khách hàng', res, 'danh_sach_khach_hang');
    }
  } catch (error) {
    console.error('Export customers error:', error);
    res.status(500).json({ error: 'Lỗi xuất dữ liệu khách hàng' });
  }
});

// ============================================
// IMPORT THIẾT BỊ
// ============================================
router.post('/import/products', authorize('products', 'create'), upload.single('file'),
  auditLog('import', 'products'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Chưa chọn file' });

      let records;
      const ext = req.file.originalname.split('.').pop().toLowerCase();

      if (ext === 'xlsx' || ext === 'xls') {
        records = await importFromExcel(req.file.buffer, IMPORT_COLUMN_MAPPING);
      } else if (ext === 'csv') {
        records = await importFromCSV(req.file.buffer, IMPORT_COLUMN_MAPPING);
      } else {
        return res.status(400).json({ error: 'Chỉ hỗ trợ file Excel (.xlsx) hoặc CSV (.csv)' });
      }

      let imported = 0;
      let skipped = 0;
      const errors = [];

      for (const record of records) {
        try {
          if (!record.code || !record.name) {
            skipped++;
            errors.push(`Bỏ qua: thiếu mã hoặc tên thiết bị`);
            continue;
          }

          const exists = await db('products').where('code', record.code).first();
          if (exists) {
            // Cập nhật
            await db('products').where('code', record.code).update({
              name: record.name,
              unit: record.unit || 'Cái',
              cost_price: parseFloat(record.cost_price) || 0,
              retail_price: parseFloat(record.retail_price) || 0,
              agent_level1_price: parseFloat(record.agent_level1_price) || 0,
              agent_level2_price: parseFloat(record.agent_level2_price) || 0,
              stock_quantity: parseInt(record.stock_quantity) || exists.stock_quantity,
              serial_number: record.serial_number || exists.serial_number,
              imei: record.imei || exists.imei,
              updated_at: new Date(),
            });
          } else {
            await db('products').insert({
              code: record.code,
              name: record.name,
              unit: record.unit || 'Cái',
              cost_price: parseFloat(record.cost_price) || 0,
              retail_price: parseFloat(record.retail_price) || 0,
              agent_level1_price: parseFloat(record.agent_level1_price) || 0,
              agent_level2_price: parseFloat(record.agent_level2_price) || 0,
              stock_quantity: parseInt(record.stock_quantity) || 0,
              serial_number: record.serial_number,
              imei: record.imei,
            });
          }
          imported++;
        } catch (err) {
          skipped++;
          errors.push(`Lỗi dòng ${record.code}: ${err.message}`);
        }
      }

      res.json({
        message: `Import hoàn tất: ${imported} thành công, ${skipped} bỏ qua`,
        imported,
        skipped,
        total: records.length,
        errors: errors.slice(0, 10), // Chỉ trả về 10 lỗi đầu
      });
    } catch (error) {
      console.error('Import products error:', error);
      res.status(500).json({ error: 'Lỗi import thiết bị: ' + error.message });
    }
  });

// ============================================
// IMPORT KHÁCH HÀNG
// ============================================
router.post('/import/customers', authorize('customers', 'create'), upload.single('file'),
  auditLog('import', 'customers'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Chưa chọn file' });

      let records;
      const ext = req.file.originalname.split('.').pop().toLowerCase();

      if (ext === 'xlsx' || ext === 'xls') {
        records = await importFromExcel(req.file.buffer, IMPORT_COLUMN_MAPPING);
      } else if (ext === 'csv') {
        records = await importFromCSV(req.file.buffer, IMPORT_COLUMN_MAPPING);
      } else {
        return res.status(400).json({ error: 'Chỉ hỗ trợ file Excel (.xlsx) hoặc CSV (.csv)' });
      }

      let imported = 0;
      let skipped = 0;

      for (const record of records) {
        try {
          if (!record.code || !record.customer_name) { skipped++; continue; }

          const exists = await db('customers').where('code', record.code).first();
          if (!exists) {
            await db('customers').insert({
              code: record.code,
              customer_name: record.customer_name,
              company_name: record.company_name,
              contact_person: record.contact_person,
              phone: record.phone,
              email: record.email,
              address: record.address,
              tax_code: record.tax_code,
              group_id: 3, // Mặc định khách lẻ
              created_by: req.user.id,
            });
            imported++;
          } else {
            skipped++;
          }
        } catch (err) {
          skipped++;
        }
      }

      res.json({
        message: `Import hoàn tất: ${imported} thành công, ${skipped} bỏ qua`,
        imported, skipped, total: records.length,
      });
    } catch (error) {
      console.error('Import customers error:', error);
      res.status(500).json({ error: 'Lỗi import khách hàng: ' + error.message });
    }
  });

// ============================================
// IMPORT GÓI CƯỚC
// ============================================
router.post('/import/service-plans', authorize('service_plans', 'create'), upload.single('file'),
  auditLog('import', 'service_plans'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Chưa chọn file' });

      let records;
      const ext = req.file.originalname.split('.').pop().toLowerCase();

      if (ext === 'xlsx' || ext === 'xls') {
        records = await importFromExcel(req.file.buffer, IMPORT_COLUMN_MAPPING);
      } else if (ext === 'csv') {
        records = await importFromCSV(req.file.buffer, IMPORT_COLUMN_MAPPING);
      } else {
        return res.status(400).json({ error: 'Chỉ hỗ trợ file Excel (.xlsx) hoặc CSV (.csv)' });
      }

      let imported = 0;
      let skipped = 0;
      const errors = [];

      for (const record of records) {
        try {
          if (!record.code || !record.name) {
            skipped++;
            errors.push('Bỏ qua: thiếu mã hoặc tên gói cước');
            continue;
          }

          const exists = await db('service_plans').where('code', record.code).first();
          if (exists) {
            await db('service_plans').where('code', record.code).update({
              name: record.name,
              plan_type: record.plan_type || 'monthly',
              cost_price: parseFloat(record.cost_price) || 0,
              retail_price: parseFloat(record.retail_price) || 0,
              agent_level1_price: parseFloat(record.agent_level1_price) || 0,
              agent_level2_price: parseFloat(record.agent_level2_price) || 0,
              billing_cycle: record.billing_cycle || 'monthly',
              billing_cycle_months: parseInt(record.duration_months) || 1,
              duration_months: parseInt(record.duration_months) || 1,
              updated_at: new Date(),
            });
          } else {
            await db('service_plans').insert({
              code: record.code,
              name: record.name,
              plan_type: record.plan_type || 'monthly',
              cost_price: parseFloat(record.cost_price) || 0,
              retail_price: parseFloat(record.retail_price) || 0,
              agent_level1_price: parseFloat(record.agent_level1_price) || 0,
              agent_level2_price: parseFloat(record.agent_level2_price) || 0,
              billing_cycle: record.billing_cycle || 'monthly',
              billing_cycle_months: parseInt(record.duration_months) || 1,
              duration_months: parseInt(record.duration_months) || 1,
            });
          }
          imported++;
        } catch (err) {
          skipped++;
          errors.push(`Lỗi dòng ${record.code}: ${err.message}`);
        }
      }

      res.json({
        message: `Import hoàn tất: ${imported} thành công, ${skipped} bỏ qua`,
        imported, skipped, total: records.length,
        errors: errors.slice(0, 10),
      });
    } catch (error) {
      console.error('Import service plans error:', error);
      res.status(500).json({ error: 'Lỗi import gói cước: ' + error.message });
    }
  });

// ============================================
// EXPORT TEMPLATE (MẪU IMPORT)
// ============================================
router.get('/template/:type', authenticate, async (req, res) => {
  try {
    const { type } = req.params;
    let columns, sheetName, filename;

    if (type === 'service-plans') {
      columns = SERVICE_PLAN_COLUMNS.filter(c => c.key !== 'status');
      sheetName = 'Mẫu gói cước';
      filename = 'mau_import_goi_cuoc';
    } else if (type === 'products') {
      columns = PRODUCT_COLUMNS.filter(c => c.key !== 'status' && c.key !== 'category_name');
      sheetName = 'Mẫu thiết bị';
      filename = 'mau_import_thiet_bi';
    } else if (type === 'customers') {
      columns = CUSTOMER_COLUMNS.filter(c => c.key !== 'group_name' && c.key !== 'current_debt');
      sheetName = 'Mẫu khách hàng';
      filename = 'mau_import_khach_hang';
    } else {
      return res.status(400).json({ error: 'Loại template không hợp lệ' });
    }

    // Tạo file Excel rỗng chỉ có header
    await exportToExcel([], columns, sheetName, res, filename);
  } catch (error) {
    console.error('Export template error:', error);
    res.status(500).json({ error: 'Lỗi tạo file mẫu' });
  }
});

// ============================================
// XUẤT HÓA ĐƠN PDF
// ============================================
router.get('/pdf/invoice/:id', authorize('invoices', 'view'), async (req, res) => {
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
      .select('invoice_items.*', 'products.name as product_name', 'service_plans.name as plan_name');

    if (invoice.invoice_type === 'quotation') {
      generateQuotationPDF(invoice, items, res);
    } else {
      generateInvoicePDF(invoice, items, res);
    }
  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({ error: 'Lỗi tạo PDF' });
  }
});

// ============================================
// EXPORT BÁO CÁO
// ============================================
router.get('/export/report/:type', authorize('reports', 'view'), async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'excel', date_from, date_to } = req.query;

    let data, columns, sheetName, filename;

    switch (type) {
      case 'sales':
        data = await db('sales_orders')
          .leftJoin('customers', 'sales_orders.customer_id', 'customers.id')
          .where('sales_orders.status', '!=', 'cancelled')
          .modify(qb => {
            if (date_from) qb.where('order_date', '>=', date_from);
            if (date_to) qb.where('order_date', '<=', date_to);
          })
          .select('sales_orders.*', 'customers.customer_name')
          .orderBy('order_date', 'desc');

        columns = [
          { header: 'Số ĐH', key: 'order_number', width: 15 },
          { header: 'Ngày', key: 'order_date', width: 12 },
          { header: 'Khách hàng', key: 'customer_name', width: 25 },
          { header: 'Tạm tính', key: 'subtotal', width: 15 },
          { header: 'Chiết khấu', key: 'discount_amount', width: 12 },
          { header: 'VAT', key: 'tax_amount', width: 12 },
          { header: 'Tổng', key: 'grand_total', width: 15 },
          { header: 'Giá vốn', key: 'cost_total', width: 15 },
          { header: 'Lợi nhuận', key: 'profit', width: 15 },
          { header: 'TT toán', key: 'payment_status', width: 12 },
        ];
        sheetName = 'Báo cáo bán hàng';
        filename = 'bao_cao_ban_hang';
        break;

      case 'inventory':
        data = await db('products')
          .leftJoin('product_categories', 'products.category_id', 'product_categories.id')
          .where('products.is_active', true)
          .select('products.*', 'product_categories.name as category_name');

        columns = PRODUCT_COLUMNS;
        sheetName = 'Báo cáo tồn kho';
        filename = 'bao_cao_ton_kho';
        break;

      default:
        return res.status(400).json({ error: 'Loại báo cáo không hợp lệ' });
    }

    if (format === 'csv') {
      await exportToCSV(data, columns, res, filename);
    } else {
      await exportToExcel(data, columns, sheetName, res, filename);
    }
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({ error: 'Lỗi xuất báo cáo' });
  }
});

// ============================================
// BACKUP & RESTORE
// ============================================
router.post('/backup', authorize('settings', 'edit'), async (req, res) => {
  try {
    const result = await backupDatabase();
    res.json({ message: 'Backup thành công', ...result });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi backup: ' + error.message });
  }
});

router.get('/backups', authorize('settings', 'view'), async (req, res) => {
  try {
    const backups = listBackups();
    res.json({ data: backups });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy danh sách backup' });
  }
});

module.exports = router;
