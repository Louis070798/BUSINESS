import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Alert, Space, Typography, Select } from 'antd';
import {
  DollarOutlined, ShoppingCartOutlined, TeamOutlined, WarningOutlined,
  RiseOutlined, FallOutlined, CalendarOutlined, InboxOutlined,
  FileTextOutlined, AlertOutlined,
} from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { reportsAPI, productsAPI, subscriptionsAPI, paymentsAPI } from '../services/api';

const { Title, Text } = Typography;
const COLORS = ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2'];

function formatVND(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
}

function DashboardPage() {
  const [dashboard, setDashboard] = useState({});
  const [chartData, setChartData] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [overdue, setOverdue] = useState({ overdueReceivables: [], totalOverdueReceivable: 0 });
  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadChart();
  }, [chartYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dashRes, lowRes, expRes, overdueRes] = await Promise.all([
        reportsAPI.dashboard(),
        productsAPI.getLowStock().catch(() => ({ data: { data: [] } })),
        subscriptionsAPI.expiring(30).catch(() => ({ data: { data: [] } })),
        paymentsAPI.overdue().catch(() => ({ data: { overdueReceivables: [], totalOverdueReceivable: 0 } })),
      ]);
      setDashboard(dashRes.data);
      setLowStock(lowRes.data?.data || []);
      setExpiring(expRes.data?.data || []);
      setOverdue(overdueRes.data || {});
    } catch (error) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChart = async () => {
    try {
      const res = await reportsAPI.revenueChart(chartYear);
      setChartData(res.data.data || []);
    } catch (error) {
      console.error('Chart error:', error);
    }
  };

  const d = dashboard;

  return (
    <div>
      <Title level={4}>📊 Tổng Quan Kinh Doanh</Title>

      {/* Cảnh báo */}
      <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
        {d.overdueCount > 0 && (
          <Alert message={`⚠️ Có ${d.overdueCount} khoản công nợ quá hạn cần xử lý`}
            type="error" showIcon closable />
        )}
        {d.lowStockCount > 0 && (
          <Alert message={`📦 Có ${d.lowStockCount} thiết bị tồn kho thấp cần nhập thêm`}
            type="warning" showIcon closable />
        )}
        {d.expiringPlans > 0 && (
          <Alert message={`📅 Có ${d.expiringPlans} gói cước sắp hết hạn trong 30 ngày`}
            type="info" showIcon closable />
        )}
      </Space>

      {/* Thống kê chính */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Doanh thu tháng" value={d.monthlyRevenue}
              formatter={v => formatVND(v)} prefix={<DollarOutlined />}
              valueStyle={{ color: '#1677ff', fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Lợi nhuận tháng" value={d.monthlyProfit}
              formatter={v => formatVND(v)} prefix={<RiseOutlined />}
              valueStyle={{ color: '#52c41a', fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Đơn hàng tháng" value={d.monthlyOrderCount}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#722ed1', fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Khách mới tháng" value={d.newCustomers}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#13c2c2', fontSize: 20 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Công nợ phải thu" value={d.totalReceivable}
              formatter={v => formatVND(v)} prefix={<FallOutlined />}
              valueStyle={{ color: '#faad14', fontSize: 18 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Công nợ phải trả" value={d.totalPayable}
              formatter={v => formatVND(v)} prefix={<FallOutlined />}
              valueStyle={{ color: '#ff4d4f', fontSize: 18 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Gói cước đang hoạt động" value={d.activeSubscriptions}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#52c41a', fontSize: 18 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Giá trị tồn kho" value={d.stockValue}
              formatter={v => formatVND(v)} prefix={<InboxOutlined />}
              valueStyle={{ color: '#1677ff', fontSize: 18 }} />
          </Card>
        </Col>
      </Row>

      {/* Biểu đồ doanh thu */}
      <Card style={{ marginTop: 16 }} title={
        <Space>
          <span>📈 Biểu đồ doanh thu theo tháng</span>
          <Select value={chartYear} onChange={setChartYear} style={{ width: 100 }}>
            {[2024, 2025, 2026, 2027].map(y => (
              <Select.Option key={y} value={y}>{y}</Select.Option>
            ))}
          </Select>
        </Space>
      }>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="monthName" />
            <YAxis tickFormatter={v => `${(v / 1000000).toFixed(0)}tr`} />
            <Tooltip formatter={(value) => formatVND(value)} />
            <Legend />
            <Bar dataKey="revenue" name="Doanh thu" fill="#1677ff" />
            <Bar dataKey="profit" name="Lợi nhuận" fill="#52c41a" />
            <Bar dataKey="cost" name="Giá vốn" fill="#faad14" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Tồn kho thấp */}
        <Col xs={24} md={12}>
          <Card title="⚠️ Thiết bị tồn kho thấp" size="small">
            <Table
              dataSource={lowStock.slice(0, 5)}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: 'Mã', dataIndex: 'code', width: 80 },
                { title: 'Tên thiết bị', dataIndex: 'name', ellipsis: true },
                { title: 'Tồn', dataIndex: 'stock_quantity', width: 60,
                  render: v => <Tag color="red">{v}</Tag> },
                { title: 'Tối thiểu', dataIndex: 'min_stock_level', width: 80 },
              ]}
            />
          </Card>
        </Col>

        {/* Gói cước sắp hết hạn */}
        <Col xs={24} md={12}>
          <Card title="📅 Gói cước sắp hết hạn" size="small">
            <Table
              dataSource={expiring.slice(0, 5)}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: 'Khách hàng', dataIndex: 'customer_name', ellipsis: true },
                { title: 'Gói', dataIndex: 'plan_name', ellipsis: true },
                { title: 'Hết hạn', dataIndex: 'end_date', width: 100,
                  render: v => new Date(v).toLocaleDateString('vi-VN') },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default DashboardPage;
