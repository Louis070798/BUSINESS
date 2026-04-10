import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import viVN from 'antd/locale/vi_VN';
import MainLayout from './components/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import ProductsPage from './pages/ProductsPage';
import ServicePlansPage from './pages/ServicePlansPage';
import SalesOrdersPage from './pages/SalesOrdersPage';
import CreateSalesOrderPage from './pages/CreateSalesOrderPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import InventoryPage from './pages/InventoryPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import PaymentsPage from './pages/PaymentsPage';
import InvoicesPage from './pages/InvoicesPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import SuppliersPage from './pages/SuppliersPage';
import StarlinkDevicesPage from './pages/StarlinkDevicesPage';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) return null;

  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={
              user ? <Navigate to="/" /> : <LoginPage onLogin={handleLogin} />
            } />
            <Route path="/*" element={
              user ? (
                <MainLayout user={user} onLogout={handleLogout}>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/customers" element={<CustomersPage />} />
                    <Route path="/products" element={<ProductsPage />} />
                    <Route path="/service-plans" element={<ServicePlansPage />} />
                    <Route path="/suppliers" element={<SuppliersPage />} />
                    <Route path="/sales-orders" element={<SalesOrdersPage />} />
                    <Route path="/sales-orders/new" element={<CreateSalesOrderPage />} />
                    <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    <Route path="/subscriptions" element={<SubscriptionsPage />} />
                    <Route path="/starlink-devices" element={<StarlinkDevicesPage />} />
                    <Route path="/payments" element={<PaymentsPage />} />
                    <Route path="/invoices" element={<InvoicesPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/users" element={<UsersPage />} />
                  </Routes>
                </MainLayout>
              ) : <Navigate to="/login" />
            } />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;
