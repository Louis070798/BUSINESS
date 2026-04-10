import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Select, Tag, Space,
  Card, Popconfirm, message, Row, Col, Typography, Upload, Dropdown
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  DownloadOutlined, UploadOutlined, FileExcelOutlined
} from '@ant-design/icons';
import { servicePlansAPI, dataAPI } from '../services/api';

const { Search } = Input;
const { Title } = Typography;

function formatVND(v) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
}

function ServicePlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => { loadPlans(); }, [pagination.current, search, typeFilter]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const res = await servicePlansAPI.list({
        page: pagination.current, limit: pagination.pageSize,
        search, plan_type: typeFilter || undefined,
      });
      setPlans(res.data.data || []);
      setPagination(p => ({ ...p, total: res.data.pagination?.total || 0 }));
    } catch (e) {
      message.error('Lỗi tải danh sách gói cước');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (record = null) => {
    setEditing(record);
    if (record) {
      form.setFieldsValue(record);
    } else {
      form.resetFields();
      form.setFieldsValue({ plan_type: 'monthly', billing_cycle_months: 1 });
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await servicePlansAPI.update(editing.id, values);
        message.success('Cập nhật thành công');
      } else {
        await servicePlansAPI.create(values);
        message.success('Thêm gói cước thành công');
      }
      setModalVisible(false);
      loadPlans();
    } catch (e) {
      if (e.response?.data?.error) message.error(e.response.data.error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await servicePlansAPI.delete(id);
      message.success('Đã xóa');
      loadPlans();
    } catch (e) { message.error('Lỗi xóa gói cước'); }
  };

  const handleExport = async (format = 'excel') => {
    try {
      const res = await dataAPI.exportServicePlans(format);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `danh_sach_goi_cuoc.${format === 'csv' ? 'csv' : 'xlsx'}`;
      link.click();
      window.URL.revokeObjectURL(url);
      message.success('Xuất file thành công');
    } catch (e) { message.error('Lỗi xuất file'); }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await dataAPI.downloadTemplate('service-plans');
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mau_import_goi_cuoc.xlsx';
      link.click();
      window.URL.revokeObjectURL(url);
      message.success('Tải mẫu thành công');
    } catch (e) { message.error('Lỗi tải file mẫu'); }
  };

  const handleImport = async (file) => {
    try {
      const res = await dataAPI.importServicePlans(file);
      message.success(res.data.message);
      if (res.data.errors?.length > 0) {
        Modal.warning({
          title: 'Một số dòng bị lỗi',
          content: res.data.errors.join('\n'),
        });
      }
      loadPlans();
    } catch (e) {
      message.error(e.response?.data?.error || 'Lỗi import file');
    }
    return false; // Prevent auto upload
  };

  const planTypeLabel = (t) => {
    const map = { monthly: 'Hàng tháng', quarterly: 'Hàng quý', yearly: 'Hàng năm' };
    return map[t] || t;
  };

  const planTypeColor = (t) => {
    const map = { monthly: 'blue', quarterly: 'purple', yearly: 'gold' };
    return map[t] || 'default';
  };

  const columns = [
    { title: 'Mã gói', dataIndex: 'code', width: 100 },
    { title: 'Tên gói cước', dataIndex: 'name', ellipsis: true },
    { title: 'Loại', dataIndex: 'plan_type', width: 110,
      render: v => <Tag color={planTypeColor(v)}>{planTypeLabel(v)}</Tag>,
    },
    { title: 'Chu kỳ (tháng)', dataIndex: 'billing_cycle_months', width: 120, align: 'center' },
    { title: 'Giá bán lẻ', dataIndex: 'retail_price', width: 130, align: 'right',
      render: v => formatVND(v),
    },
    { title: 'Giá ĐL1', dataIndex: 'agent_level1_price', width: 120, align: 'right',
      render: v => formatVND(v),
    },
    { title: 'Giá ĐL2', dataIndex: 'agent_level2_price', width: 120, align: 'right',
      render: v => formatVND(v),
    },
    { title: 'Giá vốn', dataIndex: 'cost_price', width: 120, align: 'right',
      render: v => formatVND(v),
    },
    { title: 'TB đang dùng', dataIndex: 'active_subscriptions', width: 110, align: 'center',
      render: v => <Tag color="green">{v || 0}</Tag>,
    },
    {
      title: 'Thao tác', width: 100, align: 'center',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Popconfirm title="Xóa gói cước này?" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>📋 Quản Lý Gói Cước</Title>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
            Tải mẫu Excel
          </Button>
          <Upload
            accept=".xlsx,.xls,.csv"
            showUploadList={false}
            beforeUpload={handleImport}
          >
            <Button icon={<UploadOutlined />}>Import</Button>
          </Upload>
          <Dropdown menu={{
            items: [
              { key: 'excel', label: 'Xuất Excel (.xlsx)', icon: <FileExcelOutlined /> },
              { key: 'csv', label: 'Xuất CSV (.csv)', icon: <DownloadOutlined /> },
            ],
            onClick: ({ key }) => handleExport(key),
          }}>
            <Button icon={<DownloadOutlined />}>Export</Button>
          </Dropdown>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            Thêm gói cước
          </Button>
        </Space>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={10}>
            <Search placeholder="Tìm tên, mã gói cước..." allowClear
              onSearch={v => { setSearch(v); setPagination(p => ({ ...p, current: 1 })); }}
              enterButton={<SearchOutlined />} />
          </Col>
          <Col xs={12} sm={6}>
            <Select placeholder="Loại gói" allowClear style={{ width: '100%' }}
              onChange={v => { setTypeFilter(v || ''); setPagination(p => ({ ...p, current: 1 })); }}>
              <Select.Option value="monthly">Hàng tháng</Select.Option>
              <Select.Option value="quarterly">Hàng quý</Select.Option>
              <Select.Option value="yearly">Hàng năm</Select.Option>
            </Select>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={plans}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: t => `Tổng ${t} gói cước`,
          onChange: (page, ps) => setPagination(p => ({ ...p, current: page, pageSize: ps })),
        }}
        scroll={{ x: 1100 }}
      />

      <Modal
        title={editing ? 'Sửa gói cước' : 'Thêm gói cước mới'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={650}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Tên gói cước" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="code" label="Mã gói">
                <Input placeholder="Tự động nếu để trống" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="plan_type" label="Loại gói" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="monthly">Hàng tháng</Select.Option>
                  <Select.Option value="quarterly">Hàng quý</Select.Option>
                  <Select.Option value="yearly">Hàng năm</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="billing_cycle_months" label="Chu kỳ (tháng)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={1} max={36} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="cost_price" label="Giá vốn" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/,/g, '')} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="retail_price" label="Giá bán lẻ" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/,/g, '')} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="agent_level1_price" label="Giá ĐL Cấp 1">
                <InputNumber style={{ width: '100%' }}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/,/g, '')} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="agent_level2_price" label="Giá ĐL Cấp 2">
                <InputNumber style={{ width: '100%' }}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/,/g, '')} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ServicePlansPage;
