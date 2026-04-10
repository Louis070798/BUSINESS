import React, { useEffect, useState } from 'react';
import {
  Table, Button, Tag, Space, Card, message, Row, Col, Typography,
  Modal, Form, Input, InputNumber, Select, DatePicker, Descriptions,
  Popconfirm, Statistic, Tooltip, Badge, Tabs, Divider, Alert
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  SearchOutlined, WifiOutlined, ReloadOutlined, CalendarOutlined,
  DollarOutlined, HistoryOutlined, FileTextOutlined
} from '@ant-design/icons';
import { starlinkAPI, customersAPI, servicePlansAPI, productsAPI } from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Search } = Input;

function formatVND(v) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
}

function StarlinkDevicesPage() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [stats, setStats] = useState({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState(null);
  const [billings, setBillings] = useState([]);

  // Gia hạn
  const [renewVisible, setRenewVisible] = useState(false);
  const [renewDevice, setRenewDevice] = useState(null);
  const [renewLoading, setRenewLoading] = useState(false);
  const [renewForm] = Form.useForm();

  const [customers, setCustomers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => { loadCustomers(); loadPlans(); loadProducts(); }, []);
  useEffect(() => { loadDevices(); }, [pagination.current, search, statusFilter]);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current, limit: pagination.pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
      };
      const res = await starlinkAPI.list(params);
      setDevices(res.data.data || []);
      setStats(res.data.stats || {});
      setPagination(p => ({ ...p, total: res.data.pagination?.total || 0 }));
    } catch (e) {
      message.error('Lỗi tải danh sách thiết bị');
    } finally { setLoading(false); }
  };

  const loadCustomers = async () => {
    try { const r = await customersAPI.list({ limit: 999 }); setCustomers(r.data.data || []); }
    catch (e) { /* ignore */ }
  };
  const loadPlans = async () => {
    try { const r = await servicePlansAPI.list({ limit: 999 }); setPlans(r.data.data || []); }
    catch (e) { /* ignore */ }
  };
  const loadProducts = async () => {
    try { const r = await productsAPI.list({ limit: 999 }); setProducts(r.data.data || []); }
    catch (e) { /* ignore */ }
  };

  const showAdd = () => {
    setEditRecord(null);
    form.resetFields();
    form.setFieldsValue({ device_model: 'Starlink Standard', status: 'active' });
    setModalVisible(true);
  };

  const showEdit = async (record) => {
    try {
      const res = await starlinkAPI.detail(record.id);
      const d = res.data.data || res.data;
      setEditRecord(d);
      form.setFieldsValue({
        ...d,
        install_date: d.install_date ? dayjs(d.install_date) : null,
        billing_start_date: d.billing_start_date ? dayjs(d.billing_start_date) : null,
        next_billing_date: d.next_billing_date ? dayjs(d.next_billing_date) : null,
      });
      setModalVisible(true);
    } catch (e) { message.error('Lỗi tải chi tiết'); }
  };

  const showDetail = async (record) => {
    try {
      const res = await starlinkAPI.detail(record.id);
      setDetail(res.data.data || res.data);
      setBillings(res.data.billings || []);
      setDetailVisible(true);
    } catch (e) { message.error('Lỗi tải chi tiết'); }
  };

  // Gia hạn
  const showRenew = (record) => {
    setRenewDevice(record);
    renewForm.resetFields();
    renewForm.setFieldsValue({
      months: 1,
      amount: parseFloat(record.monthly_fee) || 0,
    });
    setRenewVisible(true);
  };

  const handleRenew = async () => {
    try {
      const values = await renewForm.validateFields();
      setRenewLoading(true);
      const res = await starlinkAPI.renew(renewDevice.id, values);
      message.success(res.data.message || 'Gia hạn thành công');
      setRenewVisible(false);
      loadDevices();
    } catch (e) {
      if (e.response?.data?.error) message.error(e.response.data.error);
      else if (!e.errorFields) message.error('Lỗi gia hạn');
    } finally { setRenewLoading(false); }
  };

  const handleMonthsChange = (months) => {
    const fee = parseFloat(renewDevice?.monthly_fee) || 0;
    renewForm.setFieldsValue({ amount: fee });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        install_date: values.install_date?.format('YYYY-MM-DD') || null,
        billing_start_date: values.billing_start_date?.format('YYYY-MM-DD') || null,
        next_billing_date: values.next_billing_date?.format('YYYY-MM-DD') || null,
      };

      if (editRecord) {
        await starlinkAPI.update(editRecord.id, payload);
        message.success('Cập nhật thiết bị thành công');
      } else {
        await starlinkAPI.create(payload);
        message.success('Thêm thiết bị thành công');
      }
      setModalVisible(false);
      loadDevices();
    } catch (e) {
      if (e.response?.data?.error) message.error(e.response.data.error);
      else if (!e.errorFields) message.error('Lỗi lưu thiết bị');
    }
  };

  const handleDelete = async (id) => {
    try {
      await starlinkAPI.delete(id);
      message.success('Đã xóa thiết bị');
      loadDevices();
    } catch (e) { message.error('Lỗi xóa thiết bị'); }
  };

  const handlePlanChange = (planId) => {
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      form.setFieldsValue({ monthly_fee: parseFloat(plan.retail_price || 0) });
    }
  };

  const statusConfig = {
    active: { color: 'green', text: 'Hoạt động' },
    suspended: { color: 'orange', text: 'Tạm ngưng' },
    inactive: { color: 'default', text: 'Ngừng HĐ' },
    pending: { color: 'blue', text: 'Chờ kích hoạt' },
  };

  const columns = [
    {
      title: 'Mã KIT', dataIndex: 'kit_number', width: 160,
      render: (v, r) => (
        <Space>
          <Badge status={r.status === 'active' ? 'success' : r.status === 'suspended' ? 'warning' : 'default'} />
          <Text strong copyable={{ text: v }}>{v}</Text>
        </Space>
      ),
    },
    { title: 'Serial Number', dataIndex: 'serial_number', width: 150,
      render: v => v || <Text type="secondary">-</Text>,
    },
    { title: 'Account', dataIndex: 'account_number', width: 130,
      render: v => v || <Text type="secondary">-</Text>,
    },
    { title: 'Khách hàng', dataIndex: 'customer_name', ellipsis: true,
      render: (v, r) => v ? (
        <div>
          <div>{v}</div>
          {r.group_name && <Text type="secondary" style={{ fontSize: 12 }}>{r.group_name}</Text>}
        </div>
      ) : <Text type="secondary">Chưa gán</Text>,
    },
    { title: 'Gói cước', dataIndex: 'plan_name', width: 140,
      render: (v, r) => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">-</Text>,
    },
    { title: 'Phí/tháng', dataIndex: 'monthly_fee', width: 130, align: 'right',
      render: v => <Text strong>{formatVND(v)}</Text>,
    },
    { title: 'Ngày lắp', dataIndex: 'install_date', width: 110,
      render: v => v ? dayjs(v).format('DD/MM/YYYY') : '-',
    },
    { title: 'Hết hạn', dataIndex: 'subscription_end_date', width: 110,
      render: v => {
        if (!v) return '-';
        const d = dayjs(v);
        const isExpired = d.isBefore(dayjs());
        return <Text type={isExpired ? 'danger' : undefined}>{d.format('DD/MM/YYYY')}</Text>;
      },
    },
    { title: 'Trạng thái', dataIndex: 'status', width: 120,
      render: v => {
        const s = statusConfig[v] || {};
        return <Tag color={s.color}>{s.text || v}</Tag>;
      },
    },
    {
      title: 'Thao tác', width: 170, align: 'center', fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="Xem chi tiết">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(r)} />
          </Tooltip>
          <Tooltip title="Gia hạn">
            <Button type="link" size="small" style={{ color: '#52c41a' }}
              icon={<CalendarOutlined />} onClick={() => showRenew(r)} />
          </Tooltip>
          <Tooltip title="Sửa">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => showEdit(r)} />
          </Tooltip>
          <Popconfirm title="Xóa thiết bị này?" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>📡 Quản Lý Thiết Bị Starlink</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadDevices}>Làm mới</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={showAdd}>Thêm thiết bị</Button>
        </Space>
      </Row>

      {/* Thống kê */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Tổng thiết bị" value={stats.total || 0}
              prefix={<WifiOutlined />} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Đang hoạt động" value={stats.active || 0}
              valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Tạm ngưng" value={stats.suspended || 0}
              valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Tổng phí/tháng" value={stats.total_monthly_fee || 0}
              formatter={v => formatVND(v)}
              valueStyle={{ color: '#1677ff', fontSize: 16 }} />
          </Card>
        </Col>
      </Row>

      {/* Bộ lọc */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={10}>
            <Search placeholder="Tìm theo KIT, SN, Account, Khách hàng..."
              allowClear onSearch={v => { setSearch(v); setPagination(p => ({ ...p, current: 1 })); }}
              enterButton={<SearchOutlined />} />
          </Col>
          <Col xs={12} sm={5}>
            <Select placeholder="Trạng thái" allowClear style={{ width: '100%' }}
              onChange={v => { setStatusFilter(v || ''); setPagination(p => ({ ...p, current: 1 })); }}>
              <Select.Option value="active">Hoạt động</Select.Option>
              <Select.Option value="suspended">Tạm ngưng</Select.Option>
              <Select.Option value="inactive">Ngừng HĐ</Select.Option>
              <Select.Option value="pending">Chờ kích hoạt</Select.Option>
            </Select>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={devices}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: t => `Tổng ${t} thiết bị`,
          onChange: (page, ps) => setPagination(p => ({ ...p, current: page, pageSize: ps })),
        }}
        scroll={{ x: 1450 }}
      />

      {/* Modal Thêm / Sửa */}
      <Modal
        title={editRecord ? `Sửa thiết bị: ${editRecord.kit_number}` : 'Thêm thiết bị Starlink mới'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        okText="Lưu"
        cancelText="Hủy"
        width={750}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ device_model: 'Starlink Standard', status: 'active' }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Mã KIT" name="kit_number" rules={[{ required: true, message: 'Nhập mã KIT' }]}>
                <Input placeholder="VD: KIT-2024-001" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Serial Number" name="serial_number">
                <Input placeholder="SN thiết bị" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Account Number" name="account_number">
                <Input placeholder="Account Starlink" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Khách hàng" name="customer_id">
                <Select showSearch allowClear placeholder="Chọn khách hàng"
                  optionFilterProp="children"
                  filterOption={(input, opt) => opt.children?.toLowerCase().includes(input.toLowerCase())}>
                  {customers.map(c => (
                    <Select.Option key={c.id} value={c.id}>
                      {c.customer_name} ({c.code})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Thiết bị (sản phẩm)" name="product_id">
                <Select showSearch allowClear placeholder="Chọn loại thiết bị"
                  optionFilterProp="children"
                  filterOption={(input, opt) => opt.children?.toLowerCase().includes(input.toLowerCase())}>
                  {products.map(p => (
                    <Select.Option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Gói cước" name="service_plan_id">
                <Select showSearch allowClear placeholder="Chọn gói cước"
                  optionFilterProp="children" onChange={handlePlanChange}
                  filterOption={(input, opt) => opt.children?.toLowerCase().includes(input.toLowerCase())}>
                  {plans.map(p => (
                    <Select.Option key={p.id} value={p.id}>
                      {p.name} ({p.code}) - {formatVND(p.retail_price)}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Phí/tháng" name="monthly_fee">
                <InputNumber style={{ width: '100%' }} min={0}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/,/g, '')} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Trạng thái" name="status">
                <Select>
                  <Select.Option value="active">Hoạt động</Select.Option>
                  <Select.Option value="suspended">Tạm ngưng</Select.Option>
                  <Select.Option value="inactive">Ngừng HĐ</Select.Option>
                  <Select.Option value="pending">Chờ kích hoạt</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Model" name="device_model">
                <Select>
                  <Select.Option value="Starlink Standard">Starlink Standard</Select.Option>
                  <Select.Option value="Starlink Standard V2">Starlink Standard V2</Select.Option>
                  <Select.Option value="Starlink Standard V4">Starlink Standard V4</Select.Option>
                  <Select.Option value="Starlink Business">Starlink Business</Select.Option>
                  <Select.Option value="Starlink Mini">Starlink Mini</Select.Option>
                  <Select.Option value="Starlink Roam">Starlink Roam</Select.Option>
                  <Select.Option value="Starlink Maritime">Starlink Maritime</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Firmware" name="firmware_version">
                <Input placeholder="VD: v2024.10" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Ngày lắp đặt" name="install_date">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Ngày bắt đầu tính phí" name="billing_start_date">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Ngày thu phí tiếp theo" name="next_billing_date">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Địa chỉ lắp đặt" name="install_address">
            <Input placeholder="Địa chỉ nơi lắp thiết bị" />
          </Form.Item>

          <Form.Item label="Ghi chú" name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Chi tiết */}
      <Modal
        title={`📡 Chi tiết thiết bị: ${detail?.kit_number || ''}`}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="renew" type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }}
            icon={<CalendarOutlined />}
            onClick={() => { setDetailVisible(false); showRenew(detail); }}>Gia hạn</Button>,
          <Button key="edit" icon={<EditOutlined />}
            onClick={() => { setDetailVisible(false); showEdit(detail); }}>Sửa</Button>,
          <Button key="close" onClick={() => setDetailVisible(false)}>Đóng</Button>,
        ]}
        width={800}
      >
        {detail && (
          <Tabs defaultActiveKey="info" items={[
            {
              key: 'info',
              label: <span><WifiOutlined /> Thông tin</span>,
              children: (
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="Mã KIT" span={1}>
                    <Text strong copyable>{detail.kit_number}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Serial Number">{detail.serial_number || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Account Number">{detail.account_number || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Model">{detail.device_model || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Khách hàng" span={2}>
                    <Text strong>{detail.customer_name || 'Chưa gán'}</Text>
                    {detail.group_name && <Tag style={{ marginLeft: 8 }}>{detail.group_name}</Tag>}
                    {detail.customer_phone && <div style={{ fontSize: 12, color: '#888' }}>📱 {detail.customer_phone}</div>}
                  </Descriptions.Item>
                  <Descriptions.Item label="Gói cước">
                    {detail.plan_name ? <Tag color="blue">{detail.plan_name}</Tag> : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Phí/tháng">
                    <Text strong style={{ color: '#1677ff' }}>{formatVND(detail.monthly_fee)}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Trạng thái">
                    <Tag color={statusConfig[detail.status]?.color}>
                      {statusConfig[detail.status]?.text || detail.status}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Firmware">{detail.firmware_version || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Ngày lắp đặt">
                    {detail.install_date ? dayjs(detail.install_date).format('DD/MM/YYYY') : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Bắt đầu tính phí">
                    {detail.billing_start_date ? dayjs(detail.billing_start_date).format('DD/MM/YYYY') : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Hạn gói cước">
                    {detail.subscription_end_date ? (
                      <Text type={dayjs(detail.subscription_end_date).isBefore(dayjs()) ? 'danger' : 'success'} strong>
                        {dayjs(detail.subscription_end_date).format('DD/MM/YYYY')}
                        {dayjs(detail.subscription_end_date).isBefore(dayjs()) ? ' (Hết hạn)' : ''}
                      </Text>
                    ) : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Thu phí tiếp theo">
                    {detail.next_billing_date ? dayjs(detail.next_billing_date).format('DD/MM/YYYY') : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Thiết bị">{detail.product_name || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Địa chỉ lắp đặt" span={2}>{detail.install_address || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Ghi chú" span={2}>{detail.notes || '-'}</Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: 'billings',
              label: <span><HistoryOutlined /> Lịch sử gia hạn ({billings.length})</span>,
              children: (
                <div>
                  {billings.length === 0 ? (
                    <Alert message="Chưa có lịch sử gia hạn" type="info" showIcon />
                  ) : (
                    <Table
                      dataSource={billings}
                      rowKey="id"
                      size="small"
                      pagination={false}
                      columns={[
                        { title: 'Kỳ', width: 200,
                          render: (_, r) => (
                            <span>
                              {r.billing_period_start ? dayjs(r.billing_period_start).format('DD/MM/YYYY') : '?'}
                              {' → '}
                              {r.billing_period_end ? dayjs(r.billing_period_end).format('DD/MM/YYYY') : '?'}
                            </span>
                          ),
                        },
                        { title: 'Gói cước', dataIndex: 'plan_name', width: 120,
                          render: v => v ? <Tag color="blue">{v}</Tag> : '-',
                        },
                        { title: 'Số tiền', dataIndex: 'amount', width: 130, align: 'right',
                          render: v => <Text strong>{formatVND(v)}</Text>,
                        },
                        { title: 'Hoá đơn', dataIndex: 'invoice_number', width: 130,
                          render: v => v ? <Tag icon={<FileTextOutlined />} color="purple">{v}</Tag> : '-',
                        },
                        { title: 'TT thanh toán', dataIndex: 'payment_status', width: 120,
                          render: v => {
                            const map = {
                              paid: { color: 'green', text: 'Đã thanh toán' },
                              unpaid: { color: 'red', text: 'Chưa thanh toán' },
                              partial: { color: 'orange', text: 'Thanh toán 1 phần' },
                            };
                            const s = map[v] || {};
                            return v ? <Tag color={s.color}>{s.text || v}</Tag> : '-';
                          },
                        },
                        { title: 'Trạng thái', dataIndex: 'status', width: 100,
                          render: v => {
                            const map = {
                              billed: { color: 'blue', text: 'Đã tạo HĐ' },
                              pending: { color: 'gold', text: 'Chờ' },
                              paid: { color: 'green', text: 'Đã trả' },
                            };
                            const s = map[v] || {};
                            return <Tag color={s.color}>{s.text || v}</Tag>;
                          },
                        },
                        { title: 'Ngày tạo', dataIndex: 'created_at', width: 110,
                          render: v => v ? dayjs(v).format('DD/MM/YYYY') : '-',
                        },
                      ]}
                    />
                  )}
                </div>
              ),
            },
          ]} />
        )}
      </Modal>

      {/* Modal Gia hạn */}
      <Modal
        title={
          <Space>
            <CalendarOutlined style={{ color: '#52c41a' }} />
            <span>Gia hạn gói cước - KIT: {renewDevice?.kit_number}</span>
          </Space>
        }
        open={renewVisible}
        onCancel={() => setRenewVisible(false)}
        onOk={handleRenew}
        confirmLoading={renewLoading}
        okText="Xác nhận gia hạn"
        cancelText="Hủy"
        width={500}
      >
        {renewDevice && (
          <div>
            <Alert
              message={`Khách hàng: ${renewDevice.customer_name || 'Chưa gán'} | Gói: ${renewDevice.plan_name || 'Chưa có'}`}
              description={
                <div>
                  <div>Phí/tháng: <strong>{formatVND(renewDevice.monthly_fee)}</strong></div>
                  {renewDevice.subscription_end_date && (
                    <div>Hạn hiện tại: <strong>{dayjs(renewDevice.subscription_end_date).format('DD/MM/YYYY')}</strong>
                      {dayjs(renewDevice.subscription_end_date).isBefore(dayjs()) && <Tag color="red" style={{ marginLeft: 8 }}>Hết hạn</Tag>}
                    </div>
                  )}
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Form form={renewForm} layout="vertical">
              <Form.Item label="Số tháng gia hạn" name="months" rules={[{ required: true, message: 'Chọn số tháng' }]}>
                <Select onChange={handleMonthsChange}>
                  <Select.Option value={1}>1 tháng</Select.Option>
                  <Select.Option value={2}>2 tháng</Select.Option>
                  <Select.Option value={3}>3 tháng</Select.Option>
                  <Select.Option value={6}>6 tháng</Select.Option>
                  <Select.Option value={12}>12 tháng (1 năm)</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item label="Đơn giá / tháng (VNĐ)" name="amount" rules={[{ required: true, message: 'Nhập số tiền' }]}>
                <InputNumber style={{ width: '100%' }} min={0}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/,/g, '')} />
              </Form.Item>
              <Form.Item label="Ghi chú" name="notes">
                <Input.TextArea rows={2} placeholder="Ghi chú gia hạn (tuỳ chọn)" />
              </Form.Item>
            </Form>
            <Divider />
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary">Tổng tiền (chưa VAT): </Text>
              <Text strong style={{ fontSize: 16, color: '#1677ff' }}>
                {formatVND((renewForm.getFieldValue('amount') || 0) * (renewForm.getFieldValue('months') || 1))}
              </Text>
              <br />
              <Text type="secondary">VAT 10%: </Text>
              <Text>
                {formatVND(Math.round((renewForm.getFieldValue('amount') || 0) * (renewForm.getFieldValue('months') || 1) * 0.1))}
              </Text>
              <br />
              <Text type="secondary">Tổng thanh toán: </Text>
              <Text strong style={{ fontSize: 18, color: '#ff4d4f' }}>
                {formatVND(Math.round((renewForm.getFieldValue('amount') || 0) * (renewForm.getFieldValue('months') || 1) * 1.1))}
              </Text>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default StarlinkDevicesPage;
