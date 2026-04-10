const PDFDocument = require('pdfkit');
const path = require('path');

/**
 * Tạo hóa đơn PDF
 */
function generateInvoicePDF(invoice, items, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  // Pipe to response
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=hoadon_${invoice.invoice_number}.pdf`);
  doc.pipe(res);

  // Font - sử dụng Helvetica (built-in, hỗ trợ tiếng Việt cơ bản)
  // Trong thực tế nên embed font tiếng Việt như Roboto

  // === HEADER ===
  doc.fontSize(20).text('HÓA ĐƠN BÁN HÀNG', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).text(`Số: ${invoice.invoice_number}`, { align: 'center' });
  doc.text(`Ngày: ${new Date(invoice.invoice_date).toLocaleDateString('vi-VN')}`, { align: 'center' });
  doc.moveDown(1);

  // === THÔNG TIN CÔNG TY ===
  doc.fontSize(12).text('CÔNG TY CỦA BẠN', { bold: true });
  doc.fontSize(9)
    .text('Địa chỉ: 123 Đường ABC, Quận XYZ, TP.HCM')
    .text('Điện thoại: 028-1234-5678 | Email: info@company.com')
    .text('MST: 0312345678');
  doc.moveDown(0.5);

  // Đường kẻ
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);

  // === THÔNG TIN KHÁCH HÀNG ===
  doc.fontSize(10).text('THÔNG TIN KHÁCH HÀNG:', { underline: true });
  doc.fontSize(9);
  if (invoice.company_name) doc.text(`Công ty: ${invoice.company_name}`);
  doc.text(`Khách hàng: ${invoice.customer_name || ''}`);
  if (invoice.customer_address) doc.text(`Địa chỉ: ${invoice.customer_address}`);
  if (invoice.customer_phone) doc.text(`Điện thoại: ${invoice.customer_phone}`);
  if (invoice.tax_code) doc.text(`MST: ${invoice.tax_code}`);
  doc.moveDown(0.5);

  // === BẢNG SẢN PHẨM ===
  const tableTop = doc.y + 5;
  const colWidths = [30, 200, 40, 60, 80, 80];
  const headers = ['STT', 'Sản phẩm/Dịch vụ', 'SL', 'Đ.Giá', 'VAT', 'Thành tiền'];
  const startX = 40;

  // Header bảng
  doc.rect(startX, tableTop, 515, 20).fill('#f0f0f0').stroke();
  doc.fill('#000');
  let x = startX + 5;
  headers.forEach((header, i) => {
    doc.fontSize(8).text(header, x, tableTop + 5, { width: colWidths[i], align: i >= 2 ? 'right' : 'left' });
    x += colWidths[i] + 5;
  });

  // Rows
  let y = tableTop + 25;
  items.forEach((item, index) => {
    if (y > 700) {
      doc.addPage();
      y = 50;
    }

    const name = item.product_name || item.plan_name || item.description || 'N/A';
    x = startX + 5;

    doc.fontSize(8)
      .text(index + 1, x, y, { width: colWidths[0] })
      .text(name, x + colWidths[0] + 5, y, { width: colWidths[1] })
      .text(item.quantity, x + colWidths[0] + colWidths[1] + 10, y, { width: colWidths[2], align: 'right' })
      .text(formatCurrency(item.unit_price), x + colWidths[0] + colWidths[1] + colWidths[2] + 15, y, { width: colWidths[3], align: 'right' })
      .text(formatCurrency(item.tax_amount), x + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 20, y, { width: colWidths[4], align: 'right' })
      .text(formatCurrency(item.total_amount), x + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 25, y, { width: colWidths[5], align: 'right' });

    // Đường kẻ dòng
    y += 18;
    doc.moveTo(startX, y - 3).lineTo(555, y - 3).stroke('#e0e0e0');
  });

  // === TỔNG CỘNG ===
  y += 10;
  doc.moveTo(startX, y).lineTo(555, y).stroke();
  y += 10;

  const rightX = 370;
  doc.fontSize(9);
  doc.text('Tạm tính:', rightX, y).text(formatCurrency(invoice.subtotal), rightX + 100, y, { align: 'right', width: 85 });
  y += 15;

  if (parseFloat(invoice.discount_amount) > 0) {
    doc.text('Chiết khấu:', rightX, y).text(`-${formatCurrency(invoice.discount_amount)}`, rightX + 100, y, { align: 'right', width: 85 });
    y += 15;
  }

  doc.text('Thuế VAT (10%):', rightX, y).text(formatCurrency(invoice.tax_amount), rightX + 100, y, { align: 'right', width: 85 });
  y += 15;

  doc.fontSize(11).text('TỔNG THANH TOÁN:', rightX, y);
  doc.text(formatCurrency(invoice.grand_total), rightX + 100, y, { align: 'right', width: 85 });
  y += 25;

  // === GHI CHÚ ===
  if (invoice.notes) {
    doc.fontSize(9).text(`Ghi chú: ${invoice.notes}`, startX, y);
    y += 20;
  }

  // === CHỮ KÝ ===
  y += 30;
  doc.fontSize(9);
  doc.text('Người mua hàng', startX + 30, y, { align: 'center', width: 150 });
  doc.text('Người bán hàng', startX + 310, y, { align: 'center', width: 150 });
  y += 12;
  doc.fontSize(8).fillColor('#888');
  doc.text('(Ký, ghi rõ họ tên)', startX + 30, y, { align: 'center', width: 150 });
  doc.text('(Ký, ghi rõ họ tên)', startX + 310, y, { align: 'center', width: 150 });

  doc.end();
}

/**
 * Tạo phiếu báo giá PDF
 */
function generateQuotationPDF(invoice, items, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=baogia_${invoice.invoice_number}.pdf`);
  doc.pipe(res);

  doc.fontSize(20).text('PHIẾU BÁO GIÁ', { align: 'center' });
  doc.fontSize(10).text(`Số: ${invoice.invoice_number}`, { align: 'center' });
  doc.text(`Ngày: ${new Date(invoice.invoice_date).toLocaleDateString('vi-VN')}`, { align: 'center' });
  if (invoice.due_date) {
    doc.text(`Hiệu lực đến: ${new Date(invoice.due_date).toLocaleDateString('vi-VN')}`, { align: 'center' });
  }
  doc.moveDown(1);

  // Thông tin KH
  doc.fontSize(10).text('Kính gửi:');
  if (invoice.company_name) doc.text(`Công ty: ${invoice.company_name}`);
  doc.text(`Khách hàng: ${invoice.customer_name || ''}`);
  doc.moveDown(0.5);

  doc.text('Chúng tôi xin báo giá các sản phẩm/dịch vụ như sau:');
  doc.moveDown(0.5);

  // Bảng
  let y = doc.y;
  items.forEach((item, index) => {
    const name = item.product_name || item.plan_name || item.description || '';
    doc.fontSize(9).text(
      `${index + 1}. ${name} - SL: ${item.quantity} - Đơn giá: ${formatCurrency(item.unit_price)} - Thành tiền: ${formatCurrency(item.total_amount)}`,
      50, y + index * 18
    );
  });

  y = doc.y + items.length * 18 + 20;
  doc.fontSize(10).text(`Tổng cộng: ${formatCurrency(invoice.grand_total)}`, 40, y);
  y += 15;
  doc.text(`(Giá đã bao gồm VAT 10%)`, 40, y);

  if (invoice.terms) {
    y += 25;
    doc.text(`Điều khoản: ${invoice.terms}`, 40, y);
  }

  doc.end();
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount || 0);
}

module.exports = { generateInvoicePDF, generateQuotationPDF };
