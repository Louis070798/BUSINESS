import React, { useEffect, useState } from 'react';
import {
  Table, Card, Tag, Space, message, Row, Col, Typography, Select,
  Statistic, DatePicker, Modal, Form, InputNumber, Input, Button
} from 'antd';
import {
  InboxOutlined, SwapOutlined, PlusCircleOutlined, MinusCircleOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { inventoryAPI } from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Search } = Input;
const { RangePicker } = DatePicker;

function formatVND(v) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
}

function InventoryPage() {
  const [summary, setSummary] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [adjustVisible, setAdjustVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => { loadSummary(); }, []);
  useEffect(() => { loadTransactions(); }, [pagination.current, typeFilter, search]);

  const loadSummary = async () => {
    try {
      const res = await inventoryAPI.summary();
      setSummary(res.data);
    } catch (e) { console.error(e); }
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const res = await inventoryAPI.transactions({
        page: pagination.current, limit: pagination.pageSize,
        type: typeFilter || undefined, search,
      });
      setTransactions(res.data.data || []);
      setPagination(p => ({ ...p, total: res.data.pagination?.total || 0 }));
    } catch (e) { message.error('Lỗi tải dữ liệu kho'); } finally { setLoading(false); }
  };

  const handleAdjust = async () => {
    try {
      const values = await form.validateFields();
      await inventoryAPI.adjust(values);
      message.success('Điều chỉnh tồn kho thành công');
      setAdjustVisible(false);
      form.resetFields();
      loadSummary();
      loadTransactions();
    } catch (e) {
      if (e.response?.data?.error) message.error(e.response.data.error);
    }
  };

  const txTypeConfig = {
    sale: { color: 'red', text: 'Bán hàng', icon: <MinusCircleOutlined /> },
    purchase: { color: 'green', text: 'Nhập hàng', icon: <PlusCircleOutlined /> },
    adjustment_in: { color: 'blue', text: 'Điều chỉnh tăng', icon: <PlusCircleOutlined /> },
    adjustment_out: { color: 'orange', text: 'Điều chỉnh giảm', icon: <MinusCircleOutlined /> },
    return: { color: 'purple', text: 'Trả hàng', icon: <SwapOutlined /> },
    cancel_restore: { color: 'cyan', text: 'Hoàn kho', icon: <PlusCircleOutlined /> },
  };

  const columns = [
    { title: 'Ngày', dataIndex: 'created_at', width: 140,
      render: v => dayjs(v).format('DD/MM/YYYY HH:mm') },
    { title: 'Sản phẩm', dataIndex: 'product_name', ellipsis: true },
    { title: 'Mã SP', dataIndex: 'product_code', width: 100 },
    { title: 'Loại', dataIndex: 'transaction_type', width: 140,
      render: v => {
        const cfg = txTypeConfig[v] || {};
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.text || v}</Tag>;
      }
    },
    { title: 'SL', dataIndex: 'quantity', width: 70, align: 'center',
      render: (v, r) => {
        const isIn = ['purchase', 'adjustment_in', 'return', 'cancel_restore'].includes(r.transaction_type);
        return <span style={{ color: isIn ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>
          {isIn ? '+' : '-'}{v}
        </span>;
      }
    },
    { title: 'Tồn trước', dataIndex: 'stock_before', width: 80, align: 'center' },
    { title: 'Tồn sau', dataIndex: 'stock_after', width: 80, align: 'center' },
    { title: 'Tham chiếu', dataIndex: 'reference_number', width: 130 },
    { title: 'Ghi chú', dataIndex: 'notes', ellipsis: true },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>🏭 Quản Lý Kho</Title>
        <Button type="primary" icon={<SwapOutlined />}
          onClick={() => { setAdjustVisible(true); form.resetFields(); }}>
          Điều chỉnh tồn kho
        </Button>
      </Row>

      {/* Thống kê kho */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Tổng SP" value={summary.totalProducts} prefix={<InboxOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Tổng tồn kho" value={summary.totalStock} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Giá trị tồn kho" value={summary.stockValue}
            formatter={v => formatVND(v)} valueStyle={{ fontSize: 18 }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="SP tồn thấp" value={summary.lowStockCount}
            valueStyle={{ color: '#ff4d4f' }} /></Card>
        </Col>
      </Row>

      {/* Bộ lọc */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Search placeholder="Tìm sản phẩm..." allowClear
              onSearch={v => { setSearch(v); setPagination(p => ({ ...p, current: 1 })); }}
              enterButton={<SearchOutlined />} />
          </Col>
          <Col xs={12} sm={6}>
            <Select placeholder="Loại giao dịch" allowClear style={{ width: '100%' }}
              onChange={v => { setTypeFilter(v || ''); setPagination(p => ({ ...p, current: 1 })); }}>
              <Select.Option value="sale">Bán hàng</Select.Option>
              <Select.Option value="purchase">Nhập hàng</Select.Option>
              <Select.Option value="adjustment_in">Điều chỉnh tăng</Select.Option>
              <Select.Option value="adjustment_out">Điều chỉnh giảm</Select.Option>
            </Select>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={transactions}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: t => `Tổng ${t} giao dịch`,
          onChange: (page, ps) => setPagination(p => ({ ...p, current: page, pageSize: ps })),
        }}
        scroll={{ x: 1000 }}
      />

      {/* Modal điều chỉnh */}
      <Modal title="Điều chỉnh tồn kho" open={adjustVisible}
        onOk={handleAdjust} onCancel={() => setAdjustVisible(false)}
        okText="Xác nhận" cancelText="Hủy">
        <Form form={form} layout="vertical">
          <Form.Item name="product_id" label="Sản phẩm" rules={[{ required: true }]}>
            <Select showSearch placeholder="Chọn sản phẩm"
              optionFilterProp="children"
              filterOption={(input, opt) => opt.children?.toLowerCase().includes(input.toLowerCase())}>
              {/* Products will be loaded from parent, for simplicity using inline */}
            </Select>
          </Form.Item>
          <Form.Item name="type" label="Loại điều chỉnh" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="adjustment_in">Tăng tồn kho</Select.Option>
              <Select.Option value="adjustment_out">Giảm tồn kho</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="Số lượng" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Lý do">
            <Input.TextArea rows={2} placeholder="Nhập lý do điều chỉnh..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default InventoryPage;
