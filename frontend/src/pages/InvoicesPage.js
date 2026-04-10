import React, { useEffect, useState } from 'react';
import {
  Table, Button, Tag, Space, Card, message, Row, Col, Typography,
  Select, DatePicker, Modal, Descriptions, Form, Input, InputNumber, Popconfirm
} from 'antd';
import {
  FileTextOutlined, DownloadOutlined, EyeOutlined, PrinterOutlined,
  EditOutlined, DeleteOutlined, PlusOutlined
} from '@ant-design/icons';
import { invoicesAPI, customersAPI, dataAPI } from '../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

function formatVND(v) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
}

function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState(null);
  const [editVisible, setEditVisible] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [editForm] = Form.useForm();

  useEffect(() => { loadInvoices(); loadCustomers(); }, []);
  useEffect(() => { loadInvoices(); }, [pagination.current, statusFilter, dateRange]);

  const loadCustomers = async () => {
    try {
      const res = await customersAPI.list({ limit: 999 });
      setCustomers(res.data.data || []);
    } catch (e) { /* ignore */ }
  };

  const loadInvoices = async () => {
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
      const res = await invoicesAPI.list(params);
      setInvoices(res.data.data || []);
      setPagination(p => ({ ...p, total: res.data.pagination?.total || 0 }));
    } catch (e) { message.error('Lỗi tải hóa đơn'); } finally { setLoading(false); }
  };

  const showDetail = async (id) => {
    try {
      const res = await invoicesAPI.detail(id);
      setDetail(res.data);
      setDetailVisible(true);
    } catch (e) { message.error('Lỗi tải chi tiết'); }
  };

  const downloadPDF = async (id) => {
    try {
      const res = await dataAPI.invoicePDF(id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice_${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) { message.error('Lỗi tải PDF'); }
  };

  const showEdit = async (record) => {
    try {
      const res = await invoicesAPI.detail(record.id);
      const inv = res.data.data || res.data;
      setEditRecord(inv);
      editForm.setFieldsValue({
        customer_id: inv.customer_id,
        invoice_type: inv.invoice_type,
        invoice_date: inv.invoice_date ? dayjs(inv.invoice_date) : null,
        due_date: inv.due_date ? dayjs(inv.due_date) : null,
        status: inv.status,
        notes: inv.notes,
      });
      const items = res.data.items || [];
      setEditItems(items.map((it, idx) => ({
        key: idx,
        description: it.description || it.product_name || it.plan_name || '',
        quantity: it.quantity,
        unit_price: it.unit_price,
        tax_percent: it.tax_percent || 10,
        item_type: it.item_type,
        product_id: it.product_id,
        service_plan_id: it.service_plan_id,
      })));
      setEditVisible(true);
    } catch (e) { message.error('Lỗi tải chi tiết hóa đơn'); }
  };

  const handleEditSave = async () => {
    try {
      const values = await editForm.validateFields();
      const payload = {
        customer_id: values.customer_id,
        invoice_type: values.invoice_type,
        invoice_date: values.invoice_date?.format('YYYY-MM-DD'),
        due_date: values.due_date?.format('YYYY-MM-DD'),
        status: values.status,
        notes: values.notes,
        items: editItems.map(it => ({
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          tax_percent: it.tax_percent || 10,
          item_type: it.item_type || 'product',
          product_id: it.product_id,
          service_plan_id: it.service_plan_id,
        })),
      };
      await invoicesAPI.update(editRecord.id, payload);
      message.success('Cập nhật hóa đơn thành công');
      setEditVisible(false);
      loadInvoices();
    } catch (e) {
      if (e.response?.data?.error) {
        message.error(e.response.data.error);
      } else if (!e.errorFields) {
        message.error('Lỗi cập nhật hóa đơn');
      }
    }
  };

  const addEditItem = () => {
    setEditItems([...editItems, {
      key: Date.now(),
      description: '',
      quantity: 1,
      unit_price: 0,
      tax_percent: 10,
      item_type: 'product',
    }]);
  };

  const removeEditItem = (key) => {
    setEditItems(editItems.filter(it => it.key !== key));
  };

  const updateEditItem = (key, field, value) => {
    setEditItems(editItems.map(it => it.key === key ? { ...it, [field]: value } : it));
  };

  const typeConfig = {
    sales: { color: 'blue', text: 'Bán hàng' },
    subscription: { color: 'purple', text: 'Thuê bao' },
    service: { color: 'cyan', text: 'Dịch vụ' },
  };

  const statusConfig = {
    draft: { color: 'default', text: 'Nháp' },
    sent: { color: 'blue', text: 'Đã gửi' },
    paid: { color: 'green', text: 'Đã thanh toán' },
    overdue: { color: 'red', text: 'Quá hạn' },
    cancelled: { color: 'default', text: 'Đã hủy' },
  };

  const columns = [
    { title: 'Số HĐ', dataIndex: 'invoice_number', width: 130 },
    { title: 'Ngày', dataIndex: 'invoice_date', width: 110,
      render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Khách hàng', dataIndex: 'customer_name', ellipsis: true },
    { title: 'Loại', dataIndex: 'invoice_type', width: 100,
      render: v => <Tag color={typeConfig[v]?.color}>{typeConfig[v]?.text || v}</Tag> },
    { title: 'Tổng tiền', dataIndex: 'grand_total', width: 150, align: 'right',
      render: v => <strong>{formatVND(v)}</strong> },
    { title: 'Trạng thái', dataIndex: 'status', width: 130,
      render: v => <Tag color={statusConfig[v]?.color}>{statusConfig[v]?.text || v}</Tag> },
    {
      title: 'Thao tác', width: 150, align: 'center',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(r.id)}
            title="Xem chi tiết" />
          {r.status !== 'paid' && r.status !== 'cancelled' && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => showEdit(r)}
              title="Sửa hóa đơn" />
          )}
          <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => downloadPDF(r.id)}
            title="Tải PDF" />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>📄 Hóa Đơn</Title>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <RangePicker style={{ width: '100%' }} format="DD/MM/YYYY"
              onChange={v => { setDateRange(v); setPagination(p => ({ ...p, current: 1 })); }} />
          </Col>
          <Col xs={12} sm={5}>
            <Select placeholder="Trạng thái" allowClear style={{ width: '100%' }}
              onChange={v => { setStatusFilter(v || ''); setPagination(p => ({ ...p, current: 1 })); }}>
              <Select.Option value="draft">Nháp</Select.Option>
              <Select.Option value="sent">Đã gửi</Select.Option>
              <Select.Option value="paid">Đã TT</Select.Option>
              <Select.Option value="overdue">Quá hạn</Select.Option>
            </Select>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={invoices}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: t => `Tổng ${t} hóa đơn`,
          onChange: (page, ps) => setPagination(p => ({ ...p, current: page, pageSize: ps })),
        }}
        scroll={{ x: 800 }}
      />

      {/* Chi tiết hóa đơn */}
      <Modal title={`Hóa đơn ${detail?.invoice_number || ''}`}
        open={detailVisible} onCancel={() => setDetailVisible(false)}
        width={750}
        footer={[
          <Button key="pdf" icon={<DownloadOutlined />} onClick={() => downloadPDF(detail?.id)}>
            Tải PDF
          </Button>,
          <Button key="close" onClick={() => setDetailVisible(false)}>Đóng</Button>,
        ]}>
        {detail && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Số HĐ">{detail.invoice_number}</Descriptions.Item>
              <Descriptions.Item label="Ngày">{dayjs(detail.invoice_date).format('DD/MM/YYYY')}</Descriptions.Item>
              <Descriptions.Item label="Khách hàng">{detail.customer_name}</Descriptions.Item>
              <Descriptions.Item label="Loại">
                <Tag color={typeConfig[detail.invoice_type]?.color}>{typeConfig[detail.invoice_type]?.text}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={statusConfig[detail.status]?.color}>{statusConfig[detail.status]?.text}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Hạn thanh toán">
                {detail.due_date ? dayjs(detail.due_date).format('DD/MM/YYYY') : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Table style={{ marginTop: 16 }} dataSource={detail.items || []} rowKey="id"
              size="small" pagination={false}
              columns={[
                { title: 'Mô tả', dataIndex: 'description', ellipsis: true },
                { title: 'SL', dataIndex: 'quantity', width: 50, align: 'center' },
                { title: 'Đơn giá', dataIndex: 'unit_price', width: 130, align: 'right',
                  render: v => formatVND(v) },
                { title: 'Thành tiền', dataIndex: 'total_price', width: 140, align: 'right',
                  render: v => <strong>{formatVND(v)}</strong> },
              ]}
              summary={() => (
                <Table.Summary>
                  <Table.Summary.Row>
                    <Table.Summary.Cell colSpan={3} align="right"><strong>Tạm tính:</strong></Table.Summary.Cell>
                    <Table.Summary.Cell align="right">{formatVND(detail.subtotal)}</Table.Summary.Cell>
                  </Table.Summary.Row>
                  <Table.Summary.Row>
                    <Table.Summary.Cell colSpan={3} align="right">VAT:</Table.Summary.Cell>
                    <Table.Summary.Cell align="right">{formatVND(detail.vat_amount)}</Table.Summary.Cell>
                  </Table.Summary.Row>
                  <Table.Summary.Row>
                    <Table.Summary.Cell colSpan={3} align="right">
                      <strong style={{ color: '#1677ff', fontSize: 16 }}>TỔNG CỘNG:</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell align="right">
                      <strong style={{ color: '#1677ff', fontSize: 16 }}>{formatVND(detail.grand_total)}</strong>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </>
        )}
      </Modal>

      {/* Modal sửa hóa đơn */}
      <Modal title={`Sửa hóa đơn ${editRecord?.invoice_number || ''}`}
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={handleEditSave}
        okText="Lưu"
        cancelText="Hủy"
        width={850}
        destroyOnClose>
        <Form form={editForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Khách hàng" name="customer_id" rules={[{ required: true, message: 'Chọn khách hàng' }]}>
                <Select showSearch optionFilterProp="children" placeholder="Chọn khách hàng">
                  {customers.map(c => (
                    <Select.Option key={c.id} value={c.id}>
                      {c.customer_name} ({c.code})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Loại hóa đơn" name="invoice_type">
                <Select>
                  <Select.Option value="sales">Bán hàng</Select.Option>
                  <Select.Option value="subscription">Thuê bao</Select.Option>
                  <Select.Option value="service">Dịch vụ</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Ngày hóa đơn" name="invoice_date">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Hạn thanh toán" name="due_date">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Trạng thái" name="status">
                <Select>
                  <Select.Option value="draft">Nháp</Select.Option>
                  <Select.Option value="issued">Đã phát hành</Select.Option>
                  <Select.Option value="sent">Đã gửi</Select.Option>
                  <Select.Option value="overdue">Quá hạn</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Ghi chú" name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>

        {/* Danh sách items */}
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Chi tiết hóa đơn</strong>
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addEditItem}>
            Thêm dòng
          </Button>
        </div>
        <Table
          dataSource={editItems}
          rowKey="key"
          size="small"
          pagination={false}
          columns={[
            {
              title: 'Mô tả', dataIndex: 'description', width: 250,
              render: (v, r) => (
                <Input value={v} size="small"
                  onChange={e => updateEditItem(r.key, 'description', e.target.value)} />
              ),
            },
            {
              title: 'SL', dataIndex: 'quantity', width: 70, align: 'center',
              render: (v, r) => (
                <InputNumber value={v} min={1} size="small" style={{ width: '100%' }}
                  onChange={val => updateEditItem(r.key, 'quantity', val)} />
              ),
            },
            {
              title: 'Đơn giá', dataIndex: 'unit_price', width: 140, align: 'right',
              render: (v, r) => (
                <InputNumber value={v} min={0} size="small" style={{ width: '100%' }}
                  formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={val => val.replace(/,/g, '')}
                  onChange={val => updateEditItem(r.key, 'unit_price', val)} />
              ),
            },
            {
              title: 'VAT %', dataIndex: 'tax_percent', width: 80, align: 'center',
              render: (v, r) => (
                <InputNumber value={v} min={0} max={100} size="small" style={{ width: '100%' }}
                  onChange={val => updateEditItem(r.key, 'tax_percent', val)} />
              ),
            },
            {
              title: 'Thành tiền', width: 140, align: 'right',
              render: (_, r) => {
                const line = (r.unit_price || 0) * (r.quantity || 0);
                const tax = line * (r.tax_percent || 0) / 100;
                return <strong>{formatVND(line + tax)}</strong>;
              },
            },
            {
              title: '', width: 40, align: 'center',
              render: (_, r) => (
                <Button type="link" size="small" danger icon={<DeleteOutlined />}
                  onClick={() => removeEditItem(r.key)} />
              ),
            },
          ]}
          summary={() => {
            const subtotal = editItems.reduce((s, it) => s + (it.unit_price || 0) * (it.quantity || 0), 0);
            const tax = editItems.reduce((s, it) => {
              const line = (it.unit_price || 0) * (it.quantity || 0);
              return s + line * (it.tax_percent || 0) / 100;
            }, 0);
            return (
              <Table.Summary>
                <Table.Summary.Row>
                  <Table.Summary.Cell colSpan={4} align="right"><strong>Tạm tính:</strong></Table.Summary.Cell>
                  <Table.Summary.Cell align="right"><strong>{formatVND(subtotal)}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell />
                </Table.Summary.Row>
                <Table.Summary.Row>
                  <Table.Summary.Cell colSpan={4} align="right">VAT:</Table.Summary.Cell>
                  <Table.Summary.Cell align="right">{formatVND(tax)}</Table.Summary.Cell>
                  <Table.Summary.Cell />
                </Table.Summary.Row>
                <Table.Summary.Row>
                  <Table.Summary.Cell colSpan={4} align="right">
                    <strong style={{ color: '#1677ff', fontSize: 15 }}>TỔNG CỘNG:</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell align="right">
                    <strong style={{ color: '#1677ff', fontSize: 15 }}>{formatVND(subtotal + tax)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell />
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Modal>
    </div>
  );
}

export default InvoicesPage;
