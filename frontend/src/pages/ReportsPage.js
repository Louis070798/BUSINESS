import React, { useState } from 'react';
import {
  Card, Row, Col, Typography, Tabs, Table, DatePicker, Button, Select, Space, Tag, Statistic
} from 'antd';
import {
  DownloadOutlined, BarChartOutlined, PieChartOutlined
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { reportsAPI, dataAPI } from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const COLORS = ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2', '#eb2f96', '#a0d911'];

function formatVND(v) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
}

function ReportsPage() {
  const [activeTab, setActiveTab] = useState('sales');
  const [salesData, setSalesData] = useState([]);
  const [revenueByCustomer, setRevenueByCustomer] = useState([]);
  const [revenueByGroup, setRevenueByGroup] = useState([]);
  const [profitByProduct, setProfitByProduct] = useState([]);
  const [inventoryReport, setInventoryReport] = useState([]);
  const [customerDebt, setCustomerDebt] = useState([]);
  const [supplierDebt, setSupplierDebt] = useState([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('month');
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);

  const loadReport = async (type) => {
    try {
      setLoading(true);
      const params = {
        from_date: dateRange[0]?.format('YYYY-MM-DD'),
        to_date: dateRange[1]?.format('YYYY-MM-DD'),
        period,
      };

      switch (type || activeTab) {
        case 'sales': {
          const res = await reportsAPI.sales(params);
          setSalesData(res.data.data || []);
          break;
        }
        case 'revenue-customer': {
          const res = await reportsAPI.revenueByCustomer(params);
          setRevenueByCustomer(res.data.data || []);
          break;
        }
        case 'revenue-group': {
          const res = await reportsAPI.revenueByGroup(params);
          setRevenueByGroup(res.data.data || []);
          break;
        }
        case 'profit-product': {
          const res = await reportsAPI.profitByProduct(params);
          setProfitByProduct(res.data.data || []);
          break;
        }
        case 'inventory': {
          const res = await reportsAPI.inventory();
          setInventoryReport(res.data.data || []);
          break;
        }
        case 'customer-debt': {
          const res = await reportsAPI.customerDebt();
          setCustomerDebt(res.data.data || []);
          break;
        }
        case 'supplier-debt': {
          const res = await reportsAPI.supplierDebt();
          setSupplierDebt(res.data.data || []);
          break;
        }
      }
    } catch (e) {
      console.error('Report error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
    loadReport(key);
  };

  const handleExportReport = async () => {
    try {
      const res = await dataAPI.exportReport(activeTab, 'excel', {
        from_date: dateRange[0]?.format('YYYY-MM-DD'),
        to_date: dateRange[1]?.format('YYYY-MM-DD'),
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${activeTab}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error('Export error:', e);
    }
  };

  const filterBar = (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Row gutter={16} align="middle">
        <Col>
          <RangePicker value={dateRange} onChange={setDateRange} format="DD/MM/YYYY" />
        </Col>
        <Col>
          <Select value={period} onChange={setPeriod} style={{ width: 120 }}>
            <Select.Option value="day">Theo ngày</Select.Option>
            <Select.Option value="month">Theo tháng</Select.Option>
            <Select.Option value="quarter">Theo quý</Select.Option>
            <Select.Option value="year">Theo năm</Select.Option>
          </Select>
        </Col>
        <Col>
          <Button type="primary" onClick={() => loadReport()}>Xem báo cáo</Button>
        </Col>
        <Col>
          <Button icon={<DownloadOutlined />} onClick={handleExportReport}>Xuất Excel</Button>
        </Col>
      </Row>
    </Card>
  );

  const tabItems = [
    {
      key: 'sales', label: '📊 Doanh thu',
      children: (
        <>
          {filterBar}
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period_label" />
              <YAxis tickFormatter={v => `${(v / 1000000).toFixed(0)}tr`} />
              <Tooltip formatter={v => formatVND(v)} />
              <Legend />
              <Bar dataKey="total_revenue" name="Doanh thu" fill="#1677ff" />
              <Bar dataKey="total_profit" name="Lợi nhuận" fill="#52c41a" />
              <Bar dataKey="total_cost" name="Giá vốn" fill="#faad14" />
            </BarChart>
          </ResponsiveContainer>
          <Table dataSource={salesData} rowKey="period_label" size="small" style={{ marginTop: 16 }}
            pagination={false}
            columns={[
              { title: 'Kỳ', dataIndex: 'period_label' },
              { title: 'Số đơn', dataIndex: 'order_count', align: 'center' },
              { title: 'Doanh thu', dataIndex: 'total_revenue', align: 'right', render: v => formatVND(v) },
              { title: 'Giá vốn', dataIndex: 'total_cost', align: 'right', render: v => formatVND(v) },
              { title: 'Lợi nhuận', dataIndex: 'total_profit', align: 'right',
                render: v => <span style={{ color: '#52c41a', fontWeight: 600 }}>{formatVND(v)}</span> },
            ]}
          />
        </>
      ),
    },
    {
      key: 'revenue-customer', label: '👥 DT theo KH',
      children: (
        <>
          {filterBar}
          <Table dataSource={revenueByCustomer} rowKey="customer_id" size="small" loading={loading}
            pagination={{ pageSize: 20 }}
            columns={[
              { title: 'Khách hàng', dataIndex: 'customer_name', ellipsis: true },
              { title: 'Nhóm', dataIndex: 'group_name', width: 130, render: v => <Tag>{v}</Tag> },
              { title: 'Số đơn', dataIndex: 'order_count', width: 80, align: 'center' },
              { title: 'Doanh thu', dataIndex: 'total_revenue', width: 150, align: 'right', render: v => formatVND(v) },
              { title: 'Lợi nhuận', dataIndex: 'total_profit', width: 150, align: 'right',
                render: v => <span style={{ color: '#52c41a' }}>{formatVND(v)}</span> },
            ]}
          />
        </>
      ),
    },
    {
      key: 'revenue-group', label: '📈 DT theo nhóm KH',
      children: (
        <>
          {filterBar}
          <Row gutter={16}>
            <Col span={12}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={revenueByGroup} dataKey="total_revenue" nameKey="group_name"
                    cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`}>
                    {revenueByGroup.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={v => formatVND(v)} />
                </PieChart>
              </ResponsiveContainer>
            </Col>
            <Col span={12}>
              <Table dataSource={revenueByGroup} rowKey="group_name" size="small" pagination={false}
                columns={[
                  { title: 'Nhóm KH', dataIndex: 'group_name' },
                  { title: 'Số đơn', dataIndex: 'order_count', align: 'center' },
                  { title: 'Doanh thu', dataIndex: 'total_revenue', align: 'right', render: v => formatVND(v) },
                ]}
              />
            </Col>
          </Row>
        </>
      ),
    },
    {
      key: 'profit-product', label: '💰 LN theo SP',
      children: (
        <>
          {filterBar}
          <Table dataSource={profitByProduct} rowKey="product_id" size="small" loading={loading}
            pagination={{ pageSize: 20 }}
            columns={[
              { title: 'Sản phẩm', dataIndex: 'product_name', ellipsis: true },
              { title: 'Mã', dataIndex: 'product_code', width: 100 },
              { title: 'SL bán', dataIndex: 'total_quantity', width: 80, align: 'center' },
              { title: 'Doanh thu', dataIndex: 'total_revenue', width: 150, align: 'right', render: v => formatVND(v) },
              { title: 'Giá vốn', dataIndex: 'total_cost', width: 150, align: 'right', render: v => formatVND(v) },
              { title: 'Lợi nhuận', dataIndex: 'total_profit', width: 150, align: 'right',
                render: v => <span style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>{formatVND(v)}</span> },
              { title: 'Biên LN', width: 80, align: 'right',
                render: (_, r) => {
                  const margin = r.total_revenue > 0 ? (r.total_profit / r.total_revenue * 100).toFixed(1) : 0;
                  return `${margin}%`;
                }
              },
            ]}
          />
        </>
      ),
    },
    {
      key: 'inventory', label: '📦 Tồn kho',
      children: (
        <>
          <Button type="primary" onClick={() => loadReport('inventory')} style={{ marginBottom: 16 }}>
            Xem báo cáo tồn kho
          </Button>
          <Table dataSource={inventoryReport} rowKey="id" size="small" loading={loading}
            pagination={{ pageSize: 50 }}
            columns={[
              { title: 'Mã SP', dataIndex: 'code', width: 100 },
              { title: 'Tên', dataIndex: 'name', ellipsis: true },
              { title: 'Danh mục', dataIndex: 'category_name', width: 120 },
              { title: 'Tồn kho', dataIndex: 'stock_quantity', width: 80, align: 'center',
                render: (v, r) => <Tag color={v <= r.min_stock_level ? 'red' : 'green'}>{v}</Tag> },
              { title: 'Tối thiểu', dataIndex: 'min_stock_level', width: 80, align: 'center' },
              { title: 'Giá vốn', dataIndex: 'cost_price', width: 130, align: 'right', render: v => formatVND(v) },
              { title: 'Giá trị', width: 140, align: 'right',
                render: (_, r) => formatVND(r.stock_quantity * r.cost_price) },
            ]}
          />
        </>
      ),
    },
    {
      key: 'customer-debt', label: '📋 Nợ KH',
      children: (
        <>
          <Button type="primary" onClick={() => loadReport('customer-debt')} style={{ marginBottom: 16 }}>
            Xem báo cáo công nợ khách hàng
          </Button>
          <Table dataSource={customerDebt} rowKey="customer_id" size="small" loading={loading}
            pagination={{ pageSize: 30 }}
            columns={[
              { title: 'Khách hàng', dataIndex: 'customer_name', ellipsis: true },
              { title: 'Nhóm', dataIndex: 'group_name', width: 130, render: v => <Tag>{v}</Tag> },
              { title: 'Tổng nợ', dataIndex: 'total_debt', width: 150, align: 'right',
                render: v => <span style={{ color: '#ff4d4f' }}>{formatVND(v)}</span> },
              { title: 'Đã trả', dataIndex: 'total_paid', width: 150, align: 'right', render: v => formatVND(v) },
              { title: 'Còn nợ', dataIndex: 'remaining', width: 150, align: 'right',
                render: v => <strong style={{ color: '#ff4d4f' }}>{formatVND(v)}</strong> },
            ]}
          />
        </>
      ),
    },
    {
      key: 'supplier-debt', label: '📋 Nợ NCC',
      children: (
        <>
          <Button type="primary" onClick={() => loadReport('supplier-debt')} style={{ marginBottom: 16 }}>
            Xem báo cáo công nợ NCC
          </Button>
          <Table dataSource={supplierDebt} rowKey="supplier_id" size="small" loading={loading}
            pagination={{ pageSize: 30 }}
            columns={[
              { title: 'Nhà cung cấp', dataIndex: 'supplier_name', ellipsis: true },
              { title: 'Tổng nợ', dataIndex: 'total_debt', width: 150, align: 'right',
                render: v => <span style={{ color: '#ff4d4f' }}>{formatVND(v)}</span> },
              { title: 'Đã trả', dataIndex: 'total_paid', width: 150, align: 'right', render: v => formatVND(v) },
              { title: 'Còn nợ', dataIndex: 'remaining', width: 150, align: 'right',
                render: v => <strong style={{ color: '#ff4d4f' }}>{formatVND(v)}</strong> },
            ]}
          />
        </>
      ),
    },
  ];

  return (
    <div>
      <Title level={4}>📊 Báo Cáo</Title>
      <Tabs items={tabItems} activeKey={activeTab} onChange={handleTabChange} />
    </div>
  );
}

export default ReportsPage;
