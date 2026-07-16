'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Input,
  List,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  BankOutlined,
  EnvironmentOutlined,
  FilterOutlined,
  PhoneOutlined,
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import {
  DrawerForm,
  PageContainer,
  ProCard,
  ProForm,
  ProFormRadio,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { api } from '@/lib/api';

type CustomerRow = {
  id: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  area?: string;
  source: string;
  owner: string;
  status: string;
  createdAt?: string;
};

type CustomerForm = {
  customerType: 'PERSONAL' | 'BUSINESS';
  name: string;
  phone: string;
  email?: string;
  area?: string;
  source: string;
  address?: string;
  notes?: string;
  status: string;
};

const statusLabels: Record<string, { label: string; color: string }> = {
  NEW: { label: 'Mới tiếp nhận', color: 'blue' },
  CONTACTED: { label: 'Đã liên hệ', color: 'cyan' },
  WAITING_SURVEY: { label: 'Chờ khảo sát', color: 'gold' },
  SURVEYED: { label: 'Đã khảo sát', color: 'purple' },
  CARING: { label: 'Đang chăm sóc', color: 'processing' },
  QUOTED: { label: 'Đã gửi báo giá', color: 'geekblue' },
  NEGOTIATING: { label: 'Đang đàm phán', color: 'orange' },
  SIGNED: { label: 'Đã ký hợp đồng', color: 'green' },
  LOST: { label: 'Không thành công', color: 'red' },
};

const sourceOptions = ['Marketing', 'Giới thiệu', 'Telesale', 'Khách cũ', 'Cộng tác viên', 'Khác'];

function CustomerStatus({ value }: { value: string }) {
  const status = statusLabels[value] ?? { label: value, color: 'default' };
  return <Tag color={status.color}>{status.label}</Tag>;
}

export default function Customers() {
  const [data, setData] = useState<CustomerRow[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>();
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      const query = params.toString();
      setData(await api<CustomerRow[]>(`/customers${query ? `?${query}` : ''}`));
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách khách hàng.');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    void load();
    // Tải dữ liệu ban đầu; các bộ lọc được áp dụng bằng nút Tìm kiếm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    const newCount = data.filter((item) => item.status === 'NEW').length;
    const caringCount = data.filter((item) => ['CARING', 'CONTACTED', 'WAITING_SURVEY'].includes(item.status)).length;
    const quotedCount = data.filter((item) => ['QUOTED', 'NEGOTIATING'].includes(item.status)).length;
    return { total: data.length, newCount, caringCount, quotedCount };
  }, [data]);

  const columns: ProColumns<CustomerRow>[] = [
    {
      title: 'Khách hàng',
      dataIndex: 'name',
      width: 260,
      fixed: 'left',
      render: (_, item) => (
        <Space>
          <Avatar className='customer-avatar'>{item.name.charAt(0)}</Avatar>
          <span>
            <b className='table-primary-text'>{item.name}</b>
            <small className='table-secondary-text'>{item.code}</small>
          </span>
        </Space>
      ),
    },
    {
      title: 'Liên hệ',
      dataIndex: 'phone',
      width: 170,
      render: (_, item) => (
        <span>
          <b className='table-primary-text'><PhoneOutlined /> {item.phone}</b>
          <small className='table-secondary-text'>{item.email || 'Chưa có email'}</small>
        </span>
      ),
    },
    {
      title: 'Khu vực',
      dataIndex: 'area',
      width: 150,
      render: (value) => value ? <span><EnvironmentOutlined /> {String(value)}</span> : '—',
    },
    { title: 'Nguồn', dataIndex: 'source', width: 140 },
    { title: 'Nhân viên phụ trách', dataIndex: 'owner', width: 190 },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 165,
      render: (_, item) => <CustomerStatus value={item.status} />,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      width: 120,
      render: (value) => value ? dayjs(String(value)).format('DD/MM/YYYY') : '—',
    },
  ];

  const save = async (values: CustomerForm) => {
    try {
      await api('/customers', { method: 'POST', body: JSON.stringify(values) });
      message.success('Đã tạo đăng ký khách hàng');
      setOpen(false);
      await load();
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tạo được khách hàng.');
      return false;
    }
  };

  return (
    <PageContainer
        className='erp-page-container'
        header={{
          title: 'Đăng ký khách hàng',
          subTitle: 'Quản lý khách hàng, nhu cầu ban đầu và người phụ trách',
          breadcrumb: {},
        }}
      >
        <Row gutter={[16, 16]}>
          {[
            { label: 'Tổng khách hàng', value: summary.total, icon: <TeamOutlined />, tone: 'blue' },
            { label: 'Mới tiếp nhận', value: summary.newCount, icon: <UserAddOutlined />, tone: 'cyan' },
            { label: 'Đang chăm sóc', value: summary.caringCount, icon: <PhoneOutlined />, tone: 'violet' },
            { label: 'Báo giá / Đàm phán', value: summary.quotedCount, icon: <BankOutlined />, tone: 'orange' },
          ].map((item) => (
            <Col xs={12} lg={6} key={item.label}>
              <ProCard className={`mini-stat mini-stat-${item.tone}`}>
                <span className='mini-stat-icon'>{item.icon}</span>
                <span>
                  <small>{item.label}</small>
                  <b>{item.value}</b>
                </span>
              </ProCard>
            </Col>
          ))}
        </Row>

        <ProCard className='section-gap filter-card'>
          <div className='filter-row'>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onPressEnter={() => void load()}
              prefix={<SearchOutlined />}
              placeholder='Tìm theo tên hoặc số điện thoại...'
              allowClear
              className='filter-search'
            />
            <Select
              value={status}
              onChange={setStatus}
              allowClear
              placeholder='Tất cả trạng thái'
              className='filter-select'
              options={Object.entries(statusLabels).map(([value, item]) => ({ value, label: item.label }))}
            />
            <Button type='primary' icon={<FilterOutlined />} onClick={() => void load()}>
              Áp dụng
            </Button>
            <Button type='primary' icon={<PlusOutlined />} onClick={() => setOpen(true)}>
              Thêm khách hàng
            </Button>
          </div>
        </ProCard>

        <div className='desktop-table section-gap'>
          <ProTable<CustomerRow>
            rowKey='id'
            loading={loading}
            dataSource={data}
            columns={columns}
            search={false}
            cardBordered
            options={{ density: true, fullScreen: true, reload: () => void load() }}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${total} khách hàng` }}
            scroll={{ x: 1200 }}
            headerTitle='Danh sách đăng ký khách hàng'
          />
        </div>

        <div className='mobile-card-list section-gap'>
          <List
            loading={loading}
            dataSource={data}
            locale={{ emptyText: 'Chưa có khách hàng' }}
            renderItem={(customer) => (
              <List.Item>
                <Card className='mobile-record-card'>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }} align='start'>
                    <Space align='start'>
                      <Avatar className='customer-avatar'>{customer.name.charAt(0)}</Avatar>
                      <div>
                        <Typography.Text strong>{customer.name}</Typography.Text>
                        <div className='muted-text'>{customer.code} · {customer.phone}</div>
                      </div>
                    </Space>
                    <CustomerStatus value={customer.status} />
                  </Space>
                  <Descriptions size='small' column={1} className='mobile-descriptions'>
                    <Descriptions.Item label='Khu vực'>{customer.area || '—'}</Descriptions.Item>
                    <Descriptions.Item label='Nguồn'>{customer.source}</Descriptions.Item>
                    <Descriptions.Item label='Phụ trách'>{customer.owner}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </List.Item>
            )}
          />
        </div>

        <DrawerForm<CustomerForm>
          title='Thêm đăng ký khách hàng'
          open={open}
          onOpenChange={setOpen}
          width={760}
          initialValues={{ customerType: 'PERSONAL', source: 'Marketing', status: 'NEW' }}
          onFinish={save}
          drawerProps={{ destroyOnClose: true }}
          submitter={{ searchConfig: { submitText: 'Lưu đăng ký', resetText: 'Hủy' } }}
        >
          <div className='form-section-heading'>Thông tin khách hàng</div>
          <ProFormRadio.Group
            name='customerType'
            label='Loại khách hàng'
            options={[
              { value: 'PERSONAL', label: 'Cá nhân' },
              { value: 'BUSINESS', label: 'Doanh nghiệp' },
            ]}
          />
          <ProForm.Group>
            <ProFormText
              name='name'
              label='Tên khách hàng'
              width='md'
              placeholder='Nhập họ tên hoặc tên doanh nghiệp'
              rules={[{ required: true, message: 'Vui lòng nhập tên khách hàng' }]}
            />
            <ProFormText
              name='phone'
              label='Số điện thoại'
              width='md'
              placeholder='Ví dụ: 0912 345 678'
              rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
            />
          </ProForm.Group>
          <ProForm.Group>
            <ProFormText name='email' label='Email' width='md' rules={[{ type: 'email' }]} />
            <ProFormText name='area' label='Khu vực' width='md' placeholder='Tỉnh/thành, quận/huyện' />
          </ProForm.Group>

          <div className='form-section-heading'>Nhu cầu và nguồn khách</div>
          <ProFormSelect
            name='source'
            label='Nguồn khách hàng'
            width='md'
            options={sourceOptions.map((value) => ({ value, label: value }))}
          />
          <ProFormTextArea
            name='address'
            label='Địa chỉ công trình'
            placeholder='Nhập địa chỉ dự kiến lắp đặt thang máy'
            fieldProps={{ rows: 3 }}
          />
          <ProFormTextArea
            name='notes'
            label='Yêu cầu / Ghi chú ban đầu'
            placeholder='Loại thang, số tầng, tải trọng, thời gian dự kiến...'
            fieldProps={{ rows: 4 }}
          />
          <ProFormText name='status' hidden />
        </DrawerForm>
    </PageContainer>
  );
}
