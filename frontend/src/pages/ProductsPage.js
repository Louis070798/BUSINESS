import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Select, Tag, Space, Card,
  Popconfirm, message, Row, Col, Descriptions, Typography, Badge, Upload
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  SearchOutlined, WarningOutlined, UploadOutlined, DownloadOutlined
} from '@ant-design/icons';
import { productsAPI, dataAPI } from '../services/api';

const { Search } = Input;
const { Title } = Typography;

function formatVND(v) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
}

function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadProducts(); }, [pagination.current, search, catFilter, stockFilter]);

  const loadCategories = async () => {
    try {
      const res = await productsAPI.getCategories();
      setCategories(res.data.data || []);
    } catch (e) { console.error(e); }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await productsAPI.list({
        page: pagination.current, limit: pagination.pageSize,
        search, category_id: catFilter || undefined,
        low_stock: stockFilter === 'low' ? true : undefined,
      });
      setProducts(res.data.data || []);
      setPagination(p => ({ ...p, total: res.data.pagination?.total || 0 }));
    } catch (e) {
      message.error('Lỗi tải danh sách sản phẩm');
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
      form.setFieldsValue({ type: 'equipment', unit: 'Cái', min_stock_level: 5 });
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await productsAPI.update(editing.id, values);
        message.success('Cập nhật thành công');
      } else {
        await productsAPI.create(values);
        message.success('Thêm sản phẩm thành công');
      }
      setModalVisible(false);
      loadProducts();
    } catch (e) {
      if (e.response?.data?.error) message.error(e.response.data.error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await productsAPI.delete(id);
      message.success('Đã xóa');
      loadProducts();
    } catch (e) { message.error('Lỗi xóa sản phẩm'); }
  };

  const showDetail = (record) => {
    setDetail(record);
    setDetailVisible(true);
  };

  const handleExport = async (format) => {
    try {
      const res = await dataAPI.exportProducts(format);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `products.${format === 'excel' ? 'xlsx' : 'csv'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('Xuất file thành công');
    } catch (e) { message.error('Lỗi xuất file'); }
  };

  const columns = [
    { title: 'Mã SP', dataIndex: 'code', width: 100 },
    {
      title: 'Tên sản phẩm', dataIndex: 'name', ellipsis: true,
      render: (v, r) => (
        <Space>
          <a onClick={() => showDetail(r)}>{v}</a>
          {r.stock_quantity <= r.min_stock_level && (
            <Badge count={<WarningOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />} />
          )}
        </Space>
      ),
    },
    { title: 'Danh mục', dataIndex: 'category_name', width: 120,
      render: v => <Tag>{v}</Tag>,
    },
    { title: 'Giá vốn', dataIndex: 'cost_price', width: 120, align: 'right',
      render: v => formatVND(v),
    },
    { title: 'Giá bán lẻ', dataIndex: 'retail_price', width: 120, align: 'right',
      render: v => formatVND(v),
    },
    { title: 'Giá ĐL1', dataIndex: 'agent_level1_price', width: 110, align: 'right',
      render: v => formatVND(v),
    },
    { title: 'Giá ĐL2', dataIndex: 'agent_level2_price', width: 110, align: 'right',
      render: v => formatVND(v),
    },
    { title: 'Tồn kho', dataIndex: 'stock_quantity', width: 80, align: 'center',
      render: (v, r) => (
        <Tag color={v <= r.min_stock_level ? 'red' : v <= r.min_stock_level * 2 ? 'orange' : 'green'}>
          {v}
        </Tag>
      ),
    },
    { title: 'ĐVT', dataIndex: 'unit', width: 60 },
    {
      title: 'Thao tác', width: 130, align: 'center',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(r)} />
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Popconfirm title="Xóa sản phẩm này?" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>📦 Quản Lý Sản Phẩm / Thiết Bị</Title>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={() => handleExport('excel')}>Xuất Excel</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Thêm sản phẩm</Button>
        </Space>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Search placeholder="Tìm tên, mã, serial, IMEI..." allowClear
              onSearch={v => { setSearch(v); setPagination(p => ({ ...p, current: 1 })); }}
              enterButton={<SearchOutlined />} />
          </Col>
          <Col xs={12} sm={4}>
            <Select placeholder="Danh mục" allowClear showSearch style={{ width: '100%' }}
              optionFilterProp="children"
              filterOption={(input, opt) => opt.children?.toLowerCase().includes(input.toLowerCase())}
              onChange={v => { setCatFilter(v || ''); setPagination(p => ({ ...p, current: 1 })); }}>
              {categories.map(c => (
                <Select.Option key={c.id} value={c.id}>{c.name} ({c.code})</Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={4}>
            <Select placeholder="Tồn kho" allowClear style={{ width: '100%' }}
              onChange={v => { setStockFilter(v || ''); setPagination(p => ({ ...p, current: 1 })); }}>
              <Select.Option value="low">Tồn kho thấp</Select.Option>
            </Select>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={products}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: t => `Tổng ${t} sản phẩm`,
          onChange: (page, ps) => setPagination(p => ({ ...p, current: page, pageSize: ps })),
        }}
        scroll={{ x: 1200 }}
      />

      {/* Modal thêm/sửa */}
      <Modal
        title={editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={700}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Tên sản phẩm" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="code" label="Mã SP">
                <Input placeholder="Tự động nếu để trống" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="category_id" label="Danh mục" rules={[{ required: true, message: 'Chọn danh mục' }]}>
                <Select placeholder="Chọn danh mục" showSearch allowClear
                  optionFilterProp="children"
                  filterOption={(input, opt) => opt.children?.toLowerCase().includes(input.toLowerCase())}>
                  {categories.map(c => (
                    <Select.Option key={c.id} value={c.id}>{c.name} ({c.code})</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="type" label="Loại">
                <Select>
                  <Select.Option value="equipment">Thiết bị</Select.Option>
                  <Select.Option value="accessory">Phụ kiện</Select.Option>
                  <Select.Option value="consumable">Vật tư</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="unit" label="Đơn vị tính">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="cost_price" label="Giá vốn" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/,/g, '')} min={0} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="retail_price" label="Giá bán lẻ" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/,/g, '')} min={0} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="agent_level1_price" label="Giá ĐL Cấp 1">
                <InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/,/g, '')} min={0} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="agent_level2_price" label="Giá ĐL Cấp 2">
                <InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v.replace(/,/g, '')} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="min_stock_level" label="Tồn kho tối thiểu">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="serial_number" label="Số Serial">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="imei" label="IMEI">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal chi tiết */}
      <Modal title="Chi tiết sản phẩm" open={detailVisible} onCancel={() => setDetailVisible(false)}
        footer={null} width={600}>
        {detail && (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="Mã SP">{detail.code}</Descriptions.Item>
            <Descriptions.Item label="Tên">{detail.name}</Descriptions.Item>
            <Descriptions.Item label="Danh mục">{detail.category_name}</Descriptions.Item>
            <Descriptions.Item label="Loại">{detail.type}</Descriptions.Item>
            <Descriptions.Item label="ĐVT">{detail.unit}</Descriptions.Item>
            <Descriptions.Item label="Serial">{detail.serial_number || '-'}</Descriptions.Item>
            <Descriptions.Item label="Giá vốn">{formatVND(detail.cost_price)}</Descriptions.Item>
            <Descriptions.Item label="Giá bán lẻ">{formatVND(detail.retail_price)}</Descriptions.Item>
            <Descriptions.Item label="Giá ĐL Cấp 1">{formatVND(detail.agent_level1_price)}</Descriptions.Item>
            <Descriptions.Item label="Giá ĐL Cấp 2">{formatVND(detail.agent_level2_price)}</Descriptions.Item>
            <Descriptions.Item label="Tồn kho">
              <Tag color={detail.stock_quantity <= detail.min_stock_level ? 'red' : 'green'}>
                {detail.stock_quantity}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Tối thiểu">{detail.min_stock_level}</Descriptions.Item>
            <Descriptions.Item label="Mô tả" span={2}>{detail.description || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}

export default ProductsPage;
