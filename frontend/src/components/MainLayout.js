import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography, Badge } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, UserOutlined, ShopOutlined, AppstoreOutlined,
  ShoppingCartOutlined, ImportOutlined, DatabaseOutlined, CalendarOutlined,
  DollarOutlined, FileTextOutlined, BarChartOutlined, TeamOutlined,
  LogoutOutlined, SettingOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  CloudOutlined, TruckOutlined, WifiOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Tổng quan' },
  {
    key: 'sales-group', icon: <ShoppingCartOutlined />, label: 'Bán hàng',
    children: [
      { key: '/sales-orders', label: 'Đơn bán hàng' },
      { key: '/sales-orders/new', label: 'Tạo đơn mới' },
    ],
  },
  { key: '/customers', icon: <TeamOutlined />, label: 'Khách hàng' },
  { key: '/products', icon: <AppstoreOutlined />, label: 'Thiết bị' },
  { key: '/service-plans', icon: <CloudOutlined />, label: 'Gói cước' },
  { key: '/subscriptions', icon: <CalendarOutlined />, label: 'Đăng ký gói cước' },
  { key: '/starlink-devices', icon: <WifiOutlined />, label: 'Thiết bị Starlink' },
  {
    key: 'warehouse-group', icon: <DatabaseOutlined />, label: 'Kho hàng',
    children: [
      { key: '/inventory', label: 'Quản lý kho' },
      { key: '/purchase-orders', label: 'Nhập hàng' },
    ],
  },
  { key: '/suppliers', icon: <TruckOutlined />, label: 'Nhà cung cấp' },
  {
    key: 'finance-group', icon: <DollarOutlined />, label: 'Kế toán',
    children: [
      { key: '/payments', label: 'Thanh toán & Công nợ' },
      { key: '/invoices', label: 'Hóa đơn' },
    ],
  },
  { key: '/reports', icon: <BarChartOutlined />, label: 'Báo cáo' },
  { key: '/users', icon: <UserOutlined />, label: 'Người dùng' },
];

function MainLayout({ children, user, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: `${user.full_name} (${user.role_name})` },
    { key: 'settings', icon: <SettingOutlined />, label: 'Cài đặt' },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
  ];

  const handleMenuClick = ({ key }) => {
    if (key === 'logout') onLogout();
    else navigate(key);
  };

  const handleUserMenu = ({ key }) => {
    if (key === 'logout') onLogout();
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={250}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: '#001529',
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: collapsed ? 14 : 16,
          fontWeight: 'bold',
          borderBottom: '1px solid #002040',
          padding: '0 10px',
        }}>
          {collapsed ? '📊' : '📊 Quản Lý KD'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['sales-group', 'warehouse-group', 'finance-group']}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 250, transition: 'all 0.2s' }}>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <Space>
            {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
              onClick: () => setCollapsed(!collapsed),
              style: { fontSize: 18, cursor: 'pointer' },
            })}
            <Text strong style={{ fontSize: 16 }}>Hệ Thống Quản Lý Kế Toán & Kinh Doanh</Text>
          </Space>

          <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenu }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar style={{ backgroundColor: '#1677ff' }} icon={<UserOutlined />} />
              <Text>{user.full_name}</Text>
            </Space>
          </Dropdown>
        </Header>

        <Content style={{ margin: 16, padding: 16, background: '#f5f5f5', minHeight: 360 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

export default MainLayout;
