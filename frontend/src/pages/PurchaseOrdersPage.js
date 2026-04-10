import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Select, Tag, Space,
  Card, message, Row, Col, Typography, DatePicker, Descriptions, Divider
} from 'antd';
import {
  PlusOutlined, EyeOutlined, SearchOutlined
} from '@ant-design/icons';
import { purchaseOrdersAPI, productsAPI, suppliersAPI } from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

function formatVND(v) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
}

function PurchaseOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [createVisible, setCreateVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form] = Form.useForm();
  const [poItems, setPoItems] = useState([]);

  useEffect(() => { loadOrders(); }, [pagination.current, statusFilter]);
  useEffect(() => { loadSuppliers(); loadProducts(); }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await purchaseOrdersAPI.list({
        page: pagination.current, limit: pagination.pageSize,
        status: statusFilter || undefined,
      });
      setOrders(res.data.data || []);
      setPagination(p => ({ ...p, total: res.data.pagination?.total || 0 }));
    } catch (e) { message.error('Lỗi tải đơn nhập'); } finally { setLoading(false); }
  };

  const loadSuppliers = async () => {
    try {
      const res = await suppliersAPI.list({ limit: 1000 });
      setSuppliers(res.data.data || []);
    } catch (e) { console.error(e); }
  };

  const loadProducts = async () => {
    try {
      const res = await productsAPI.list({ limit: 1000 });
      setProducts(res.data.data || []);
    } catch (e) { console.error(e); }
  };

  const showDetail = async (id) => {
    try {
      const res = await purchaseOrdersAPI.detail(id);
      setDetail(res.data);
      setDetailVisible(true);
    } catch (e) { message.error('Lỗi tải chi tiết'); }
  };

  const addPOItem = (productId) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const exists = poItems.find(i => i.product_id === productId);
    if (exists) {
      setPoItems(prev => prev.map(i =>
        i.product_id === productId ? { ...i, quantity: i.quantity + 1 } : i
      ));
      return;
    }
    setPoItems(prev => [...prev, {
      key: Date.now(),
      product_id: prod.id,
      name: prod.name,
      code: prod.code,
      quantity: 1,
      unit_price: prod.cost_price,
    }]);
  };

  const updatePOItem = (key, field, value) => {
    setPoItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
  };

  const removePOItem = (key) => {
    setPoItems(prev => prev.filter(i => i.key !== key));
  };

  const poTotal = poItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      if (poItems.length === 0) {
        message.error('Thêm ít nhất 1 sản phẩm');
        return;
      }
      await purchaseOrdersAPI.create({
        supplier_id: values.supplier_id,
        order_date: (values.order_date || dayjs()).format('YYYY-MM-DD'),
        payment_method: values.payment_method || 'debt',
        notes: values.notes,
        items: poItems.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      });
      message.success('Tạo đơn nhập thành công');
      setCreateVisible(false);
      setPoItems([]);
      form.resetFields();
      loadOrders();
    } catch (e) {
      if (e.response?.data?.error) message.error(e.response.data.error);
    }
  };

  const statusConfig = {
    pending: { color: 'orange', text: 'Chờ xử lý' },
    received: { color: 'green', text: 'Đã nhận' },
    cancelled: { color: 'red', text: 'Đã hủy' },
  };

  const columns = [
    { title: 'Mã đơn nhập', dataIndex: 'order_number', width: 130 },
    { title: 'Ngày nhập', dataIndex: 'order_date', width: 110,
      render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Nhà cung cấp', dataIndex: 'supplier_name', ellipsis: true },
    { title: 'Tổng tiền', dataIndex: 'total_amount', width: 150, align: 'right',
      render: v => <strong>{formatVND(v)}</strong> },
    { title: 'Trạng thái', dataIndex: 'status', width: 120,
      render: v => <Tag color={statusConfig[v]?.color}>{statusConfig[v]?.text || v}</Tag> },
    {
      title: 'Thao tác', width: 80, align: 'center',
      render: (_, r) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(r.id)} />
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>📥 Đơn Nhập Hàng</Title>
        <Button type="primary" icon={<PlusOutlined />}
          onClick={() => { setCreateVisible(true); form.resetFields(); setPoItems([]); }}>
          Tạo đơn nhập
        </Button>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Select placeholder="Trạng thái" allowClear style={{ width: 200 }}
          onChange={v => { setStatusFilter(v || ''); setPagination(p => ({ ...p, current: 1 })); }}>
          <Select.Option value="pending">Chờ xử lý</Select.Option>
          <Select.Option value="received">Đã nhận</Select.Option>
          <Select.Option value="cancelled">Đã hủy</Select.Option>
        </Select>
      </Card>

      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: t => `Tổng ${t} đơn nhập`,
          onChange: (page, ps) => setPagination(p => ({ ...p, current: page, pageSize: ps })),
        }}
        scroll={{ x: 700 }}
      />

      {/* Modal tạo đơn nhập */}
      <Modal title="Tạo đơn nhập hàng" open={createVisible}
        onOk={handleCreate} onCancel={() => setCreateVisible(false)}
        width={800} okText="Tạo đơn nhập" cancelText="Hủy">
        <Form form={form} layout="vertical" initialValues={{ order_date: dayjs(), payment_method: 'debt' }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="supplier_id" label="Nhà cung cấp" rules={[{ required: true }]}>
                <Select showSearch placeholder="Chọn NCC"
                  optionFilterProp="children"
                  filterOption={(input, opt) => opt.children?.toLowerCase().includes(input.toLowerCase())}>
                  {suppliers.map(s => (
                    <Select.Option key={s.id} value={s.id}>{s.name} ({s.code})</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="order_date" label="Ngày nhập">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="payment_method" label="Thanh toán">
                <Select>
                  <Select.Option value="cash">Tiền mặt</Select.Option>
                  <Select.Option value="transfer">Chuyển khoản</Select.Option>
                  <Select.Option value="debt">Công nợ</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Select showSearch placeholder="+ Thêm sản phẩm..." style={{ width: '100%', marginBottom: 16 }}
            optionFilterProp="children"
            filterOption={(input, opt) => opt.children?.toLowerCase().includes(input.toLowerCase())}
            onChange={addPOItem} value={null}>
            {products.map(p => (
              <Select.Option key={p.id} value={p.id}>{p.name} ({p.code})</Select.Option>
            ))}
          </Select>

          <Table dataSource={poItems} rowKey="key" size="small" pagination={false}
            columns={[
              { title: 'Sản phẩm', dataIndex: 'name', ellipsis: true },
              { title: 'SL', dataIndex: 'quantity', width: 80,
                render: (v, r) => <InputNumber min={1} value={v} size="small"
                  onChange={val => updatePOItem(r.key, 'quantity', val)} /> },
              { title: 'Đơn giá', dataIndex: 'unit_price', width: 150,
                render: (v, r) => <InputNumber min={0} value={v} size="small" style={{ width: '100%' }}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/,/g, '')}
                  onChange={val => updatePOItem(r.key, 'unit_price', val)} /> },
              { title: 'Thành tiền', width: 130, align: 'right',
                render: (_, r) => formatVND(r.unit_price * r.quantity) },
              { title: '', width: 40,
                render: (_, r) => <Button type="link" danger size="small"
                  onClick={() => removePOItem(r.key)}>Xóa</Button> },
            ]}
          />
          <Row justify="end" style={{ marginTop: 12 }}>
            <Title level={5} style={{ color: '#1677ff' }}>Tổng: {formatVND(poTotal)}</Title>
          </Row>
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal chi tiết */}
      <Modal title={`Chi tiết đơn nhập ${detail?.order_number || ''}`}
        open={detailVisible} onCancel={() => setDetailVisible(false)} footer={null} width={700}>
        {detail && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Mã đơn">{detail.order_number}</Descriptions.Item>
              <Descriptions.Item label="Ngày">{dayjs(detail.order_date).format('DD/MM/YYYY')}</Descriptions.Item>
              <Descriptions.Item label="NCC">{detail.supplier_name}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={statusConfig[detail.status]?.color}>{statusConfig[detail.status]?.text}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Tổng tiền" span={2}>
                <strong>{formatVND(detail.total_amount)}</strong>
              </Descriptions.Item>
            </Descriptions>
            <Table style={{ marginTop: 16 }} dataSource={detail.items || []} rowKey="id"
              size="small" pagination={false}
              columns={[
                { title: 'Sản phẩm', dataIndex: 'product_name' },
                { title: 'SL', dataIndex: 'quantity', width: 60, align: 'center' },
                { title: 'Đơn giá', dataIndex: 'unit_price', width: 130, align: 'right', render: v => formatVND(v) },
                { title: 'Thành tiền', dataIndex: 'total_price', width: 140, align: 'right',
                  render: v => <strong>{formatVND(v)}</strong> },
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  );
}

export default PurchaseOrdersPage;
