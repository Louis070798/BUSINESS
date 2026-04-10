import React, { useEffect, useState } from 'react';
import {
  Table, Button, Tag, Space, Card, message, Row, Col, Typography,
  Alert, Popconfirm, DatePicker, Descriptions, Modal, Statistic
} from 'antd';
import {
  CalendarOutlined, ThunderboltOutlined, ReloadOutlined, EyeOutlined
} from '@ant-design/icons';
import { subscriptionsAPI } from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

function formatVND(v) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
}

function SubscriptionsPage() {
  const [subscriptions, setSubs] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [pendingBilling, setPendingBilling] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [activeTab, setActiveTab] = useState('all');
  const [billingLoading, setBillingLoading] = useState(false);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadSubs(); }, [pagination.current, activeTab]);

  const loadAll = async () => {
    try {
      const [expRes, pendRes] = await Promise.all([
        subscriptionsAPI.expiring(30).catch(() => ({ data: { data: [] } })),
        subscriptionsAPI.pendingBilling().catch(() => ({ data: { data: [] } })),
      ]);
      setExpiring(expRes.data?.data || []);
      setPendingBilling(pendRes.data?.data || []);
    } catch (e) { console.error(e); }
  };

  const loadSubs = async () => {
    try {
      setLoading(true);
      const params = { page: pagination.current, limit: pagination.pageSize };
      if (activeTab === 'expiring') params.status = 'active';
      const res = await subscriptionsAPI.list(params);
      setSubs(res.data.data || []);
      setPagination(p => ({ ...p, total: res.data.pagination?.total || 0 }));
    } catch (e) { message.error('Lỗi tải thuê bao'); } finally { setLoading(false); }
  };

  const handleBatchBilling = async () => {
    try {
      setBillingLoading(true);
      const res = await subscriptionsAPI.batchBilling();
      message.success(`Đã tạo ${res.data.createdCount || 0} hóa đơn gia hạn`);
      loadAll();
      loadSubs();
    } catch (e) {
      message.error(e.response?.data?.error || 'Lỗi tính cước hàng loạt');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleRenew = async (id) => {
    try {
      await subscriptionsAPI.renew(id);
      message.success('Gia hạn thành công');
      loadSubs();
      loadAll();
    } catch (e) { message.error(e.response?.data?.error || 'Lỗi gia hạn'); }
  };

  const statusConfig = {
    active: { color: 'green', text: 'Đang hoạt động' },
    expired: { color: 'red', text: 'Đã hết hạn' },
    suspended: { color: 'orange', text: 'Tạm ngưng' },
    cancelled: { color: 'default', text: 'Đã hủy' },
  };

  const columns = [
    { title: 'Khách hàng', dataIndex: 'customer_name', ellipsis: true },
    { title: 'Gói cước', dataIndex: 'plan_name', ellipsis: true },
    { title: 'Bắt đầu', dataIndex: 'start_date', width: 110,
      render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Kết thúc', dataIndex: 'end_date', width: 110,
      render: v => {
        const d = dayjs(v);
        const isExpiring = d.diff(dayjs(), 'day') <= 30 && d.isAfter(dayjs());
        const isExpired = d.isBefore(dayjs());
        return (
          <span style={{ color: isExpired ? '#ff4d4f' : isExpiring ? '#faad14' : undefined }}>
            {d.format('DD/MM/YYYY')}
          </span>
        );
      }
    },
    { title: 'Giá/Kỳ', dataIndex: 'billing_amount', width: 130, align: 'right',
      render: v => formatVND(v) },
    { title: 'Trạng thái', dataIndex: 'status', width: 130,
      render: v => <Tag color={statusConfig[v]?.color}>{statusConfig[v]?.text || v}</Tag> },
    { title: 'Tự gia hạn', dataIndex: 'auto_renew', width: 90, align: 'center',
      render: v => v ? <Tag color="green">Có</Tag> : <Tag>Không</Tag> },
    {
      title: 'Thao tác', width: 100, align: 'center',
      render: (_, r) => (
        <Space size="small">
          {r.status === 'active' && dayjs(r.end_date).diff(dayjs(), 'day') <= 30 && (
            <Popconfirm title="Gia hạn thuê bao này?" onConfirm={() => handleRenew(r.id)}>
              <Button type="link" size="small" icon={<ReloadOutlined />} title="Gia hạn" />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>📅 Quản Lý Thuê Bao</Title>
        <Popconfirm title={`Tính cước cho ${pendingBilling.length} thuê bao đến hạn?`}
          onConfirm={handleBatchBilling}>
          <Button type="primary" icon={<ThunderboltOutlined />}
            loading={billingLoading} disabled={pendingBilling.length === 0}>
            Tính cước hàng loạt ({pendingBilling.length})
          </Button>
        </Popconfirm>
      </Row>

      {/* Cảnh báo */}
      <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
        {expiring.length > 0 && (
          <Alert message={`📅 ${expiring.length} thuê bao sắp hết hạn trong 30 ngày tới`}
            type="warning" showIcon closable />
        )}
        {pendingBilling.length > 0 && (
          <Alert message={`💰 ${pendingBilling.length} thuê bao cần tính cước gia hạn`}
            type="info" showIcon closable />
        )}
      </Space>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Đang hoạt động"
            value={subscriptions.filter(s => s.status === 'active').length}
            valueStyle={{ color: '#52c41a' }} prefix={<CalendarOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Sắp hết hạn" value={expiring.length}
            valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Cần tính cước" value={pendingBilling.length}
            valueStyle={{ color: '#1677ff' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Đã hết hạn"
            value={subscriptions.filter(s => s.status === 'expired').length}
            valueStyle={{ color: '#ff4d4f' }} /></Card>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={subscriptions}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: t => `Tổng ${t} thuê bao`,
          onChange: (page, ps) => setPagination(p => ({ ...p, current: page, pageSize: ps })),
        }}
        scroll={{ x: 900 }}
      />
    </div>
  );
}

export default SubscriptionsPage;
