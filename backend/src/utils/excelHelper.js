const ExcelJS = require('exceljs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const { Readable } = require('stream');
const db = require('../config/database');

// ============================================
// EXPORT TO EXCEL
// ============================================
async function exportToExcel(data, columns, sheetName, res, filename) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Business Manager';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);

  // Header
  sheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width || 15,
  }));

  // Style header
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

  // Data
  data.forEach(row => {
    const rowData = {};
    columns.forEach(col => {
      rowData[col.key] = row[col.key];
    });
    sheet.addRow(rowData);
  });

  // Auto filter
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  // Border
  sheet.eachRow((row, rowNumber) => {
    row.eachCell(cell => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
}

// ============================================
// EXPORT TO CSV
// ============================================
async function exportToCSV(data, columns, res, filename) {
  const header = columns.map(col => ({ id: col.key, title: col.header }));

  let csvContent = '\uFEFF'; // BOM for UTF-8
  csvContent += header.map(h => h.title).join(',') + '\n';

  data.forEach(row => {
    csvContent += header.map(h => {
      const val = row[h.id];
      if (val === null || val === undefined) return '';
      const strVal = String(val);
      return strVal.includes(',') ? `"${strVal}"` : strVal;
    }).join(',') + '\n';
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
  res.send(csvContent);
}

// ============================================
// IMPORT FROM EXCEL
// ============================================
async function importFromExcel(buffer, columnMapping) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.getWorksheet(1);
  if (!sheet) throw new Error('File Excel không có sheet nào');

  const headers = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = cell.value;
  });

  const records = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const record = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      const mappedKey = columnMapping[header] || header;
      record[mappedKey] = cell.value;
    });
    records.push(record);
  });

  return records;
}

// ============================================
// IMPORT FROM CSV
// ============================================
async function importFromCSV(buffer, columnMapping) {
  return new Promise((resolve, reject) => {
    const records = [];
    const stream = Readable.from(buffer.toString('utf-8'));

    stream.pipe(csv())
      .on('data', (row) => {
        const record = {};
        Object.keys(row).forEach(key => {
          const cleanKey = key.replace(/^\uFEFF/, '');
          const mappedKey = columnMapping[cleanKey] || cleanKey;
          record[mappedKey] = row[key];
        });
        records.push(record);
      })
      .on('end', () => resolve(records))
      .on('error', reject);
  });
}

// ============================================
// COLUMN DEFINITIONS
// ============================================
const PRODUCT_COLUMNS = [
  { header: 'Mã thiết bị', key: 'code', width: 15 },
  { header: 'Tên thiết bị', key: 'name', width: 30 },
  { header: 'Loại', key: 'category_name', width: 20 },
  { header: 'Đơn vị', key: 'unit', width: 10 },
  { header: 'Giá nhập', key: 'cost_price', width: 15 },
  { header: 'Giá bán lẻ', key: 'retail_price', width: 15 },
  { header: 'Giá ĐL cấp 1', key: 'agent_level1_price', width: 15 },
  { header: 'Giá ĐL cấp 2', key: 'agent_level2_price', width: 15 },
  { header: 'Tồn kho', key: 'stock_quantity', width: 12 },
  { header: 'Serial', key: 'serial_number', width: 20 },
  { header: 'IMEI', key: 'imei', width: 20 },
  { header: 'Trạng thái', key: 'status', width: 12 },
];

const SERVICE_PLAN_COLUMNS = [
  { header: 'Mã gói cước', key: 'code', width: 15 },
  { header: 'Tên gói', key: 'name', width: 30 },
  { header: 'Loại gói', key: 'plan_type', width: 15 },
  { header: 'Giá vốn', key: 'cost_price', width: 15 },
  { header: 'Giá bán lẻ', key: 'retail_price', width: 15 },
  { header: 'Giá ĐL cấp 1', key: 'agent_level1_price', width: 15 },
  { header: 'Giá ĐL cấp 2', key: 'agent_level2_price', width: 15 },
  { header: 'Chu kỳ', key: 'billing_cycle', width: 12 },
  { header: 'Thời hạn (tháng)', key: 'duration_months', width: 15 },
  { header: 'Trạng thái', key: 'status', width: 12 },
];

const CUSTOMER_COLUMNS = [
  { header: 'Mã KH', key: 'code', width: 12 },
  { header: 'Tên công ty', key: 'company_name', width: 30 },
  { header: 'Tên KH', key: 'customer_name', width: 25 },
  { header: 'Người liên hệ', key: 'contact_person', width: 20 },
  { header: 'Điện thoại', key: 'phone', width: 15 },
  { header: 'Email', key: 'email', width: 25 },
  { header: 'Địa chỉ', key: 'address', width: 35 },
  { header: 'MST', key: 'tax_code', width: 15 },
  { header: 'Nhóm KH', key: 'group_name', width: 15 },
  { header: 'Công nợ', key: 'current_debt', width: 15 },
];

const IMPORT_COLUMN_MAPPING = {
  // Product mapping
  'Mã thiết bị': 'code',
  'Tên thiết bị': 'name',
  'Đơn vị': 'unit',
  'Giá nhập': 'cost_price',
  'Giá bán lẻ': 'retail_price',
  'Giá ĐL cấp 1': 'agent_level1_price',
  'Giá ĐL cấp 2': 'agent_level2_price',
  'Tồn kho': 'stock_quantity',
  'Serial': 'serial_number',
  'IMEI': 'imei',

  // Customer mapping
  'Mã KH': 'code',
  'Tên công ty': 'company_name',
  'Tên KH': 'customer_name',
  'Người liên hệ': 'contact_person',
  'Điện thoại': 'phone',
  'Email': 'email',
  'Địa chỉ': 'address',
  'MST': 'tax_code',

  // Service plan mapping
  'Mã gói cước': 'code',
  'Tên gói': 'name',
  'Loại gói': 'plan_type',
  'Giá vốn': 'cost_price',
  'Chu kỳ': 'billing_cycle',
  'Thời hạn (tháng)': 'duration_months',
};

module.exports = {
  exportToExcel,
  exportToCSV,
  importFromExcel,
  importFromCSV,
  PRODUCT_COLUMNS,
  SERVICE_PLAN_COLUMNS,
  CUSTOMER_COLUMNS,
  IMPORT_COLUMN_MAPPING,
};
