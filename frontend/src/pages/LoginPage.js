import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Space } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { authAPI } from '../services/api';

const { Title, Text } = Typography;

function LoginPage({ onLogin }) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const res = await authAPI.login(values);
      message.success('Đăng nhập thành công!');
      onLogin(res.data.user, res.data.token);
    } catch (error) {
      message.error(error.response?.data?.error || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card style={{ width: 420, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <Title level={3} style={{ marginBottom: 4 }}>📊 Quản Lý KD</Title>
            <Text type="secondary">Hệ thống quản lý kế toán & kinh doanh</Text>
          </div>

          <Form onFinish={handleSubmit} size="large" layout="vertical">
            <Form.Item name="email" rules={[
              { required: true, message: 'Nhập email' },
              { type: 'email', message: 'Email không hợp lệ' },
            ]}>
              <Input prefix={<UserOutlined />} placeholder="Email" />
            </Form.Item>

            <Form.Item name="password" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block icon={<LoginOutlined />}>
                Đăng nhập
              </Button>
            </Form.Item>
          </Form>

          <Text type="secondary" style={{ fontSize: 12 }}>
            Tài khoản mặc định: admin@company.com / Admin@123
          </Text>
        </Space>
      </Card>
    </div>
  );
}

export default LoginPage;
