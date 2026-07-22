'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, DatePicker, Descriptions, Drawer, Dropdown, Form, Input, List, Modal, Row, Select, Space, Tag, Tooltip, Typography, message } from 'antd';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { CalendarOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, EllipsisOutlined, EnvironmentOutlined, FileAddOutlined, FilterOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, SlidersOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  buildCustomerFilterQuery,
  cloneCustomerAdvancedFilters,
  countCustomerAdvancedFilters,
  emptyCustomerAdvancedFilters,
  type CustomerAdvancedFilters,
} from '@/lib/customerFilters';
import { exportCsv } from '@/lib/exportCsv';

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

type CatalogOption = {
  code: string;
  label: string;
  color?: string;
};

const textSorter = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
const sourceOptions = ['Marketing', 'Telesale', 'Giới thiệu', 'Khách cũ', 'Cộng tác viên', 'Khác'];
const fallbackStatusOptions: CatalogOption[] = [
  { code: 'NEW', label: 'Mới tiếp nhận', color: 'blue' },
  { code: 'CONTACTED', label: 'Đã liên hệ', color: 'cyan' },
  { code: 'CARING', label: 'Đang chăm sóc', color: 'green' },
  { code: 'WAITING_SURVEY', label: 'Chờ khảo sát', color: 'purple' },
  { code: 'SURVEYED', label: 'Đã khảo sát', color: 'purple' },
  { code: 'VISITED_SHOWROOM', label: 'Đã xem thang mẫu', color: 'geekblue' },
  { code: 'QUOTED', label: 'Đã gửi báo giá', color: 'cyan' },
  { code: 'WAITING_RESPONSE', label: 'Chờ phản hồi', color: 'orange' },
  { code: 'NEGOTIATING', label: 'Đang đàm phán', color: 'orange' },
  { code: 'CONVERTED', label: 'Đã chuyển sang hợp đồng', color: 'green' },
  { code: 'PAUSED', label: 'Tạm dừng chăm sóc', color: 'default' },
  { code: 'LOST', label: 'Không thành công', color: 'red' },
  { code: 'SIGNED', label: 'Đã ký hợp đồng', color: 'green' },
];
const fallbackCustomerTypeOptions: CatalogOption[] = [
  { code: 'PERSONAL', label: 'Cá nhân', color: 'green' },
  { code: 'BUSINESS', label: 'Doanh nghiệp', color: 'blue' },
];

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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<CustomerAdvancedFilters>(emptyCustomerAdvancedFilters);
  const [draftFilters, setDraftFilters] = useState<CustomerAdvancedFilters>(emptyCustomerAdvancedFilters);
  const [catalogStatuses, setCatalogStatuses] = useState<CatalogOption[]>([]);
  const [catalogCustomerTypes, setCatalogCustomerTypes] = useState<CatalogOption[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<string[]>([]);
  const [customerTablePage, setCustomerTablePage] = useState({ current: 1, pageSize: 10 });
  const [duplicateCustomer, setDuplicateCustomer] = useState<CustomerRow>();
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow>();
  const statusOptions = catalogStatuses.length ? catalogStatuses : fallbackStatusOptions;
  const customerTypeOptions = catalogCustomerTypes.length ? catalogCustomerTypes : fallbackCustomerTypeOptions;
  const advancedFilterCount = countCustomerAdvancedFilters(filters);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = buildCustomerFilterQuery({ search, ...filters });
      const nextRows = await api<CustomerRow[]>(`/customers${query ? `?${query}` : ''}`);
      setRows(nextRows);
      setOwnerOptions((current) => Array.from(new Set([
        ...current,
        ...nextRows.map((item) => item.owner).filter(Boolean),
      ])).sort(textSorter.compare));
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách khách hàng.');
    } finally {
      setLoading(false);
    }
  }, [filters, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 350);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    setCustomerTablePage((page) => ({ ...page, current: 1 }));
  }, [filters, search]);

  useEffect(() => {
    api<CatalogOption[]>('/catalogs/categories/customer_status/options?activeOnly=true')
      .then(setCatalogStatuses)
      .catch(() => setCatalogStatuses(fallbackStatusOptions));
    api<CatalogOption[]>('/catalogs/categories/customer_type/options?activeOnly=true')
      .then(setCatalogCustomerTypes)
      .catch(() => setCatalogCustomerTypes(fallbackCustomerTypeOptions));
  }, []);

  const openAdvancedFilters = () => {
    setDraftFilters(cloneCustomerAdvancedFilters(filters));
    setAdvancedOpen(true);
  };

  const resetFilters = () => {
    setSearch('');
    setFilters(emptyCustomerAdvancedFilters);
    setDraftFilters(emptyCustomerAdvancedFilters);
  };

  const applyAdvancedFilters = () => {
    setFilters(cloneCustomerAdvancedFilters(draftFilters));
    setAdvancedOpen(false);
  };

  const exportCustomers = () => {
    exportCsv(`danh-sach-khach-hang-${dayjs().format('YYYYMMDD-HHmm')}`, rows, [
      { header: 'Mã KH', value: (item) => item.code },
      { header: 'Khách hàng', value: (item) => item.name },
      { header: 'Số điện thoại', value: (item) => item.phone },
      { header: 'Email', value: (item) => item.email },
      { header: 'Nhóm khách hàng', value: (item) => customerTypeOptions.find((option) => option.code === item.customerType)?.label ?? item.customerType },
      { header: 'Địa chỉ liên hệ', value: (item) => item.address },
      { header: 'Nguồn', value: (item) => item.source },
      { header: 'Người phụ trách', value: (item) => item.owner },
      { header: 'Trạng thái', value: (item) => statusOptions.find((option) => option.code === item.status)?.label ?? item.status },
      { header: 'Ngày tạo', value: (item) => item.createdAt ? dayjs(item.createdAt).format('DD/MM/YYYY') : '' },
    ]);
  };

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
    const deleteReason = 'Không thể xóa khách hàng đã phát sinh đăng ký tư vấn, lịch chăm sóc hoặc báo giá/hợp đồng.';

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
                label: 'Đăng ký tư vấn',
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
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 160,
      render: (_, item) => {
        const status = statusOptions.find((option) => option.code === item.status);
        return <Tag color={status?.color}>{status?.label ?? item.status}</Tag>;
      },
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
        <div className='customer-search-row'>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            prefix={<SearchOutlined />}
            placeholder='Tìm mã KH, tên, SĐT hoặc email...'
            allowClear
            className='customer-search-input'
          />
          <Badge count={advancedFilterCount} size='small' offset={[-4, 4]}>
            <Button icon={<SlidersOutlined />} onClick={openAdvancedFilters}>
              Lọc nâng cao
            </Button>
          </Badge>
          <Button icon={<ReloadOutlined />} onClick={resetFilters}>
            Đặt lại
          </Button>
          <Typography.Text className='filter-result-count'>{rows.length} khách hàng</Typography.Text>
          <Button icon={<DownloadOutlined />} onClick={exportCustomers}>
            Xuất CSV
          </Button>
        </div>
      </ProCard>

      <Drawer
        title={(
          <div className='advanced-filter-title'>
            <SlidersOutlined />
            <span>Lọc nâng cao</span>
          </div>
        )}
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        width={420}
        className='advanced-filter-drawer'
        footer={(
          <div className='advanced-filter-footer'>
            <Button icon={<ReloadOutlined />} onClick={() => setDraftFilters(emptyCustomerAdvancedFilters)}>
              Đặt lại
            </Button>
            <Space>
              <Button onClick={() => setAdvancedOpen(false)}>Hủy</Button>
              <Button type='primary' icon={<FilterOutlined />} onClick={applyAdvancedFilters}>
                Áp dụng
              </Button>
            </Space>
          </div>
        )}
      >
        <Typography.Text className='advanced-filter-description'>
          Áp dụng nhiều điều kiện cùng lúc cho danh sách khách hàng hiện tại.
        </Typography.Text>
        <div className='advanced-filter-section'>
          <div className='advanced-filter-section-title'>Phân loại</div>
          <label className='advanced-filter-field'>
            <span>Trạng thái khách hàng</span>
            <Select
              value={draftFilters.status}
              onChange={(status) => setDraftFilters((current) => ({ ...current, status }))}
              allowClear
              placeholder='Tất cả trạng thái'
              options={statusOptions.map((item) => ({ value: item.code, label: item.label }))}
            />
          </label>
          <label className='advanced-filter-field'>
            <span>Nhóm khách hàng</span>
            <Select
              value={draftFilters.customerType}
              onChange={(customerType) => setDraftFilters((current) => ({ ...current, customerType }))}
              allowClear
              placeholder='Tất cả nhóm'
              options={customerTypeOptions.map((item) => ({ value: item.code, label: item.label }))}
            />
          </label>
          <label className='advanced-filter-field'>
            <span>Nguồn khách hàng</span>
            <Select
              value={draftFilters.source}
              onChange={(source) => setDraftFilters((current) => ({ ...current, source }))}
              allowClear
              placeholder='Tất cả nguồn'
              options={sourceOptions.map((value) => ({ value, label: value }))}
            />
          </label>
        </div>
        <div className='advanced-filter-section'>
          <div className='advanced-filter-section-title'>Liên hệ và phụ trách</div>
          <label className='advanced-filter-field'>
            <span>Địa chỉ liên hệ chứa</span>
            <Input
              value={draftFilters.address}
              onChange={(event) => setDraftFilters((current) => ({ ...current, address: event.target.value }))}
              allowClear
              placeholder='Nhập phường/xã, quận/huyện hoặc tỉnh/thành'
            />
          </label>
          <label className='advanced-filter-field'>
            <span>Người phụ trách</span>
            <Select
              value={draftFilters.owner}
              onChange={(owner) => setDraftFilters((current) => ({ ...current, owner }))}
              allowClear
              showSearch
              optionFilterProp='label'
              placeholder='Tất cả người phụ trách'
              options={ownerOptions.map((value) => ({ value, label: value }))}
            />
          </label>
        </div>
        <div className='advanced-filter-section'>
          <div className='advanced-filter-section-title'>Thời gian</div>
          <label className='advanced-filter-field'>
            <span>Ngày tạo</span>
            <DatePicker.RangePicker
              value={draftFilters.createdFrom && draftFilters.createdTo
                ? [dayjs(draftFilters.createdFrom), dayjs(draftFilters.createdTo)]
                : undefined}
              onChange={(value) => setDraftFilters((current) => ({
                ...current,
                createdFrom: value?.[0]?.startOf('day').toISOString(),
                createdTo: value?.[1]?.endOf('day').toISOString(),
              }))}
              format='DD/MM/YYYY'
              placeholder={['Từ ngày', 'Đến ngày']}
            />
          </label>
        </div>
      </Drawer>

      <div className='responsive-table section-gap'>
        <ProTable<CustomerRow>
          rowKey='id'
          loading={loading}
          dataSource={rows}
          columns={columns}
          search={false}
          cardBordered
          options={{ density: true, fullScreen: true, reload: () => void load() }}
          pagination={{
            current: customerTablePage.current,
            pageSize: customerTablePage.pageSize,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (total) => `${total} khách hàng`,
            onChange: (current, pageSize) => setCustomerTablePage({ current, pageSize }),
            onShowSizeChange: (_, pageSize) => setCustomerTablePage({ current: 1, pageSize }),
          }}
          scroll={{ x: 1560 }}
          headerTitle='Danh sách khách hàng'
        />
      </div>

      <div className='mobile-card-list section-gap'>
        <List
          loading={loading}
          dataSource={rows}
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
