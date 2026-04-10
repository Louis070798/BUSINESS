import React, { useEffect, useState, useMemo } from 'react';
import {
  Button, Form, Input, InputNumber, Select, Card, message, Row, Col, Typography,
  Table, Space, Divider, DatePicker, Radio, Tag, AutoComplete
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SaveOutlined, ArrowLeftOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { customersAPI, productsAPI, servicePlansAPI, salesOrdersAPI } from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

function formatVND(v) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
}

function CreateSalesOrderPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [servicePlans, setServicePlans] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [items, setItems] = useState([]);
  const [vatRate, setVatRate] = useState(10);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [custRes, prodRes, planRes] = await Promise.all([
        customersAPI.list({ limit: 1000 }),
        productsAPI.list({ limit: 1000 }),
        servicePlansAPI.list({ limit: 1000 }),
      ]);
      setCustomers(custRes.data.data || []);
      setProducts(prodRes.data.data || []);
      setServicePlans(planRes.data.data || []);
    } catch (e) {
      message.error('Lỗi tải dữ liệu');
    }
  };

  const handleCustomerChange = (customerId) => {
    const cust = customers.find(c => c.id === customerId);
    setSelectedCustomer(cust);
    // Re-price existing items based on customer group
    if (cust && items.length > 0) {
      setItems(prev => prev.map(item => ({
        ...item,
        unit_price: getPrice(item._source, cust),
      })));
    }
  };

  const getPrice = (source, customer) => {
    if (!source || !customer) return 0;
    const groupName = customer.group_name || '';
    if (groupName.includes('cấp 1')) return source.agent_level1_price || source.retail_price;
    if (groupName.includes('cấp 2')) return source.agent_level2_price || source.retail_price;
    return source.retail_price;
  };

  const addProduct = (productId) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const exists = items.find(i => i.item_type === 'product' && i.product_id === productId);
    if (exists) {
      setItems(prev => prev.map(i =>
        i.item_type === 'product' && i.product_id === productId
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ));
      return;
    }
    const price = getPrice(prod, selectedCustomer);
    setItems(prev => [...prev, {
      key: `prod_${Date.now()}`,
      item_type: 'product',
      product_id: prod.id,
      service_plan_id: null,
      name: prod.name,
      code: prod.code,
      quantity: 1,
      unit_price: price,
      cost_price: prod.cost_price,
      discount: 0,
      stock: prod.stock_quantity,
      _source: prod,
    }]);
  };

  const addServicePlan = (planId) => {
    const plan = servicePlans.find(p => p.id === planId);
    if (!plan) return;
    const price = getPrice(plan, selectedCustomer);
    setItems(prev => [...prev, {
      key: `plan_${Date.now()}`,
      item_type: 'service_plan',
      product_id: null,
      service_plan_id: plan.id,
      name: plan.name,
      code: plan.code,
      quantity: 1,
      unit_price: price,
      cost_price: plan.cost_price,
      discount: 0,
      stock: null,
      _source: plan,
    }]);
  };

  const updateItem = (key, field, value) => {
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
  };

  const removeItem = (key) => {
    setItems(prev => prev.filter(i => i.key !== key));
  };

  const subtotal = useMemo(() =>
    items.reduce((sum, i) => sum + (i.unit_price * i.quantity - (i.discount || 0)), 0),
    [items]
  );

  const vatAmount = useMemo(() => subtotal * vatRate / 100, [subtotal, vatRate]);
  const totalAmount = useMemo(() => subtotal + vatAmount, [subtotal, vatAmount]);
  const totalProfit = useMemo(() =>
    items.reduce((sum, i) => sum + ((i.unit_price - i.cost_price) * i.quantity - (i.discount || 0)), 0),
    [items]
  );

  const handleSubmit = async () => {
    try {
      if (!selectedCustomer) {
        message.error('Vui lòng chọn khách hàng');
        return;
      }
      if (items.length === 0) {
        message.error('Vui lòng thêm ít nhất 1 sản phẩm');
        return;
      }
      // Validate stock
      for (const item of items) {
        if (item.item_type === 'product' && item.quantity > item.stock) {
          message.error(`Sản phẩm "${item.name}" không đủ tồn kho (còn ${item.stock})`);
          return;
        }
      }

      const values = form.getFieldsValue();
      setSaving(true);

      await salesOrdersAPI.create({
        customer_id: selectedCustomer.id,
        order_date: (values.order_date || dayjs()).format('YYYY-MM-DD'),
        payment_method: values.payment_method || 'debt',
        vat_rate: vatRate,
        notes: values.notes,
        items: items.map(i => ({
          item_type: i.item_type,
          product_id: i.product_id,
          service_plan_id: i.service_plan_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          cost_price: i.cost_price,
          discount: i.discount || 0,
        })),
      });

      message.success('Tạo đơn hàng thành công!');
      navigate('/sales-orders');
    } catch (e) {
      message.error(e.response?.data?.error || 'Lỗi tạo đơn hàng');
    } finally {
      setSaving(false);
    }
  };

  const itemColumns = [
    { title: '#', width: 40, render: (_, __, i) => i + 1 },
    {
      title: 'Sản phẩm / Gói cước', dataIndex: 'name', ellipsis: true,
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{v}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.code} | {r.item_type === 'product' ? 'Thiết bị' : 'Gói cước'}
            {r.stock !== null && ` | Kho: ${r.stock}`}
          </Text>
        </Space>
      ),
    },
    { title: 'SL', dataIndex: 'quantity', width: 80,
      render: (v, r) => (
        <InputNumber min={1} max={r.stock || 9999} value={v} size="small"
          onChange={val => updateItem(r.key, 'quantity', val)} />
      ),
    },
    { title: 'Đơn giá', dataIndex: 'unit_price', width: 150,
      render: (v, r) => (
        <InputNumber min={0} value={v} size="small" style={{ width: '100%' }}
          formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={v => v.replace(/,/g, '')}
          onChange={val => updateItem(r.key, 'unit_price', val)} />
      ),
    },
    { title: 'Giảm giá', dataIndex: 'discount', width: 120,
      render: (v, r) => (
        <InputNumber min={0} value={v} size="small" style={{ width: '100%' }}
          formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={v => v.replace(/,/g, '')}
          onChange={val => updateItem(r.key, 'discount', val)} />
      ),
    },
    { title: 'Thành tiền', width: 140, align: 'right',
      render: (_, r) => <strong>{formatVND(r.unit_price * r.quantity - (r.discount || 0))}</strong>,
    },
    { title: 'Lợi nhuận', width: 130, align: 'right',
      render: (_, r) => {
        const profit = (r.unit_price - r.cost_price) * r.quantity - (r.discount || 0);
        return <span style={{ color: profit >= 0 ? '#52c41a' : '#ff4d4f' }}>{formatVND(profit)}</span>;
      },
    },
    {
      title: '', width: 40,
      render: (_, r) => (
        <Button type="link" danger size="small" icon={<DeleteOutlined />}
          onClick={() => removeItem(r.key)} />
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/sales-orders')}>Quay lại</Button>
          <Title level={4} style={{ margin: 0 }}>📝 Tạo Đơn Hàng Mới</Title>
        </Space>
        <Button type="primary" icon={<SaveOutlined />} size="large"
          loading={saving} onClick={handleSubmit}>
          Lưu Đơn Hàng
        </Button>
      </Row>

      <Form form={form} layout="vertical" initialValues={{ order_date: dayjs(), payment_method: 'debt' }}>
        <Row gutter={16}>
          {/* Thông tin đơn */}
          <Col xs={24} md={16}>
            <Card title="Thông tin đơn hàng" size="small">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Khách hàng" required>
                    <Select
                      showSearch
                      placeholder="Chọn khách hàng"
                      optionFilterProp="children"
                      filterOption={(input, opt) => opt.children?.toLowerCase().includes(input.toLowerCase())}
                      onChange={handleCustomerChange}
                      style={{ width: '100%' }}
                    >
                      {customers.map(c => (
                        <Select.Option key={c.id} value={c.id}>
                          {c.customer_name || c.name} - {c.group_name || 'Chưa phân nhóm'} ({c.code})
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="order_date" label="Ngày đặt">
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="payment_method" label="Thanh toán">
                    <Select>
                      <Select.Option value="cash">Tiền mặt</Select.Option>
                      <Select.Option value="transfer">Chuyển khoản</Select.Option>
                      <Select.Option value="debt">Công nợ</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              {selectedCustomer && (
                <Card size="small" style={{ marginBottom: 16, background: '#f6ffed' }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Text type="secondary">Khách hàng:</Text> <Text strong>{selectedCustomer.customer_name || selectedCustomer.name}</Text>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary">Nhóm:</Text>{' '}
                      <Tag color="blue">{selectedCustomer.group_name}</Tag>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary">SĐT:</Text> {selectedCustomer.phone || '-'}
                    </Col>
                  </Row>
                </Card>
              )}

              {/* Thêm sản phẩm */}
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <Select
                    showSearch
                    placeholder="+ Thêm thiết bị..."
                    optionFilterProp="children"
                    filterOption={(input, opt) => opt.children?.toLowerCase().includes(input.toLowerCase())}
                    onChange={addProduct}
                    value={null}
                    style={{ width: '100%' }}
                  >
                    {products.filter(p => p.stock_quantity > 0).map(p => (
                      <Select.Option key={p.id} value={p.id}>
                        {p.name} ({p.code}) - Kho: {p.stock_quantity}
                      </Select.Option>
                    ))}
                  </Select>
                </Col>
                <Col span={12}>
                  <Select
                    showSearch
                    placeholder="+ Thêm gói cước..."
                    optionFilterProp="children"
                    filterOption={(input, opt) => opt.children?.toLowerCase().includes(input.toLowerCase())}
                    onChange={addServicePlan}
                    value={null}
                    style={{ width: '100%' }}
                  >
                    {servicePlans.map(p => (
                      <Select.Option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </Select.Option>
                    ))}
                  </Select>
                </Col>
              </Row>

              <Table
                columns={itemColumns}
                dataSource={items}
                rowKey="key"
                size="small"
                pagination={false}
                scroll={{ x: 900 }}
                locale={{ emptyText: 'Chưa có sản phẩm nào. Hãy chọn thiết bị hoặc gói cước ở trên.' }}
              />
            </Card>
          </Col>

          {/* Tổng kết */}
          <Col xs={24} md={8}>
            <Card title="Tổng kết đơn hàng" size="small">
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <Row justify="space-between">
                  <Text>Số dòng:</Text>
                  <Text strong>{items.length}</Text>
                </Row>
                <Row justify="space-between">
                  <Text>Tạm tính:</Text>
                  <Text strong>{formatVND(subtotal)}</Text>
                </Row>
                <Row justify="space-between" align="middle">
                  <Text>VAT:</Text>
                  <Space>
                    <Select value={vatRate} onChange={setVatRate} size="small" style={{ width: 70 }}>
                      <Select.Option value={0}>0%</Select.Option>
                      <Select.Option value={5}>5%</Select.Option>
                      <Select.Option value={8}>8%</Select.Option>
                      <Select.Option value={10}>10%</Select.Option>
                    </Select>
                    <Text>{formatVND(vatAmount)}</Text>
                  </Space>
                </Row>
                <Divider style={{ margin: '8px 0' }} />
                <Row justify="space-between">
                  <Title level={5} style={{ margin: 0, color: '#1677ff' }}>TỔNG CỘNG:</Title>
                  <Title level={5} style={{ margin: 0, color: '#1677ff' }}>{formatVND(totalAmount)}</Title>
                </Row>
                <Divider style={{ margin: '8px 0' }} />
                <Row justify="space-between">
                  <Text type="secondary">Lợi nhuận dự kiến:</Text>
                  <Text style={{ color: totalProfit >= 0 ? '#52c41a' : '#ff4d4f' }} strong>
                    {formatVND(totalProfit)}
                  </Text>
                </Row>
              </Space>
            </Card>

            <Card title="Ghi chú" size="small" style={{ marginTop: 16 }}>
              <Form.Item name="notes" noStyle>
                <Input.TextArea rows={4} placeholder="Ghi chú đơn hàng..." />
              </Form.Item>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
}

export default CreateSalesOrderPage;
