import React, { useEffect, useState } from 'react';
import {
  Table, Button, Tag, Space, Card, message, Row, Col, Typography,
  Select, DatePicker, Popconfirm, Descriptions, Modal, Tabs, Form, Input
} from 'antd';
import {
  PlusOutlined, EyeOutlined, SearchOutlined, FileTextOutlined,
  CloseCircleOutlined, PrinterOutlined, EditOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { salesOrdersAPI, invoicesAPI } from '../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

function formatVND(v) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
}

function SalesOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState(null);
  const [editVisible, setEditVisible] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [editForm] = Form.useForm();

  useEffect(() => { loadOrders(); }, [pagination.current, statusFilter, dateRange]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current, limit: pagination.pageSize,
        status: statusFilter || undefined,
      };
      if (dateRange) {
        params.from_date = dateRange[0].format('YYYY-MM-DD');
        params.to_date = dateRange[1].format('YYYY-MM-DD');
      }
      const res = await salesOrdersAPI.list(params);
      setOrders(res.data.data || []);
      setPagination(p => ({ ...p, total: res.data.pagination?.total || 0 }));
    } catch (e) {
      message.error('Lỗi tải danh sách đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  const showDetail = async (id) => {
    try {
      const res = await salesOrdersAPI.detail(id);
      setDetail(res.data);
      setDetailVisible(true);
    } catch (e) { message.error('Lỗi tải chi tiết'); }
  };

  const cancelOrder = async (id) => {
    try {
      await salesOrdersAPI.cancel(id);
      message.success('Đã hủy đơn hàng');
      loadOrders();
    } catch (e) { message.error(e.response?.data?.error || 'Lỗi hủy đơn'); }
  };

  const createInvoice = async (orderId) => {
    try {
      await invoicesAPI.createFromOrder(orderId);
      message.success('Tạo hóa đơn thành công');
    } catch (e) { message.error(e.response?.data?.error || 'Lỗi tạo hóa đơn'); }
  };

  const showEdit = async (record) => {
    try {
      const res = await salesOrdersAPI.detail(record.id);
      const order = res.data.data || res.data;
      setEditRecord(order);
      editForm.setFieldsValue({
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        notes: order.notes,
        delivery_address: order.delivery_address,
      });
      setEditVisible(true);
    } catch (e) { message.error('Lỗi tải chi tiết đơn hàng'); }
  };

  const handleEditSave = async () => {
    try {
      const values = await editForm.validateFields();
      await salesOrdersAPI.update(editRecord.id, values);
      message.success('Cập nhật đơn hàng thành công');
      setEditVisible(false);
      loadOrders();
    } catch (e) {
      if (e.response?.data?.error) {
        message.error(e.response.data.error);
      } else if (!e.errorFields) {
        message.error('Lỗi cập nhật đơn hàng');
      }
    }
  };

  const statusConfig = {
    pending: { color: 'orange', text: 'Chờ xử lý' },
    confirmed: { color: 'blue', text: 'Đã xác nhận' },
    completed: { color: 'green', text: 'Hoàn thành' },
    cancelled: { color: 'red', text: 'Đã hủy' },
  };

  const paymentConfig = {
    unpaid: { color: 'red', text: 'Chưa thanh toán' },
    partial: { color: 'orange', text: 'Thanh toán một phần' },
    paid: { color: 'green', text: 'Đã thanh toán' },
  };

  const columns = [
    { title: 'Mã đơn', dataIndex: 'order_number', width: 120 },
    { title: 'Ngày đặt', dataIndex: 'order_date', width: 110,
      render: v => dayjs(v).format('DD/MM/YYYY'),
    },
    { title: 'Khách hàng', dataIndex: 'customer_name', ellipsis: true },
    { title: 'Nhóm KH', dataIndex: 'group_name', width: 120,
      render: v => <Tag>{v}</Tag>,
    },
    { title: 'Tổng tiền', dataIndex: 'grand_total', width: 140, align: 'right',
      render: v => <strong>{formatVND(v)}</strong>,
    },
    { title: 'Đã trả', dataIndex: 'paid_amount', width: 130, align: 'right',
      render: v => formatVND(v),
    },
    { title: 'Trạng thái', dataIndex: 'status', width: 120,
      render: v => {
        const s = statusConfig[v] || {};
        return <Tag color={s.color}>{s.text || v}</Tag>;
      },
    },
    { title: 'Thanh toán', dataIndex: 'payment_status', width: 150,
      render: v => {
        const s = paymentConfig[v] || {};
        return <Tag color={s.color}>{s.text || v}</Tag>;
      },
    },
    {
      title: 'Thao tác', width: 180, align: 'center',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(r.id)}
            title="Xem chi tiết" />
          {r.status !== 'cancelled' && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => showEdit(r)}
              title="Sửa đơn hàng" />
          )}
          {r.status !== 'cancelled' && r.status !== 'completed' && (
            <Popconfirm title="Hủy đơn hàng này?" onConfirm={() => cancelOrder(r.id)}>
              <Button type="link" size="small" danger icon={<CloseCircleOutlined />} />
            </Popconfirm>
          )}
          {r.status === 'completed' && (
            <Button type="link" size="small" icon={<FileTextOutlined />}
              onClick={() => createInvoice(r.id)} title="Tạo hóa đơn" />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>🛒 Đơn Hàng Bán</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/sales-orders/new')}>
          Tạo đơn hàng
        </Button>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <RangePicker style={{ width: '100%' }} format="DD/MM/YYYY"
              onChange={v => { setDateRange(v); setPagination(p => ({ ...p, current: 1 })); }} />
          </Col>
          <Col xs={12} sm={6}>
            <Select placeholder="Trạng thái" allowClear style={{ width: '100%' }}
              onChange={v => { setStatusFilter(v || ''); setPagination(p => ({ ...p, current: 1 })); }}>
              <Select.Option value="pending">Chờ xử lý</Select.Option>
              <Select.Option value="confirmed">Đã xác nhận</Select.Option>
              <Select.Option value="completed">Hoàn thành</Select.Option>
              <Select.Option value="cancelled">Đã hủy</Select.Option>
            </Select>
          </Col>
        </Row>
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
          showTotal: t => `Tổng ${t} đơn hàng`,
          onChange: (page, ps) => setPagination(p => ({ ...p, current: page, pageSize: ps })),
        }}
        scroll={{ x: 1200 }}
      />

      {/* Modal chi tiết */}
      <Modal title={`Chi tiết đơn hàng ${detail?.order_number || ''}`}
        open={detailVisible} onCancel={() => setDetailVisible(false)}
        footer={null} width={800}>
        {detail && (
          <Tabs items={[
            {
              key: '1', label: 'Thông tin đơn',
              children: (
                <>
                  <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label="Mã đơn">{detail.order_number}</Descriptions.Item>
                    <Descriptions.Item label="Ngày">{dayjs(detail.order_date).format('DD/MM/YYYY')}</Descriptions.Item>
                    <Descriptions.Item label="Khách hàng">{detail.customer_name}</Descriptions.Item>
                    <Descriptions.Item label="Nhóm KH">{detail.group_name}</Descriptions.Item>
                    <Descriptions.Item label="Trạng thái">
                      <Tag color={statusConfig[detail.status]?.color}>{statusConfig[detail.status]?.text}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Thanh toán">
                      <Tag color={paymentConfig[detail.payment_status]?.color}>{paymentConfig[detail.payment_status]?.text}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Ghi chú" span={2}>{detail.notes || '-'}</Descriptions.Item>
                  </Descriptions>

                  <Table
                    style={{ marginTop: 16 }}
                    dataSource={detail.items || []}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    columns={[
                      { title: 'Sản phẩm', dataIndex: 'product_name', ellipsis: true,
                        render: (v, r) => v || r.service_plan_name,
                      },
                      { title: 'Loại', width: 90,
                        render: (_, r) => <Tag>{r.item_type === 'product' ? 'Thiết bị' : 'Gói cước'}</Tag>,
                      },
                      { title: 'SL', dataIndex: 'quantity', width: 50, align: 'center' },
                      { title: 'Đơn giá', dataIndex: 'unit_price', width: 120, align: 'right', render: v => formatVND(v) },
                      { title: 'Giảm giá', dataIndex: 'discount', width: 100, align: 'right', render: v => formatVND(v) },
                      { title: 'Thành tiền', dataIndex: 'total_price', width: 130, align: 'right',
                        render: v => <strong>{formatVND(v)}</strong>,
                      },
                    ]}
                    summary={() => (
                      <Table.Summary>
                        <Table.Summary.Row>
                          <Table.Summary.Cell colSpan={5} align="right"><strong>Tạm tính:</strong></Table.Summary.Cell>
                          <Table.Summary.Cell align="right"><strong>{formatVND(detail.subtotal)}</strong></Table.Summary.Cell>
                        </Table.Summary.Row>
                        <Table.Summary.Row>
                          <Table.Summary.Cell colSpan={5} align="right">VAT ({detail.vat_rate || 0}%):</Table.Summary.Cell>
                          <Table.Summary.Cell align="right">{formatVND(detail.vat_amount)}</Table.Summary.Cell>
                        </Table.Summary.Row>
                        <Table.Summary.Row>
                          <Table.Summary.Cell colSpan={5} align="right"><strong style={{ color: '#1677ff' }}>Tổng cộng:</strong></Table.Summary.Cell>
                          <Table.Summary.Cell align="right"><strong style={{ color: '#1677ff' }}>{formatVND(detail.grand_total)}</strong></Table.Summary.Cell>
                        </Table.Summary.Row>
                      </Table.Summary>
                    )}
                  />
                </>
              ),
            },
          ]} />
        )}
      </Modal>

      {/* Modal sửa đơn hàng */}
      <Modal title={`Sửa đơn hàng ${editRecord?.order_number || ''}`}
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={handleEditSave}
        okText="Lưu"
        cancelText="Hủy"
        width={650}
        destroyOnClose>
        <Form form={editForm} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Trạng thái" name="status">
                <Select>
                  <Select.Option value="pending">Chờ xử lý</Select.Option>
                  <Select.Option value="confirmed">Đã xác nhận</Select.Option>
                  <Select.Option value="completed">Hoàn thành</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Thanh toán" name="payment_status">
                <Select>
                  <Select.Option value="unpaid">Chưa thanh toán</Select.Option>
                  <Select.Option value="partial">Thanh toán một phần</Select.Option>
                  <Select.Option value="paid">Đã thanh toán</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Hình thức TT" name="payment_method">
                <Select>
                  <Select.Option value="cash">Tiền mặt</Select.Option>
                  <Select.Option value="transfer">Chuyển khoản</Select.Option>
                  <Select.Option value="debt">Công nợ</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Địa chỉ giao hàng" name="delivery_address">
            <Input />
          </Form.Item>
          <Form.Item label="Ghi chú" name="notes">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>

        {/* Hiển thị thông tin items (chỉ đọc) */}
        {editRecord && (
          <div style={{ marginTop: 8 }}>
            <strong>Khách hàng:</strong> {editRecord.customer_name}
            {editRecord.group_name && ` - ${editRecord.group_name}`}
            <br />
            <strong>Tổng tiền:</strong> {formatVND(editRecord.grand_total || editRecord.total_amount)}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default SalesOrdersPage;
