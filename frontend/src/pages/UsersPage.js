import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space, Card,
  Popconfirm, message, Row, Col, Typography
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UserOutlined
} from '@ant-design/icons';
import { usersAPI } from '../services/api';

const { Search } = Input;
const { Title } = Typography;

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => { loadUsers(); }, [pagination.current, search]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await usersAPI.list({
        page: pagination.current, limit: pagination.pageSize, search,
      });
      setUsers(res.data.data || []);
      setPagination(p => ({ ...p, total: res.data.pagination?.total || 0 }));
    } catch (e) { message.error('Lỗi tải người dùng'); } finally { setLoading(false); }
  };

  const openModal = (record = null) => {
    setEditing(record);
    if (record) {
      form.setFieldsValue({ ...record, password: undefined });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        if (!values.password) delete values.password;
        await usersAPI.update(editing.id, values);
        message.success('Cập nhật thành công');
      } else {
        await usersAPI.create(values);
        message.success('Thêm người dùng thành công');
      }
      setModalVisible(false);
      loadUsers();
    } catch (e) {
      if (e.response?.data?.error) message.error(e.response.data.error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await usersAPI.delete(id);
      message.success('Đã xóa');
      loadUsers();
    } catch (e) { message.error('Lỗi xóa người dùng'); }
  };

  const roleColor = (name) => {
    const map = {
      'Admin': 'red', 'Quản lý': 'purple', 'Kế toán': 'gold',
      'Kinh doanh': 'blue', 'Kho': 'green',
    };
    return map[name] || 'default';
  };

  const columns = [
    { title: 'Họ tên', dataIndex: 'full_name', ellipsis: true,
      render: v => <><UserOutlined style={{ marginRight: 4 }} />{v}</> },
    { title: 'Email', dataIndex: 'email', ellipsis: true },
    { title: 'Điện thoại', dataIndex: 'phone', width: 120 },
    { title: 'Vai trò', dataIndex: 'role_name', width: 120,
      render: v => <Tag color={roleColor(v)}>{v}</Tag> },
    { title: 'Trạng thái', dataIndex: 'is_active', width: 100,
      render: v => <Tag color={v ? 'green' : 'red'}>{v ? 'Hoạt động' : 'Khóa'}</Tag> },
    {
      title: 'Thao tác', width: 100, align: 'center',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Popconfirm title="Xóa người dùng này?" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>👤 Quản Lý Người Dùng</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Thêm người dùng
        </Button>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Search placeholder="Tìm tên, email..." allowClear style={{ width: 300 }}
          onSearch={v => { setSearch(v); setPagination(p => ({ ...p, current: 1 })); }}
          enterButton={<SearchOutlined />} />
      </Card>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: t => `Tổng ${t} người dùng`,
          onChange: (page, ps) => setPagination(p => ({ ...p, current: page, pageSize: ps })),
        }}
      />

      <Modal
        title={editing ? 'Sửa người dùng' : 'Thêm người dùng mới'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="full_name" label="Họ tên" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="username" label="Tên đăng nhập" tooltip="Để trống sẽ tự động tạo từ email">
            <Input placeholder="Tự động nếu để trống" />
          </Form.Item>
          <Form.Item name="email" label="Email"
            rules={[{ required: true }, { type: 'email', message: 'Email không hợp lệ' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Điện thoại">
            <Input />
          </Form.Item>
          <Form.Item name="password" label={editing ? 'Mật khẩu mới (để trống nếu giữ nguyên)' : 'Mật khẩu'}
            rules={editing ? [] : [{ required: true, min: 6, message: 'Tối thiểu 6 ký tự' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role_id" label="Vai trò" rules={[{ required: true }]}>
            <Select placeholder="Chọn vai trò">
              <Select.Option value={1}>Admin</Select.Option>
              <Select.Option value={2}>Quản lý</Select.Option>
              <Select.Option value={3}>Kế toán</Select.Option>
              <Select.Option value={4}>Kinh doanh</Select.Option>
              <Select.Option value={5}>Kho</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="is_active" label="Trạng thái" initialValue={true}>
            <Select>
              <Select.Option value={true}>Hoạt động</Select.Option>
              <Select.Option value={false}>Khóa</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default UsersPage;
