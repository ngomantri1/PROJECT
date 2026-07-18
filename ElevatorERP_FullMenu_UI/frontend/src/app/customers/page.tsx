'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Dropdown,
  Input,
  List,
  Row,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  BankOutlined,
  CalendarOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EllipsisOutlined,
  EnvironmentOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  FilterOutlined,
  PhoneOutlined,
  PlusOutlined,
  ReloadOutlined,
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
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exportCsv';

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

type CatalogOption = {
  code: string;
  label: string;
  color?: string;
};

type CustomerFilters = {
  search?: string;
  status?: string;
  statusGroup?: string;
  source?: string;
  owner?: string;
  area?: string;
};

const textSorter = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

const fallbackStatusOptions: CatalogOption[] = [
  { code: 'NEW', label: 'Khách hàng mới', color: 'blue' },
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
  // Backward compatibility for existing demo data and old rows.
  { code: 'SIGNED', label: 'Đã ký hợp đồng', color: 'green' },
];

const legacyStatusLabels: Record<string, { label: string; color: string }> = {
  NEW: { label: 'Mới tiếp nhận', color: 'blue' },
  CONTACTED: { label: 'Đã liên hệ', color: 'cyan' },
  WAITING_SURVEY: { label: 'Chờ khảo sát', color: 'purple' },
  SURVEYED: { label: 'Đã khảo sát', color: 'purple' },
  CARING: { label: 'Đang chăm sóc', color: 'green' },
  QUOTED: { label: 'Đã gửi báo giá', color: 'cyan' },
  NEGOTIATING: { label: 'Đang đàm phán', color: 'orange' },
  SIGNED: { label: 'Đã ký hợp đồng', color: 'green' },
  LOST: { label: 'Không thành công', color: 'red' },
};

const sourceOptions = ['Marketing', 'Giới thiệu', 'Telesale', 'Khách cũ', 'Cộng tác viên', 'Khác'];

const kpiGroupByTone: Record<string, string | undefined> = {
  blue: undefined,
  cyan: 'new',
  violet: 'caring',
  orange: 'quoted',
};

function statusMeta(statusOptions: CatalogOption[], value: string) {
  const option = statusOptions.find((item) => item.code === value);
  if (option) return { label: option.label, color: option.color ?? 'default' };
  return legacyStatusLabels[value] ?? { label: value, color: 'default' };
}

function CustomerStatus({ value, statusOptions }: { value: string; statusOptions: CatalogOption[] }) {
  const status = statusMeta(statusOptions, value);
  return <Tag color={status.color}>{status.label}</Tag>;
}

export default function Customers() {
  const router = useRouter();
  const [data, setData] = useState<CustomerRow[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>();
  const [statusGroup, setStatusGroup] = useState<string>();
  const [source, setSource] = useState<string>();
  const [owner, setOwner] = useState<string>();
  const [area, setArea] = useState<string>();
  const [catalogStatuses, setCatalogStatuses] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(false);
  const statusOptions = catalogStatuses.length ? catalogStatuses : fallbackStatusOptions;

  const load = useCallback(async (overrides?: CustomerFilters) => {
    setLoading(true);
    try {
      const hasOverride = (key: keyof CustomerFilters) =>
        overrides ? Object.prototype.hasOwnProperty.call(overrides, key) : false;
      const currentSearch = hasOverride('search') ? overrides?.search : search;
      const currentStatus = hasOverride('status') ? overrides?.status : status;
      const currentStatusGroup = hasOverride('statusGroup') ? overrides?.statusGroup : statusGroup;
      const currentSource = hasOverride('source') ? overrides?.source : source;
      const currentOwner = hasOverride('owner') ? overrides?.owner : owner;
      const currentArea = hasOverride('area') ? overrides?.area : area;
      const params = new URLSearchParams();
      if (currentSearch?.trim()) params.set('search', currentSearch.trim());
      if (currentStatus) params.set('status', currentStatus);
      if (!currentStatus && currentStatusGroup) params.set('statusGroup', currentStatusGroup);
      if (currentSource) params.set('source', currentSource);
      if (currentOwner) params.set('owner', currentOwner);
      if (currentArea) params.set('area', currentArea);
      const query = params.toString();
      setData(await api<CustomerRow[]>(`/customers${query ? `?${query}` : ''}`));
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách khách hàng.');
    } finally {
      setLoading(false);
    }
  }, [area, owner, search, source, status, statusGroup]);

  useEffect(() => {
    void load();
    // Tải dữ liệu ban đầu; các bộ lọc được áp dụng bằng nút Tìm kiếm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api<CatalogOption[]>('/catalogs/categories/customer_status/options?activeOnly=true')
      .then(setCatalogStatuses)
      .catch(() => setCatalogStatuses(fallbackStatusOptions));
  }, []);

  const summary = useMemo(() => {
    const newCount = data.filter((item) => item.status === 'NEW').length;
    const caringCount = data.filter((item) =>
      ['CONTACTED', 'CARING', 'WAITING_SURVEY', 'SURVEYED', 'VISITED_SHOWROOM', 'WAITING_RESPONSE', 'PAUSED']
        .includes(item.status),
    ).length;
    const quotedCount = data.filter((item) => ['QUOTED', 'NEGOTIATING', 'CONVERTED', 'SIGNED'].includes(item.status)).length;
    return { total: data.length, newCount, caringCount, quotedCount };
  }, [data]);

  const ownerOptions = useMemo(
    () => Array.from(new Set(data.map((item) => item.owner).filter(Boolean)))
      .sort(textSorter.compare)
      .map((value) => ({ value, label: value })),
    [data],
  );

  const areaOptions = useMemo(
    () => Array.from(new Set(data.map((item) => item.area).filter(Boolean) as string[]))
      .sort(textSorter.compare)
      .map((value) => ({ value, label: value })),
    [data],
  );

  const activeFilterCount = [search.trim(), status, statusGroup, source, owner, area].filter(Boolean).length;

  const resetFilters = async () => {
    setSearch('');
    setStatus(undefined);
    setStatusGroup(undefined);
    setSource(undefined);
    setOwner(undefined);
    setArea(undefined);
    setLoading(true);
    try {
      setData(await api<CustomerRow[]>('/customers'));
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách khách hàng.');
    } finally {
      setLoading(false);
    }
  };

  const applyKpiFilter = async (group?: string) => {
    const nextGroup = statusGroup === group ? undefined : group;
    setStatus(undefined);
    setStatusGroup(nextGroup);
    await load({ status: undefined, statusGroup: nextGroup });
  };

  const exportCustomers = () => {
    exportCsv(`danh-sach-khach-hang-${dayjs().format('YYYYMMDD-HHmm')}`, data, [
      { header: 'Mã KH', value: (item) => item.code },
      { header: 'Khách hàng', value: (item) => item.name },
      { header: 'Số điện thoại', value: (item) => item.phone },
      { header: 'Email', value: (item) => item.email },
      { header: 'Khu vực', value: (item) => item.area },
      { header: 'Nguồn', value: (item) => item.source },
      { header: 'Nhân viên phụ trách', value: (item) => item.owner },
      { header: 'Trạng thái', value: (item) => statusMeta(statusOptions, item.status).label },
      { header: 'Ngày tạo', value: (item) => item.createdAt ? dayjs(item.createdAt).format('DD/MM/YYYY') : '' },
    ]);
  };

  const columns: ProColumns<CustomerRow>[] = [
    {
      title: 'Mã KH',
      dataIndex: 'code',
      width: 120,
      fixed: 'left',
      sorter: (a, b) => textSorter.compare(a.code, b.code),
      render: (value) => <Typography.Text copyable={{ text: String(value) }}>{String(value)}</Typography.Text>,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'name',
      width: 220,
      fixed: 'left',
      sorter: (a, b) => textSorter.compare(a.name, b.name),
      render: (_, item) => (
        <b className='table-primary-text'>{item.name}</b>
      ),
    },
    {
      title: 'Số điện thoại',
      dataIndex: 'phone',
      width: 150,
      render: (value) => <span className='table-phone-text'><PhoneOutlined /> {String(value)}</span>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      width: 220,
      render: (value) => value ? (
        <Tooltip title={String(value)}>
          <span className='table-cell-ellipsis'>{String(value)}</span>
        </Tooltip>
      ) : <Typography.Text type='secondary'>Chưa có email</Typography.Text>,
    },
    {
      title: 'Khu vực',
      dataIndex: 'area',
      width: 170,
      sorter: (a, b) => textSorter.compare(a.area ?? '', b.area ?? ''),
      render: (value) => value ? (
        <Tooltip title={String(value)}>
          <span className='table-cell-inline'>
            <EnvironmentOutlined />
            <span className='table-cell-inline-text table-cell-clamp'>{String(value)}</span>
          </span>
        </Tooltip>
      ) : '—',
    },
    { title: 'Nguồn', dataIndex: 'source', width: 130, sorter: (a, b) => textSorter.compare(a.source, b.source) },
    { title: 'Nhân viên phụ trách', dataIndex: 'owner', width: 180, sorter: (a, b) => textSorter.compare(a.owner, b.owner) },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 165,
      sorter: (a, b) => textSorter.compare(
        statusMeta(statusOptions, a.status).label,
        statusMeta(statusOptions, b.status).label,
      ),
      render: (_, item) => <CustomerStatus value={item.status} statusOptions={statusOptions} />,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      width: 130,
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
      render: (value) => value ? dayjs(String(value)).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Thao tác',
      valueType: 'option',
      width: 84,
      fixed: 'right',
      align: 'center',
      render: (_, item) => [
        <Dropdown
          key='actions'
          trigger={['click']}
          menu={{
            items: [
              {
                key: 'care',
                icon: <CalendarOutlined />,
                label: 'Ghi chăm sóc',
                onClick: () => router.push(`/care?customerId=${item.id}`),
              },
              {
                key: 'quotation',
                icon: <FileTextOutlined />,
                label: 'Tạo báo giá',
                onClick: () => router.push(`/quotations?customerId=${item.id}`),
              },
              {
                key: 'contract',
                icon: <FileProtectOutlined />,
                label: 'Tạo hợp đồng',
                onClick: () => router.push(`/contracts?customerId=${item.id}`),
              },
              {
                key: 'portal',
                icon: <TeamOutlined />,
                label: 'Quản lý portal',
                disabled: true,
              },
              { type: 'divider' },
              {
                key: 'delete',
                icon: <DeleteOutlined />,
                label: 'Xóa khách hàng',
                danger: true,
                disabled: true,
              },
            ],
          }}
        >
          <Tooltip title='Thao tác'>
            <Button type='text' className='table-action-button' icon={<EllipsisOutlined />} />
          </Tooltip>
        </Dropdown>,
      ],
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
          title: (
            <div className='page-title-stack'>
              <Typography.Title level={3}>Đăng ký khách hàng</Typography.Title>
              <Typography.Text>Quản lý khách hàng, nhu cầu ban đầu và người phụ trách</Typography.Text>
            </div>
          ),
          extra: (
            <Button type='primary' icon={<PlusOutlined />} onClick={() => setOpen(true)}>
              Thêm khách hàng
            </Button>
          ),
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
              <ProCard
                className={`mini-stat mini-stat-${item.tone} mini-stat-interactive ${kpiGroupByTone[item.tone] && statusGroup === kpiGroupByTone[item.tone] ? 'mini-stat-active' : ''}`}
                onClick={() => void applyKpiFilter(kpiGroupByTone[item.tone])}
              >
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
              placeholder='Tìm tên, SĐT, email hoặc mã KH...'
              allowClear
              className='filter-search'
            />
            <Select
              value={status}
              onChange={(value) => {
                setStatus(value);
                setStatusGroup(undefined);
              }}
              allowClear
              placeholder='Tất cả trạng thái'
              className='filter-select'
              options={statusOptions.map((item) => ({ value: item.code, label: item.label }))}
            />
            <Select
              value={source}
              onChange={setSource}
              allowClear
              placeholder='Nguồn khách'
              className='filter-select'
              options={sourceOptions.map((item) => ({ value: item, label: item }))}
            />
            <Select
              value={owner}
              onChange={setOwner}
              allowClear
              showSearch
              optionFilterProp='label'
              placeholder='Người phụ trách'
              className='filter-select'
              options={ownerOptions}
            />
            <Select
              value={area}
              onChange={setArea}
              allowClear
              showSearch
              optionFilterProp='label'
              placeholder='Khu vực'
              className='filter-select'
              options={areaOptions}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void resetFilters()}>
              Đặt lại{activeFilterCount ? ` (${activeFilterCount})` : ''}
            </Button>
            <Button type='primary' icon={<FilterOutlined />} onClick={() => void load()}>
              Áp dụng
            </Button>
            <Button icon={<DownloadOutlined />} onClick={exportCustomers}>
              Xuất CSV
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
            scroll={{ x: 1560 }}
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
                    <CustomerStatus value={customer.status} statusOptions={statusOptions} />
                  </Space>
                  <Descriptions size='small' column={1} className='mobile-descriptions'>
                    <Descriptions.Item label='Khu vực'>{customer.area || '—'}</Descriptions.Item>
                    <Descriptions.Item label='Email'>{customer.email || 'Chưa có email'}</Descriptions.Item>
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
