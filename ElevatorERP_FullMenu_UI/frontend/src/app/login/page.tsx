'use client';

import { useState } from 'react';
import { Alert, Button, Checkbox, Form, Input, Space, Typography } from 'antd';
import {
  CheckCircleFilled,
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import BrandMark from '@/components/BrandMark';
import { api } from '@/lib/api';

type LoginValues = {
  username: string;
  password: string;
  rememberMe?: boolean;
};

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (values: LoginValues) => {
    setLoading(true);
    setError('');
    try {
      await api('/auth/login', { method: 'POST', body: JSON.stringify(values) });
      router.replace('/');
    } catch {
      setError('Tên đăng nhập hoặc mật khẩu không đúng');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className='login-page'>
      <section className='login-brand-panel'>
        <div className='login-brand-content'>
          <div className='login-brand'>
            <BrandMark className='login-logo' />
            <span>
              <b>Thang máy Miền Trung</b>
              <small>ENTERPRISE RESOURCE PLANNING</small>
            </span>
          </div>

          <div className='login-hero-copy'>
            <span className='login-kicker'>QUẢN TRỊ TOÀN VÒNG ĐỜI THANG MÁY</span>
            <Typography.Title>Điều hành tập trung.<br />Phối hợp liền mạch.</Typography.Title>
            <Typography.Paragraph>
              Kết nối kinh doanh, dự án, kỹ thuật, KCS, bảo trì và kế toán trên cùng một hệ thống.
            </Typography.Paragraph>
          </div>

          <div className='login-feature-list'>
            {[
              'Phân quyền nhiều vai trò và kiểm soát chéo',
              'Quản lý khách hàng, lịch chăm sóc và dự án',
              'Theo dõi toàn bộ vòng đời từng thang máy',
            ].map((item) => (
              <div key={item}><CheckCircleFilled /> {item}</div>
            ))}
          </div>

          <div className='login-decoration' aria-hidden='true'>
            <div className='shaft-lines' />
            <div className='login-elevator'>
              <div className='login-elevator-display'>08</div>
              <div className='login-elevator-doors'><span /><span /></div>
            </div>
          </div>
        </div>
      </section>

      <section className='login-form-panel'>
        <div className='login-form-card'>
          <div className='login-mobile-brand'>
            <BrandMark className='login-logo' />
            <b>Thang máy Miền Trung</b>
          </div>

          <div className='login-form-heading'>
            <span className='secure-badge'><SafetyCertificateOutlined /> Hệ thống nội bộ</span>
            <Typography.Title level={2}>Đăng nhập ERP</Typography.Title>
            <Typography.Paragraph type='secondary'>Sử dụng tài khoản được cấp để tiếp tục.</Typography.Paragraph>
          </div>

          {error && <Alert message={error} type='error' showIcon className='login-error' />}

          <Form<LoginValues>
            layout='vertical'
            onFinish={submit}
            initialValues={{ username: 'admin.demo', password: 'Demo@123456', rememberMe: true }}
            requiredMark={false}
          >
            <Form.Item
              name='username'
              label='Tên đăng nhập'
              rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập' }]}
            >
              <Input size='large' prefix={<UserOutlined />} placeholder='Nhập tên đăng nhập' />
            </Form.Item>
            <Form.Item
              name='password'
              label='Mật khẩu'
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
            >
              <Input.Password size='large' prefix={<LockOutlined />} placeholder='Nhập mật khẩu' />
            </Form.Item>
            <Space className='login-form-options'>
              <Form.Item name='rememberMe' valuePropName='checked' noStyle>
                <Checkbox>Ghi nhớ đăng nhập</Checkbox>
              </Form.Item>
              <Typography.Link disabled>Quên mật khẩu?</Typography.Link>
            </Space>
            <Button htmlType='submit' type='primary' size='large' loading={loading} block className='login-submit'>
              Đăng nhập hệ thống
            </Button>
          </Form>

          <div className='demo-account-box'>
            <b>Tài khoản demo</b>
            <span>admin.demo</span>
            <span>Demo@123456</span>
          </div>

          <div className='login-footer'>© 2026 Công ty Thang máy Miền Trung</div>
        </div>
      </section>
    </main>
  );
}
