import React, { useEffect, useState } from 'react';
import {
  Table, Button, Tag, Space, Card, message, Row, Col, Typography,
  Tabs, Modal, Form, Input, InputNumber, Select, Alert, Statistic, DatePicker
} from 'antd';
import {
  DollarOutlined, WarningOutlined, ArrowUpOutlined, ArrowDownOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { paymentsAPI, customersAPI, suppliersAPI } from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Search } = Input;

function formatVND(v) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
}

function PaymentsPage() {
  const [receivables, setReceivables] = useState([]);
  const [payables, setPayables] = useState([]);
  const [overdue, setOverdue] = useState({ overdueReceivables: [], totalOverdueReceivable: 0 });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('receivables');
  const [receiveVisible, setReceiveVisible] = useState(false);
  const [payVisible, setPayVisible] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [receiveForm] = Form.useForm();
  const [payForm] = Form.useForm();

  useEffect(() => { loadAll(); loadCustomers(); loadSuppliers(); }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [recRes, payRes, overRes] = await Promise.all([
        paymentsAPI.receivables(),
        paymentsAPI.payables(),
        paymentsAPI.overdue().catch(() => ({ data: { overdueReceivables: [], totalOverdueReceivable: 0 } })),
      ]);
      setReceivables(recRes.data.data || []);
      setPayables(payRes.data.data || []);
      setOverdue(overRes.data || {});
    } catch (e) {
      message.error('Lỗi tải dữ liệu công nợ');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await customersAPI.list({ limit: 1000 });
      setCustomers(res.data.data || []);
    } catch (e) { console.error(e); }
  };

  const loadSuppliers = async () => {
    try {
      const res = await suppliersAPI.list({ limit: 1000 });
      setSuppliers(res.data.data || []);
    } catch (e) { console.error(e); }
  };

  const handleReceive = async () => {
    try {
      const values = await receiveForm.validateFields();
      values.payment_date = (values.payment_date || dayjs()).format('YYYY-MM-DD');
      await paymentsAPI.receive(values);
      message.success('Thu tiền thành công');
      setReceiveVisible(false);
      receiveForm.resetFields();
      loadAll();
    } catch (e) {
      if (e.response?.data?.error) message.error(e.response.data.error);
    }
  };

  const handlePay = async () => {
    try {
      const values = await payForm.validateFields();
      values.payment_date = (values.payment_date || dayjs()).format('YYYY-MM-DD');
      await paymentsAPI.pay(values);
      message.success('Trả tiền thành công');
      setPayVisible(false);
      payForm.resetFields();
      loadAll();
    } catch (e) {
      if (e.response?.data?.error) message.error(e.response.data.error);
    }
  };

  const statusColor = (s) => {
    const map = { outstanding: 'orange', pending: 'orange', partial: 'blue', paid: 'green', overdue: 'red' };
    return map[s] || 'default';
  };
  const statusText = (s) => {
    const map = { outstanding: 'Chưa trả', pending: 'Chưa trả', partial: 'Trả một phần', paid: 'Đã trả đủ', overdue: 'Quá hạn' };
    return map[s] || s;
  };

  const receivableColumns = [
    { title: 'Khách hàng', dataIndex: 'customer_name', ellipsis: true },
    { title: 'Mã đơn', dataIndex: 'order_number', width: 120,
      render: (v, r) => v || (r.invoice_number) || '-' },
    { title: 'Tổng nợ', dataIndex: 'original_amount', width: 140, align: 'right',
      render: v => formatVND(v) },
    { title: 'Đã trả', dataIndex: 'paid_amount', width: 140, align: 'right',
      render: v => formatVND(v) },
    { title: 'Còn lại', dataIndex: 'remaining_amount', width: 140, align: 'right',
      render: v => <span style={{ color: '#ff4d4f', fontWeight: 600 }}>
        {formatVND(v)}
      </span> },
    { title: 'Hạn trả', dataIndex: 'due_date', width: 110,
      render: v => {
        if (!v) return '-';
        const d = dayjs(v);
        return <span style={{ color: d.isBefore(dayjs()) ? '#ff4d4f' : undefined }}>
          {d.format('DD/MM/YYYY')}
        </span>;
      }
    },
    { title: 'Trạng thái', dataIndex: 'status', width: 120,
      render: v => <Tag color={statusColor(v)}>{statusText(v)}</Tag> },
  ];

  const payableColumns = [
    { title: 'Nhà cung cấp', dataIndex: 'supplier_name', ellipsis: true },
    { title: 'Mã đơn nhập', dataIndex: 'order_number', width: 130,
      render: (v, r) => v || '-' },
    { title: 'Tổng nợ', dataIndex: 'original_amount', width: 140, align: 'right',
      render: v => formatVND(v) },
    { title: 'Đã trả', dataIndex: 'paid_amount', width: 140, align: 'right',
      render: v => formatVND(v) },
    { title: 'Còn lại', dataIndex: 'remaining_amount', width: 140, align: 'right',
      render: v => <span style={{ color: '#ff4d4f', fontWeight: 600 }}>
        {formatVND(v)}
      </span> },
    { title: 'Hạn trả', dataIndex: 'due_date', width: 110,
      render: v => {
        if (!v) return '-';
        const d = dayjs(v);
        return <span style={{ color: d.isBefore(dayjs()) ? '#ff4d4f' : undefined }}>
          {d.format('DD/MM/YYYY')}
        </span>;
      }
    },
    { title: 'Trạng thái', dataIndex: 'status', width: 120,
      render: v => <Tag color={statusColor(v)}>{statusText(v)}</Tag> },
  ];

  const totalReceivable = receivables.reduce((s, r) => s + parseFloat(r.remaining_amount || 0), 0);
  const totalPayable = payables.reduce((s, p) => s + parseFloat(p.remaining_amount || 0), 0);

  return (
    <div>
      <Title level={4}>💰 Quản Lý Công Nợ & Thanh Toán</Title>

      {overdue.totalOverdueReceivable > 0 && (
        <Alert
          message={`⚠️ Có ${overdue.overdueReceivables?.length || 0} khoản thu quá hạn, tổng: ${formatVND(overdue.totalOverdueReceivable)}`}
          type="error" showIcon closable style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Tổng phải thu" value={totalReceivable}
              formatter={v => formatVND(v)} prefix={<ArrowDownOutlined />}
              valueStyle={{ color: '#faad14', fontSize: 18 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Tổng phải trả" value={totalPayable}
              formatter={v => formatVND(v)} prefix={<ArrowUpOutlined />}
              valueStyle={{ color: '#ff4d4f', fontSize: 18 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Button type="primary" block icon={<ArrowDownOutlined />}
              onClick={() => { setReceiveVisible(true); receiveForm.resetFields(); }}>
              Thu tiền khách
            </Button>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Button block icon={<ArrowUpOutlined />}
              onClick={() => { setPayVisible(true); payForm.resetFields(); }}>
              Trả tiền NCC
            </Button>
          </Card>
        </Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab}
        items={[
          {
            key: 'receivables',
            label: `Công nợ phải thu (${receivables.length})`,
            children: (
              <Table columns={receivableColumns} dataSource={receivables}
                rowKey="id" loading={loading} size="small"
                pagination={{ pageSize: 20, showTotal: t => `Tổng ${t} khoản` }}
                scroll={{ x: 900 }} />
            ),
          },
          {
            key: 'payables',
            label: `Công nợ phải trả (${payables.length})`,
            children: (
              <Table columns={payableColumns} dataSource={payables}
                rowKey="id" loading={loading} size="small"
                pagination={{ pageSize: 20, showTotal: t => `Tổng ${t} khoản` }}
                scroll={{ x: 800 }} />
            ),
          },
        ]}
      />

      {/* Modal thu tiền */}
      <Modal title="Thu tiền khách hàng" open={receiveVisible}
        onOk={handleReceive} onCancel={() => setReceiveVisible(false)}
        okText="Xác nhận thu" cancelText="Hủy">
        <Form form={receiveForm} layout="vertical"
          initialValues={{ payment_date: dayjs(), payment_method: 'cash' }}>
          <Form.Item name="customer_id" label="Khách hàng" rules={[{ required: true }]}>
            <Select showSearch placeholder="Chọn khách hàng"
              optionFilterProp="children"
              filterOption={(input, opt) => opt.children?.toLowerCase().includes(input.toLowerCase())}>
              {customers.map(c => (
                <Select.Option key={c.id} value={c.id}>{c.customer_name || c.name} - {c.group_name || 'Chưa phân nhóm'} ({c.code})</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="amount" label="Số tiền thu" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={1}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => v.replace(/,/g, '')} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="payment_method" label="Hình thức">
                <Select>
                  <Select.Option value="cash">Tiền mặt</Select.Option>
                  <Select.Option value="transfer">Chuyển khoản</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="payment_date" label="Ngày thu">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal trả tiền NCC */}
      <Modal title="Trả tiền nhà cung cấp" open={payVisible}
        onOk={handlePay} onCancel={() => setPayVisible(false)}
        okText="Xác nhận trả" cancelText="Hủy">
        <Form form={payForm} layout="vertical"
          initialValues={{ payment_date: dayjs(), payment_method: 'transfer' }}>
          <Form.Item name="supplier_id" label="Nhà cung cấp" rules={[{ required: true }]}>
            <Select showSearch placeholder="Chọn NCC"
              optionFilterProp="children"
              filterOption={(input, opt) => opt.children?.toLowerCase().includes(input.toLowerCase())}>
              {suppliers.map(s => (
                <Select.Option key={s.id} value={s.id}>{s.name} ({s.code})</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="amount" label="Số tiền trả" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={1}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={v => v.replace(/,/g, '')} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="payment_method" label="Hình thức">
                <Select>
                  <Select.Option value="cash">Tiền mặt</Select.Option>
                  <Select.Option value="transfer">Chuyển khoản</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="payment_date" label="Ngày trả">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default PaymentsPage;
