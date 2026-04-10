import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space, Card,
  Popconfirm, message, Row, Col, Descriptions, Tabs, Typography, Statistic
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  SearchOutlined, PhoneOutlined, MailOutlined, UserOutlined
} from '@ant-design/icons';
import { customersAPI } from '../services/api';

const { Search } = Input;
const { Title } = Typography;

function formatVND(v) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
}

function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [pagination.current, search, groupFilter]);

  const loadGroups = async () => {
    try {
      const res = await customersAPI.getGroups();
      setGroups(res.data.data || []);
    } catch (e) { console.error(e); }
  };

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const res = await customersAPI.list({
        page: pagination.current, limit: pagination.pageSize,
        search, group_id: groupFilter || undefined,
      });
      setCustomers(res.data.data || []);
      setPagination(p => ({ ...p, total: res.data.pagination?.total || 0 }));
    } catch (e) {
      message.error('Lỗi tải danh sách khách hàng');
    } finally {
      setLoading(false);
    }
  };

  const showDetail = async (id) => {
    try {
      const res = await customersAPI.detail(id);
      setDetail({ ...res.data.data, recentOrders: res.data.recentOrders, activeSubscriptions: res.data.activeSubscriptions, totalDebt: res.data.totalDebt });
      setDetailVisible(true);
    } catch (e) { message.error('Lỗi tải chi tiết'); }
  };

  const openModal = (record = null) => {
    setEditing(record);
    if (record) {
      form.setFieldsValue(record);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await customersAPI.update(editing.id, values);
        message.success('Cập nhật thành công');
      } else {
        await customersAPI.create(values);
        message.success('Thêm khách hàng thành công');
      }
      setModalVisible(false);
      loadCustomers();
    } catch (e) {
      if (e.response?.data?.error) message.error(e.response.data.error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await customersAPI.delete(id);
      message.success('Đã xóa');
      loadCustomers();
    } catch (e) { message.error('Lỗi xóa khách hàng'); }
  };

  const groupColor = (name) => {
    if (name?.includes('cấp 1')) return 'gold';
    if (name?.includes('cấp 2')) return 'blue';
    return 'green';
  };

  const columns = [
    { title: 'Mã KH', dataIndex: 'code', width: 100, sorter: true },
    { title: 'Tên khách hàng', dataIndex: 'customer_name', ellipsis: true,
      render: (v, r) => (
        <a onClick={() => showDetail(r.id)}>
          <UserOutlined style={{ marginRight: 4 }} />{v}
        </a>
      ),
    },
    { title: 'Nhóm KH', dataIndex: 'group_name', width: 130,
      render: v => <Tag color={groupColor(v)}>{v}</Tag>,
    },
    { title: 'Điện thoại', dataIndex: 'phone', width: 120,
      render: v => v ? <><PhoneOutlined /> {v}</> : '-',
    },
    { title: 'Email', dataIndex: 'email', width: 180, ellipsis: true,
      render: v => v ? <><MailOutlined /> {v}</> : '-',
    },
    { title: 'Địa chỉ', dataIndex: 'address', ellipsis: true },
    { title: 'Công nợ', dataIndex: 'total_debt', width: 130, align: 'right',
      render: v => v > 0 ? <span style={{ color: '#ff4d4f' }}>{formatVND(v)}</span> : formatVND(0),
    },
    {
      title: 'Thao tác', width: 130, align: 'center',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(r.id)} />
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Popconfirm title="Xóa khách hàng này?" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>👥 Quản Lý Khách Hàng</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Thêm khách hàng
        </Button>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={12} md={8}>
            <Search placeholder="Tìm tên, mã, SĐT..." allowClear
              onSearch={v => { setSearch(v); setPagination(p => ({ ...p, current: 1 })); }}
              enterButton={<SearchOutlined />} />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select placeholder="Nhóm khách hàng" allowClear style={{ width: '100%' }}
              onChange={v => { setGroupFilter(v || ''); setPagination(p => ({ ...p, current: 1 })); }}>
              {groups.map(g => (
                <Select.Option key={g.id} value={g.id}>{g.name} ({g.code})</Select.Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={customers}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: t => `Tổng ${t} khách hàng`,
          onChange: (page, pageSize) => setPagination(p => ({ ...p, current: page, pageSize })),
        }}
        scroll={{ x: 1100 }}
      />

      {/* Modal thêm/sửa */}
      <Modal
        title={editing ? 'Sửa khách hàng' : 'Thêm khách hàng mới'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={600}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="customer_name" label="Tên khách hàng" rules={[{ required: true, message: 'Nhập tên' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="code" label="Mã KH">
                <Input placeholder="Tự động nếu để trống" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="group_id" label="Nhóm KH" rules={[{ required: true, message: 'Chọn nhóm' }]}>
                <Select placeholder="Chọn nhóm">
                  {groups.map(g => (
                    <Select.Option key={g.id} value={g.id}>{g.name} ({g.code})</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Điện thoại">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Email không hợp lệ' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tax_code" label="Mã số thuế">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address" label="Địa chỉ">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal chi tiết */}
      <Modal
        title="Chi tiết khách hàng"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {detail && (
          <Tabs items={[
            {
              key: '1', label: 'Thông tin',
              children: (
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="Mã KH">{detail.code}</Descriptions.Item>
                  <Descriptions.Item label="Tên">{detail.customer_name}</Descriptions.Item>
                  <Descriptions.Item label="Nhóm">
                    <Tag color={groupColor(detail.group_name)}>{detail.group_name}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="SĐT">{detail.phone || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Email">{detail.email || '-'}</Descriptions.Item>
                  <Descriptions.Item label="MST">{detail.tax_code || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Địa chỉ" span={2}>{detail.address || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Ghi chú" span={2}>{detail.notes || '-'}</Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: '2', label: 'Đơn hàng',
              children: (
                <Table
                  dataSource={detail.recentOrders || []}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: 'Mã đơn', dataIndex: 'order_number' },
                    { title: 'Ngày', dataIndex: 'order_date', render: v => new Date(v).toLocaleDateString('vi-VN') },
                    { title: 'Tổng tiền', dataIndex: 'total_amount', render: v => formatVND(v) },
                    { title: 'Trạng thái', dataIndex: 'status',
                      render: v => <Tag color={v === 'completed' ? 'green' : v === 'pending' ? 'orange' : 'red'}>{v}</Tag>
                    },
                  ]}
                />
              ),
            },
            {
              key: '3', label: 'Thuê bao',
              children: (
                <Table
                  dataSource={detail.activeSubscriptions || []}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: 'Gói cước', dataIndex: 'plan_name' },
                    { title: 'Bắt đầu', dataIndex: 'start_date', render: v => new Date(v).toLocaleDateString('vi-VN') },
                    { title: 'Kết thúc', dataIndex: 'end_date', render: v => new Date(v).toLocaleDateString('vi-VN') },
                    { title: 'Trạng thái', dataIndex: 'status',
                      render: v => <Tag color={v === 'active' ? 'green' : 'red'}>{v}</Tag>
                    },
                  ]}
                />
              ),
            },
          ]} />
        )}
      </Modal>
    </div>
  );
}

export default CustomersPage;
