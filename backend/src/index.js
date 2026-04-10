require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// MIDDLEWARE
// ============================================
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// ============================================
// ROUTES
// ============================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/products', require('./routes/products'));
app.use('/api/service-plans', require('./routes/servicePlans'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/sales-orders', require('./routes/salesOrders'));
app.use('/api/purchase-orders', require('./routes/purchaseOrders'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/data', require('./routes/dataExchange'));
app.use('/api/starlink-devices', require('./routes/starlinkDevices'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Lỗi hệ thống',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ============================================
// START SERVER
// ============================================
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║   BUSINESS MANAGER API SERVER                     ║
║   Port: ${PORT}                                        ║
║   Mode: ${process.env.NODE_ENV || 'development'}                              ║
║   API:  http://localhost:${PORT}/api                    ║
╚══════════════════════════════════════════════════╝
  `);
});

server.on('error', (err) => {
  console.error('Server error:', err.message);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

module.exports = app;
