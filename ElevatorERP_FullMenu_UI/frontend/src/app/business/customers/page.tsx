'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Drawer, Dropdown, Form, Input, List, Modal, Row, Select, Space, Tag, Tooltip, Typography, message } from 'antd';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { CalendarOutlined, DeleteOutlined, EditOutlined, EllipsisOutlined, EnvironmentOutlined, FileAddOutlined, PlusOutlined, SearchOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type CustomerRow = {
  id: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  customerType: 'PERSONAL' | 'BUSINESS';
  source?: string;
  address?: string;
  owner: string;
  status: string;
  consultationProfileCount?: number;
  quotationCount?: number;
  careActivityCount?: number;
  createdAt?: string;
};

type CustomerForm = {
  customerType: 'PERSONAL' | 'BUSINESS';
  name: string;
  phone: string;
  email?: string;
  source: string;
  address?: string;
};

const textSorter = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
const sourceOptions = ['Marketing', 'Telesale', 'Giới thiệu', 'Khách cũ', 'Cộng tác viên', 'Khác'];

function normalizePhone(value?: string) {
  const digits = value?.replace(/[^\d]/g, '') ?? '';
  return digits.startsWith('84') && digits.length > 9 ? `0${digits.slice(2)}` : digits;
}

export default function CustomerMasterPage() {
  const router = useRouter();
  const [form] = Form.useForm<CustomerForm>();
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [duplicateCustomer, setDuplicateCustomer] = useState<CustomerRow>();
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow>();

  const filteredRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) =>
      `${row.code} ${row.name} ${row.phone} ${row.email ?? ''} ${row.address ?? ''}`.toLowerCase().includes(normalized),
    );
  }, [rows, search]);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await api<CustomerRow[]>('/customers'));
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách khách hàng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({ customerType: 'PERSONAL', source: 'Marketing' });
    setDuplicateCustomer(undefined);
    setEditingCustomer(undefined);
    setOpen(true);
  };

  const openEdit = (customer: CustomerRow) => {
    form.setFieldsValue({
      customerType: customer.customerType,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      source: customer.source,
      address: customer.address,
    });
    setDuplicateCustomer(undefined);
    setEditingCustomer(customer);
    setOpen(true);
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      const phone = values.phone.trim();
      const normalizedPhone = normalizePhone(phone);
      const duplicate = rows.find((row) => row.id !== editingCustomer?.id && normalizePhone(row.phone) === normalizedPhone);
      if (duplicate) {
        setDuplicateCustomer(duplicate);
        form.setFields([
          {
            name: 'phone',
            errors: [`Số điện thoại đã tồn tại ở khách hàng ${duplicate.code} - ${duplicate.name}.`],
          },
        ]);
        message.error({
          content: `Không thể lưu khách hàng mới vì SĐT đã thuộc ${duplicate.code} - ${duplicate.name}.`,
          duration: 5,
        });
        return;
      }

      setSaving(true);
      await api(editingCustomer ? `/customers/${editingCustomer.id}` : '/customers', {
        method: editingCustomer ? 'PUT' : 'POST',
        body: JSON.stringify({
          customerType: values.customerType,
          name: values.name.trim(),
          phone,
          email: values.email?.trim() || null,
          address: values.address?.trim() || null,
          elevatorType: null,
          latitude: null,
          longitude: null,
          locationAccuracyMeters: null,
          locationLabel: null,
          source: values.source,
          status: editingCustomer?.status ?? 'NEW',
          notes: null,
          technicalSpecsJson: null,
          attachmentLinksJson: null,
        }),
      });
      message.success(editingCustomer ? 'Đã cập nhật khách hàng' : 'Đã tạo khách hàng');
      setOpen(false);
      setEditingCustomer(undefined);
      await load();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Số điện thoại')) {
          const phone = form.getFieldValue('phone');
          const duplicate = rows.find((row) => row.id !== editingCustomer?.id && normalizePhone(row.phone) === normalizePhone(phone));
          if (duplicate) {
            setDuplicateCustomer(duplicate);
            form.setFields([
              {
                name: 'phone',
                errors: [`Số điện thoại đã tồn tại ở khách hàng ${duplicate.code} - ${duplicate.name}.`],
              },
            ]);
          }
        }
        message.error(error.message || 'Không tạo được khách hàng.');
      }
    } finally {
      setSaving(false);
    }
  };

  const removeCustomer = (customer: CustomerRow) => {
    Modal.confirm({
      title: 'Xóa khách hàng?',
      content: `Khách hàng ${customer.code} - ${customer.name} sẽ bị xóa khỏi danh sách khách hàng.`,
      okText: 'Xóa khách hàng',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api(`/customers/${customer.id}`, { method: 'DELETE' });
          message.success('Đã xóa khách hàng');
          await load();
        } catch (error) {
          message.error(error instanceof Error ? error.message : 'Không thể xóa khách hàng.');
        }
      },
    });
  };

  const renderCustomerActions = (item: CustomerRow) => {
    const hasBusinessHistory = Boolean(item.consultationProfileCount || item.quotationCount || item.careActivityCount);
    const deleteReason = 'Không thể xóa khách hàng đã phát sinh hồ sơ tư vấn, lịch chăm sóc hoặc báo giá/hợp đồng.';

    return (
      <Space size={4}>
        <Tooltip title='Sửa khách hàng'>
          <Button type='text' className='table-action-button' icon={<EditOutlined />} onClick={() => openEdit(item)} />
        </Tooltip>
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              {
                key: 'consultation',
                icon: <FileAddOutlined />,
                label: 'Tạo hồ sơ tư vấn',
                onClick: () => router.push(`/customers?customerId=${item.id}`),
              },
              {
                key: 'care',
                icon: <CalendarOutlined />,
                label: 'Ghi chăm sóc',
                onClick: () => router.push(`/care?customerId=${item.id}`),
              },
              { type: 'divider' },
              {
                key: 'delete',
                icon: <DeleteOutlined />,
                danger: true,
                disabled: hasBusinessHistory,
                label: hasBusinessHistory ? (
                  <Tooltip title={deleteReason}><span>Xóa khách hàng</span></Tooltip>
                ) : 'Xóa khách hàng',
                onClick: () => removeCustomer(item),
              },
            ],
          }}
        >
          <Tooltip title='Thao tác khác'>
            <Button type='text' className='table-action-button' icon={<EllipsisOutlined />} />
          </Tooltip>
        </Dropdown>
      </Space>
    );
  };

  const columns: ProColumns<CustomerRow>[] = [
    {
      title: 'Mã KH',
      dataIndex: 'code',
      width: 120,
      sorter: (a, b) => textSorter.compare(a.code, b.code),
      render: (value, item) => (
        <Tooltip title='Mở Customer 360'>
          <Typography.Link className='record-link record-link-code' onClick={() => router.push(`/business/customers/${item.id}?returnTo=customers`)}>{String(value)}</Typography.Link>
        </Tooltip>
      ),
    },
    {
      title: 'Khách hàng',
      dataIndex: 'name',
      sorter: (a, b) => textSorter.compare(a.name, b.name),
      render: (_, item) => (
        <span>
          <Tooltip title='Mở Customer 360'>
            <Typography.Link strong className='record-link' onClick={() => router.push(`/business/customers/${item.id}?returnTo=customers`)}>{item.name}</Typography.Link>
          </Tooltip>
          <small className='table-secondary-text'>{item.phone}</small>
        </span>
      ),
    },
    {
      title: 'Loại',
      dataIndex: 'customerType',
      width: 130,
      render: (_, item) => (
        <Tag color={item.customerType === 'BUSINESS' ? 'blue' : 'green'}>
          {item.customerType === 'BUSINESS' ? 'Doanh nghiệp' : 'Cá nhân'}
        </Tag>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      width: 220,
      render: (_, item) => item.email || <Typography.Text type='secondary'>Chưa có</Typography.Text>,
    },
    {
      title: 'Địa chỉ liên hệ',
      dataIndex: 'address',
      width: 260,
      render: (_, item) => item.address ? (
        <Tooltip title={item.address}>
          <span className='table-cell-inline'>
            <EnvironmentOutlined />
            <span className='table-cell-inline-text table-cell-clamp'>{item.address}</span>
          </span>
        </Tooltip>
      ) : <Typography.Text type='secondary'>Chưa có</Typography.Text>,
    },
    {
      title: 'Nguồn',
      dataIndex: 'source',
      width: 150,
      render: (_, item) => item.source || <Typography.Text type='secondary'>Chưa có</Typography.Text>,
    },
    {
      title: 'Phụ trách',
      dataIndex: 'owner',
      width: 170,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      width: 130,
      render: (_, item) => item.createdAt ? dayjs(item.createdAt).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Thao tác',
      valueType: 'option',
      width: 112,
      fixed: 'right',
      render: (_, item) => renderCustomerActions(item),
    },
  ];

  return (
    <PageContainer
      className='erp-page-container'
      header={{
        title: (
          <div className='page-title-stack'>
            <Typography.Title level={3}>Khách hàng</Typography.Title>
            <Typography.Text>Danh sách khách hàng master và thông tin định danh lâu dài.</Typography.Text>
          </div>
        ),
        extra: (
          <Button type='primary' icon={<PlusOutlined />} onClick={openCreate}>
            Thêm khách hàng
          </Button>
        ),
        breadcrumb: {},
      }}
    >
      <Row gutter={[16, 16]} className='erp-kpi-row'>
        <Col xs={12} lg={6}>
          <ProCard className='mini-stat mini-stat-blue'>
            <span className='mini-stat-icon'><TeamOutlined /></span>
            <span>
              <small>Tổng khách hàng</small>
              <b>{rows.length}</b>
            </span>
          </ProCard>
        </Col>
        <Col xs={12} lg={6}>
          <ProCard className='mini-stat mini-stat-cyan'>
            <span className='mini-stat-icon'><UserOutlined /></span>
            <span>
              <small>Khách mới tháng này</small>
              <b>{rows.filter((row) => row.createdAt && dayjs(row.createdAt).isSame(dayjs(), 'month')).length}</b>
            </span>
          </ProCard>
        </Col>
      </Row>

      <ProCard className='section-gap filter-card'>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          prefix={<SearchOutlined />}
          placeholder='Tìm mã KH, tên, SĐT hoặc email...'
          allowClear
          className='customer-search-input'
        />
      </ProCard>

      <div className='responsive-table section-gap'>
        <ProTable<CustomerRow>
          rowKey='id'
          loading={loading}
          dataSource={filteredRows}
          columns={columns}
          search={false}
          cardBordered
          options={{ density: true, fullScreen: true, reload: () => void load() }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${total} khách hàng` }}
          scroll={{ x: 1400 }}
          headerTitle='Danh sách khách hàng'
        />
      </div>

      <div className='mobile-card-list section-gap'>
        <List
          loading={loading}
          dataSource={filteredRows}
          locale={{ emptyText: 'Chưa có khách hàng' }}
          renderItem={(item) => (
            <List.Item>
              <Card className='mobile-record-card'>
                <Space align='start' style={{ width: '100%', justifyContent: 'space-between' }}>
                  <div>
                    <Tooltip title='Mở Customer 360'>
                      <Typography.Link strong className='record-link' onClick={() => router.push(`/business/customers/${item.id}?returnTo=customers`)}>{item.name}</Typography.Link>
                    </Tooltip>
                    <div className='muted-text'>{item.code} · {item.phone}</div>
                  </div>
                  <Tag color={item.customerType === 'BUSINESS' ? 'blue' : 'green'}>{item.customerType === 'BUSINESS' ? 'Doanh nghiệp' : 'Cá nhân'}</Tag>
                </Space>
                <Descriptions size='small' column={1} className='mobile-descriptions'>
                  <Descriptions.Item label='Email'>{item.email || 'Chưa có'}</Descriptions.Item>
                  <Descriptions.Item label='Địa chỉ liên hệ'>{item.address || 'Chưa có'}</Descriptions.Item>
                  <Descriptions.Item label='Nguồn'>{item.source || 'Chưa có'}</Descriptions.Item>
                  <Descriptions.Item label='Phụ trách'>{item.owner || 'Chưa có'}</Descriptions.Item>
                  <Descriptions.Item label='Ngày tạo'>{item.createdAt ? dayjs(item.createdAt).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
                </Descriptions>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Button type='link' onClick={() => router.push(`/business/customers/${item.id}?returnTo=customers`)}>Mở Customer 360</Button>
                  {renderCustomerActions(item)}
                </Space>
              </Card>
            </List.Item>
          )}
        />
      </div>

      <Drawer
        title={editingCustomer ? 'Sửa khách hàng' : 'Thêm khách hàng'}
        open={open}
        onClose={() => {
          setOpen(false);
          setDuplicateCustomer(undefined);
          setEditingCustomer(undefined);
        }}
        width='min(560px, calc(100vw - 32px))'
        className='customer-form-drawer'
        footer={(
          <div className='quotation-drawer-footer'>
            <Button
              onClick={() => {
                setOpen(false);
                setDuplicateCustomer(undefined);
                setEditingCustomer(undefined);
              }}
            >
              Hủy
            </Button>
            <Button type='primary' loading={saving} onClick={() => void save()}>
              {editingCustomer ? 'Lưu thay đổi' : 'Lưu khách hàng'}
            </Button>
          </div>
        )}
      >
        <Form form={form} layout='vertical' requiredMark initialValues={{ customerType: 'PERSONAL' }}>
          <div className='form-section-heading'>Thông tin định danh</div>
          {duplicateCustomer && (
            <Alert
              className='customer-duplicate-alert'
              type='error'
              showIcon
              message='Số điện thoại đã tồn tại'
              description={(
                <span>
                  SĐT này đang thuộc khách hàng <b>{duplicateCustomer.code} - {duplicateCustomer.name}</b>.
                  <Button
                    type='link'
                    size='small'
                    onClick={() => {
                      setSearch(duplicateCustomer.phone);
                      setOpen(false);
                    }}
                  >
                    Xem khách hàng đã có
                  </Button>
                </span>
              )}
            />
          )}
          <Form.Item name='customerType' label='Nhóm khách hàng' rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'PERSONAL', label: 'Cá nhân' },
                { value: 'BUSINESS', label: 'Doanh nghiệp' },
              ]}
            />
          </Form.Item>
          <Form.Item name='name' label='Tên khách hàng' rules={[{ required: true, message: 'Vui lòng nhập tên khách hàng' }]}>
            <Input placeholder='Nhập họ tên hoặc tên doanh nghiệp' />
          </Form.Item>
          <Form.Item name='phone' label='Số điện thoại' rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}>
            <Input
              placeholder='Ví dụ: 0912 345 678'
              onChange={() => {
                if (duplicateCustomer) setDuplicateCustomer(undefined);
              }}
            />
          </Form.Item>
          <Form.Item name='email' label='Email' rules={[{ type: 'email', message: 'Email không hợp lệ' }]}>
            <Input placeholder='email@domain.com' />
          </Form.Item>
          <Form.Item name='source' label='Nguồn khách hàng' rules={[{ required: true, message: 'Vui lòng chọn nguồn khách hàng' }]}>
            <Select options={sourceOptions.map((value) => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item name='address' label='Địa chỉ liên hệ'>
            <Input.TextArea rows={3} placeholder='Nhập địa chỉ liên hệ nếu có' />
          </Form.Item>
        </Form>
      </Drawer>
    </PageContainer>
  );
}
