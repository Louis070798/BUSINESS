import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - thêm token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - xử lý lỗi
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============================================
// AUTH API
// ============================================
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
};

// ============================================
// USERS API
// ============================================
export const usersAPI = {
  list: (params) => api.get('/users', { params }),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  getRoles: () => api.get('/users/roles/all'),
};

// ============================================
// CUSTOMERS API
// ============================================
export const customersAPI = {
  list: (params) => api.get('/customers', { params }),
  detail: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  getGroups: () => api.get('/customers/groups/all'),
};

// ============================================
// PRODUCTS API
// ============================================
export const productsAPI = {
  list: (params) => api.get('/products', { params }),
  detail: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  getCategories: () => api.get('/products/categories/all'),
  getLowStock: () => api.get('/products/alerts/low-stock'),
};

// ============================================
// SERVICE PLANS API
// ============================================
export const servicePlansAPI = {
  list: (params) => api.get('/service-plans', { params }),
  detail: (id) => api.get(`/service-plans/${id}`),
  create: (data) => api.post('/service-plans', data),
  update: (id, data) => api.put(`/service-plans/${id}`, data),
  delete: (id) => api.delete(`/service-plans/${id}`),
};

// ============================================
// SUPPLIERS API
// ============================================
export const suppliersAPI = {
  list: (params) => api.get('/suppliers', { params }),
  detail: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
};

// ============================================
// SALES ORDERS API
// ============================================
export const salesOrdersAPI = {
  list: (params) => api.get('/sales-orders', { params }),
  detail: (id) => api.get(`/sales-orders/${id}`),
  create: (data) => api.post('/sales-orders', data),
  update: (id, data) => api.put(`/sales-orders/${id}`, data),
  updateStatus: (id, status) => api.put(`/sales-orders/${id}/status`, { status }),
  cancel: (id) => api.post(`/sales-orders/${id}/cancel`),
};

// ============================================
// PURCHASE ORDERS API
// ============================================
export const purchaseOrdersAPI = {
  list: (params) => api.get('/purchase-orders', { params }),
  detail: (id) => api.get(`/purchase-orders/${id}`),
  create: (data) => api.post('/purchase-orders', data),
};

// ============================================
// INVENTORY API
// ============================================
export const inventoryAPI = {
  summary: () => api.get('/inventory/summary'),
  transactions: (params) => api.get('/inventory/transactions', { params }),
  adjust: (data) => api.post('/inventory/adjust', data),
};

// ============================================
// SUBSCRIPTIONS API
// ============================================
export const subscriptionsAPI = {
  list: (params) => api.get('/subscriptions', { params }),
  expiring: (days) => api.get('/subscriptions/expiring', { params: { days } }),
  pendingBilling: () => api.get('/subscriptions/pending-billing'),
  batchBilling: (ids) => api.post('/subscriptions/batch-billing', { subscription_ids: ids }),
  renew: (id, months) => api.post(`/subscriptions/${id}/renew`, { months }),
};

// ============================================
// PAYMENTS API
// ============================================
export const paymentsAPI = {
  list: (params) => api.get('/payments', { params }),
  receive: (data) => api.post('/payments/receive', data),
  pay: (data) => api.post('/payments/pay', data),
  receivables: (params) => api.get('/payments/receivables', { params }),
  payables: (params) => api.get('/payments/payables', { params }),
  overdue: () => api.get('/payments/overdue'),
};

// ============================================
// INVOICES API
// ============================================
export const invoicesAPI = {
  list: (params) => api.get('/invoices', { params }),
  detail: (id) => api.get(`/invoices/${id}`),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  createFromOrder: (orderId, type) => api.post(`/invoices/from-order/${orderId}`, { invoice_type: type }),
  createQuotation: (data) => api.post('/invoices/quotation', data),
};

// ============================================
// REPORTS API
// ============================================
export const reportsAPI = {
  dashboard: () => api.get('/reports/dashboard'),
  revenueChart: (year) => api.get('/reports/revenue-chart', { params: { year } }),
  sales: (params) => api.get('/reports/sales', { params }),
  revenueByCustomer: (params) => api.get('/reports/revenue-by-customer', { params }),
  revenueByGroup: (params) => api.get('/reports/revenue-by-group', { params }),
  profitByProduct: (params) => api.get('/reports/profit-by-product', { params }),
  inventory: () => api.get('/reports/inventory'),
  customerDebt: () => api.get('/reports/customer-debt'),
  supplierDebt: () => api.get('/reports/supplier-debt'),
};

// ============================================
// DATA EXCHANGE API
// ============================================
export const dataAPI = {
  exportProducts: (format) => api.get(`/data/export/products?format=${format}`, { responseType: 'blob' }),
  exportServicePlans: (format) => api.get(`/data/export/service-plans?format=${format}`, { responseType: 'blob' }),
  exportCustomers: (format) => api.get(`/data/export/customers?format=${format}`, { responseType: 'blob' }),
  importProducts: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/data/import/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  importCustomers: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/data/import/customers', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  importServicePlans: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/data/import/service-plans', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  downloadTemplate: (type) => api.get(`/data/template/${type}`, { responseType: 'blob' }),
  exportReport: (type, params) => api.get(`/data/export/report/${type}`, { params, responseType: 'blob' }),
  downloadPDF: (invoiceId) => api.get(`/data/pdf/invoice/${invoiceId}`, { responseType: 'blob' }),
  backup: () => api.post('/data/backup'),
  listBackups: () => api.get('/data/backups'),
};

// ============================================
// STARLINK DEVICES API
// ============================================
export const starlinkAPI = {
  list: (params) => api.get('/starlink-devices', { params }),
  detail: (id) => api.get(`/starlink-devices/${id}`),
  create: (data) => api.post('/starlink-devices', data),
  update: (id, data) => api.put(`/starlink-devices/${id}`, data),
  delete: (id) => api.delete(`/starlink-devices/${id}`),
  renew: (id, data) => api.post(`/starlink-devices/${id}/renew`, data),
  billings: (id) => api.get(`/starlink-devices/${id}/billings`),
};

export default api;
