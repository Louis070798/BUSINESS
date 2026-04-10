import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Space, Card,
  Popconfirm, message, Row, Col, Typography
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined
} from '@ant-design/icons';
import { suppliersAPI } from '../services/api';

const { Search } = Input;
const { Title } = Typography;

function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => { loadSuppliers(); }, [pagination.current, search]);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const res = await suppliersAPI.list({
        page: pagination.current, limit: pagination.pageSize, search,
      });
      setSuppliers(res.data.data || []);
      setPagination(p => ({ ...p, total: res.data.pagination?.total || 0 }));
    } catch (e) { message.error('Lỗi tải NCC'); } finally { setLoading(false); }
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
        await suppliersAPI.update(editing.id, values);
        message.success('Cập nhật thành công');
      } else {
        await suppliersAPI.create(values);
        message.success('Thêm NCC thành công');
      }
      setModalVisible(false);
      loadSuppliers();
    } catch (e) {
      if (e.response?.data?.error) message.error(e.response.data.error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await suppliersAPI.delete(id);
      message.success('Đã xóa');
      loadSuppliers();
    } catch (e) { message.error('Lỗi xóa NCC'); }
  };

  const columns = [
    { title: 'Mã NCC', dataIndex: 'code', width: 100 },
    { title: 'Tên nhà cung cấp', dataIndex: 'name', ellipsis: true },
    { title: 'Người liên hệ', dataIndex: 'contact_person', width: 150 },
    { title: 'Điện thoại', dataIndex: 'phone', width: 120 },
    { title: 'Email', dataIndex: 'email', width: 180, ellipsis: true },
    { title: 'Địa chỉ', dataIndex: 'address', ellipsis: true },
    {
      title: 'Thao tác', width: 100, align: 'center',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Popconfirm title="Xóa NCC này?" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>🏢 Nhà Cung Cấp</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Thêm NCC
        </Button>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Search placeholder="Tìm tên, mã NCC..." allowClear style={{ width: 300 }}
          onSearch={v => { setSearch(v); setPagination(p => ({ ...p, current: 1 })); }}
          enterButton={<SearchOutlined />} />
      </Card>

      <Table
        columns={columns}
        dataSource={suppliers}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: t => `Tổng ${t} NCC`,
          onChange: (page, ps) => setPagination(p => ({ ...p, current: page, pageSize: ps })),
        }}
        scroll={{ x: 800 }}
      />

      <Modal
        title={editing ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp mới'}
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
              <Form.Item name="name" label="Tên NCC" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="code" label="Mã NCC">
                <Input placeholder="Tự động nếu để trống" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contact_person" label="Người liên hệ">
                <Input />
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
    </div>
  );
}

export default SuppliersPage;
