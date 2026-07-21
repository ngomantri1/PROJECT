'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Checkbox,
  Descriptions,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EllipsisOutlined,
  EyeOutlined,
  FileTextOutlined,
  FilterOutlined,
  PlusOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import AppStatusTag from '@/components/AppStatusTag';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exportCsv';

type CustomerRow = {
  id: string;
  code: string;
  customerId: string;
  customerCode?: string;
  name: string;
  phone: string;
  technicalSpecsJson?: string;
};

type ElevatorSpec = {
  id: string;
  name: string;
  floors?: number;
  capacityKg?: number;
  elevatorType?: string;
};

type QuotationCostLine = {
  id: string;
  category: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

type QuotationRow = {
  id: string;
  code: string;
  title: string;
  versionNo: number;
  status: string;
  validUntil?: string;
  customerId: string;
  consultationProfileId?: string;
  customerCode: string;
  customer: string;
  phone: string;
  owner: string;
  elevatorSpecsJson?: string;
  costLinesJson?: string;
  subtotalAmount: number;
  discountAmount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  notes?: string;
  sentAt?: string;
  approvedAt?: string;
  createdAt: string;
};

type QuotationForm = {
  consultationProfileId: string;
  title: string;
  validUntil?: string;
  status: string;
  discountAmount?: number;
  vatRate?: number;
  notes?: string;
};

type SaveResponse = {
  id: string;
  code: string;
};

const textSorter = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

const quotationStatuses = [
  { value: 'DRAFT', label: 'Nháp', color: 'default' },
  { value: 'PENDING', label: 'Chờ duyệt', color: 'gold' },
  { value: 'APPROVED', label: 'Đã duyệt', color: 'green' },
  { value: 'SENT', label: 'Đã gửi khách', color: 'cyan' },
  { value: 'ACCEPTED', label: 'Khách đồng ý', color: 'green' },
  { value: 'REJECTED', label: 'Từ chối', color: 'red' },
  { value: 'EXPIRED', label: 'Hết hiệu lực', color: 'default' },
];

const costCategories = ['Thiết bị', 'Lắp đặt', 'Vận chuyển', 'Kiểm định', 'Phụ kiện', 'Khác'];

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseJsonArray<T>(value?: string): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function toNumber(value: string | number | null | undefined, fallback = 0) {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function formatMoney(value?: number) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(value ?? 0))} đ`;
}

function statusMeta(value: string) {
  return quotationStatuses.find((item) => item.value === value) ?? { value, label: value, color: 'default' };
}

function makeDefaultCostLine(category = 'Thiết bị'): QuotationCostLine {
  return {
    id: createId('line'),
    category,
    description: category === 'Thiết bị' ? 'Thiết bị thang máy theo cấu hình đã chọn' : '',
    quantity: 1,
    unitPrice: 0,
  };
}

export default function Quotations() {
  const [form] = Form.useForm<QuotationForm>();
  const [rows, setRows] = useState<QuotationRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<QuotationRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string>();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>();
  const [routeConsultationProfileId, setRouteConsultationProfileId] = useState<string>();
  const [selectedSpecIds, setSelectedSpecIds] = useState<string[]>([]);
  const [costLines, setCostLines] = useState<QuotationCostLine[]>([makeDefaultCostLine()]);

  const selectedConsultationProfileId = Form.useWatch('consultationProfileId', form);
  const discountAmount = Form.useWatch('discountAmount', form) ?? 0;
  const vatRate = Form.useWatch('vatRate', form) ?? 10;

  const selectedCustomer = customers.find((customer) => customer.id === selectedConsultationProfileId);
  const routeCustomer = customers.find((customer) => customer.id === routeConsultationProfileId);
  const customerSpecs = useMemo(
    () => parseJsonArray<ElevatorSpec>(selectedCustomer?.technicalSpecsJson),
    [selectedCustomer?.technicalSpecsJson],
  );
  const selectedSpecs = useMemo(
    () => customerSpecs.filter((spec) => selectedSpecIds.includes(spec.id)),
    [customerSpecs, selectedSpecIds],
  );
  const subtotalAmount = useMemo(
    () => costLines.reduce((sum, line) => sum + Math.max(line.quantity, 0) * Math.max(line.unitPrice, 0), 0),
    [costLines],
  );
  const normalizedDiscount = Math.min(Math.max(discountAmount, 0), subtotalAmount);
  const taxableAmount = Math.max(subtotalAmount - normalizedDiscount, 0);
  const vatAmount = Math.round((taxableAmount * Math.max(vatRate, 0)) / 100);
  const totalAmount = taxableAmount + vatAmount;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      if (routeConsultationProfileId) params.set('consultationProfileId', routeConsultationProfileId);
      const query = params.toString();
      setRows(await api<QuotationRow[]>(`/quotations${query ? `?${query}` : ''}`));
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách báo giá.');
    } finally {
      setLoading(false);
    }
  }, [routeConsultationProfileId, search, status]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const consultationProfileId = params.get('consultationProfileId') ?? params.get('customerId') ?? undefined;
    setRouteConsultationProfileId(consultationProfileId);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 300);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    api<CustomerRow[]>('/consultation-profiles')
      .then(setCustomers)
      .catch((error: unknown) =>
        message.error(error instanceof Error ? error.message : 'Không tải được danh sách hồ sơ tư vấn.'),
      );
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelectedSpecIds(customerSpecs.map((spec) => spec.id));
  }, [customerSpecs, open]);

  const summary = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((item) => item.status === 'PENDING').length,
      sent: rows.filter((item) => item.status === 'SENT').length,
      accepted: rows.filter((item) => item.status === 'ACCEPTED').length,
      totalAmount: rows.reduce((sum, item) => sum + item.totalAmount, 0),
    }),
    [rows],
  );

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({
      consultationProfileId: routeConsultationProfileId,
      status: 'DRAFT',
      validUntil: dayjs().add(15, 'day').format('YYYY-MM-DD'),
      discountAmount: 0,
      vatRate: 10,
    });
    setSelectedSpecIds([]);
    setCostLines([makeDefaultCostLine()]);
    setOpen(true);
  };

  const updateCostLine = (id: string, patch: Partial<QuotationCostLine>) => {
    setCostLines((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      if (!costLines.length || subtotalAmount <= 0) {
        message.warning('Vui lòng nhập ít nhất một hạng mục chi phí có giá trị.');
        return;
      }

      setSaving(true);
      await api<SaveResponse>('/quotations', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          customerId: selectedCustomer?.customerId,
          validUntil: values.validUntil ? dayjs(values.validUntil).endOf('day').toISOString() : null,
          elevatorSpecsJson: JSON.stringify(selectedSpecs),
          costLinesJson: JSON.stringify(costLines),
          subtotalAmount,
          discountAmount: normalizedDiscount,
          vatRate,
          vatAmount,
          totalAmount,
        }),
      });
      message.success('Đã tạo báo giá');
      setOpen(false);
      await load();
    } catch (error) {
      if (error instanceof Error) message.error(error.message || 'Không lưu được báo giá.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (quotation: QuotationRow, nextStatus: string) => {
    if (quotation.status === nextStatus) return;
    setUpdatingStatusId(quotation.id);
    try {
      await api<void>(`/quotations/${quotation.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      message.success('Đã cập nhật trạng thái báo giá');
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không cập nhật được trạng thái.');
    } finally {
      setUpdatingStatusId(undefined);
    }
  };

  const exportQuotations = () => {
    exportCsv(`bao-gia-${dayjs().format('YYYYMMDD-HHmm')}`, rows, [
      { header: 'Mã báo giá', value: (item) => item.code },
      { header: 'Tên báo giá', value: (item) => item.title },
      { header: 'Khách hàng', value: (item) => item.customer },
      { header: 'Phiên bản', value: (item) => `V${item.versionNo}` },
      { header: 'Trạng thái', value: (item) => statusMeta(item.status).label },
      { header: 'Tạm tính', value: (item) => item.subtotalAmount },
      { header: 'Chiết khấu', value: (item) => item.discountAmount },
      { header: 'VAT', value: (item) => item.vatAmount },
      { header: 'Tổng tiền', value: (item) => item.totalAmount },
      { header: 'Phụ trách', value: (item) => item.owner },
      { header: 'Ngày tạo', value: (item) => dayjs(item.createdAt).format('DD/MM/YYYY') },
    ]);
  };

  const columns: ProColumns<QuotationRow>[] = [
    {
      title: 'Mã báo giá',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
      sorter: (a, b) => textSorter.compare(a.code, b.code),
      render: (_, item) => (
        <span>
          <Typography.Text copyable={{ text: item.code }} strong>
            {item.code}
          </Typography.Text>
          <small className='table-secondary-text'>V{item.versionNo}</small>
        </span>
      ),
    },
    {
      title: 'Khách hàng / Báo giá',
      dataIndex: 'title',
      width: 320,
      sorter: (a, b) => textSorter.compare(a.title, b.title),
      render: (_, item) => (
        <Space>
          <Avatar className='customer-avatar'>{item.customer.charAt(0)}</Avatar>
          <span>
            <b className='table-primary-text'>{item.customer}</b>
            <small className='table-secondary-text'>{item.title}</small>
          </span>
        </Space>
      ),
    },
    {
      title: 'Số thang',
      width: 95,
      align: 'center',
      render: (_, item) => parseJsonArray<ElevatorSpec>(item.elevatorSpecsJson).length || '-',
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'totalAmount',
      width: 150,
      align: 'right',
      sorter: (a, b) => a.totalAmount - b.totalAmount,
      render: (_, item) => <Typography.Text strong>{formatMoney(item.totalAmount)}</Typography.Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 140,
      sorter: (a, b) => textSorter.compare(statusMeta(a.status).label, statusMeta(b.status).label),
      render: (_, item) => {
        const meta = statusMeta(item.status);
        return <AppStatusTag value={item.status} label={meta.label} color={meta.color} />;
      },
    },
    { title: 'Phụ trách', dataIndex: 'owner', width: 160, sorter: (a, b) => textSorter.compare(a.owner, b.owner) },
    {
      title: 'Hiệu lực',
      dataIndex: 'validUntil',
      width: 120,
      sorter: (a, b) => dayjs(a.validUntil).valueOf() - dayjs(b.validUntil).valueOf(),
      render: (_, item) => (item.validUntil ? dayjs(item.validUntil).format('DD/MM/YYYY') : '-'),
    },
    {
      title: 'Thao tác',
      valueType: 'option',
      width: 95,
      align: 'center',
      fixed: 'right',
      render: (_, item) => [
        <Space key='actions' size={2} className='table-actions table-actions-center'>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'view', icon: <EyeOutlined />, label: 'Xem chi tiết', onClick: () => setDetail(item) },
                { key: 'sent', icon: <SendOutlined />, label: 'Đã gửi khách', onClick: () => void updateStatus(item, 'SENT') },
                { key: 'approved', icon: <CheckCircleOutlined />, label: 'Đã duyệt', onClick: () => void updateStatus(item, 'APPROVED') },
                { key: 'accepted', icon: <CheckCircleOutlined />, label: 'Khách đồng ý', onClick: () => void updateStatus(item, 'ACCEPTED') },
              ],
            }}
          >
            <Button
              aria-label='Mở thao tác báo giá'
              type='text'
              loading={updatingStatusId === item.id}
              className='table-action-button'
              icon={<EllipsisOutlined />}
            />
          </Dropdown>
        </Space>,
      ],
    },
  ];

  return (
    <PageContainer
      className='erp-page-container'
      header={{
        title: (
          <div className='page-title-stack'>
            <Typography.Title level={3}>Báo giá</Typography.Title>
            <Typography.Text>Quản lý báo giá theo khách hàng, cấu hình thang, phiên bản và tổng tiền</Typography.Text>
          </div>
        ),
        extra: (
          <Button type='primary' icon={<PlusOutlined />} onClick={openCreate}>
            Thêm báo giá
          </Button>
        ),
        breadcrumb: {},
      }}
    >
      <Space direction='vertical' size={16} style={{ width: '100%' }}>
        <div className='quotation-kpi-grid erp-kpi-grid'>
          {[
            { label: 'Tổng báo giá', value: summary.total, icon: <FileTextOutlined />, tone: 'blue' },
            { label: 'Chờ duyệt', value: summary.pending, icon: <FilterOutlined />, tone: 'orange' },
            { label: 'Đã gửi khách', value: summary.sent, icon: <SendOutlined />, tone: 'cyan' },
            { label: 'Khách đồng ý', value: summary.accepted, icon: <CheckCircleOutlined />, tone: 'green' },
            { label: 'Tổng giá trị', value: formatMoney(summary.totalAmount), icon: <FileTextOutlined />, tone: 'green' },
          ].map((item) => (
            <ProCard key={item.label} className={`mini-stat mini-stat-${item.tone}`}>
              <span className='mini-stat-icon'>{item.icon}</span>
              <span>
                <small>{item.label}</small>
                <b>{item.value}</b>
              </span>
            </ProCard>
          ))}
        </div>

        <ProCard className='filter-card'>
          <div className='filter-row'>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder='Tìm mã, khách hàng, số điện thoại hoặc người phụ trách...'
              allowClear
              className='filter-search'
            />
            <Select
              value={status}
              onChange={setStatus}
              allowClear
              placeholder='Tất cả trạng thái'
              className='filter-select'
              options={quotationStatuses}
            />
            <Typography.Text className='filter-result-count'>{rows.length} báo giá</Typography.Text>
            {routeCustomer && (
              <Tag closable onClose={() => setRouteConsultationProfileId(undefined)}>
                {routeCustomer.code} - {routeCustomer.name}
              </Tag>
            )}
            <Button
              onClick={() => {
                setSearch('');
                setStatus(undefined);
              }}
            >
              Đặt lại
            </Button>
            <Button icon={<DownloadOutlined />} onClick={exportQuotations}>
              Xuất CSV
            </Button>
          </div>
        </ProCard>

        <div className='desktop-table'>
          <ProTable<QuotationRow>
            rowKey='id'
            loading={loading}
            dataSource={rows}
            columns={columns}
            search={false}
            cardBordered
            headerTitle='Danh sách báo giá'
            options={{ density: true, fullScreen: true, reload: () => void load() }}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${total} báo giá` }}
            scroll={{ x: 1240 }}
            onRow={(record) => ({ onDoubleClick: () => setDetail(record) })}
          />
        </div>

        <div className='mobile-card-list'>
          <List
            loading={loading}
            dataSource={rows}
            locale={{ emptyText: 'Chưa có báo giá' }}
            renderItem={(item) => {
              const meta = statusMeta(item.status);
              return (
                <List.Item>
                  <ProCard className='mobile-record-card' onClick={() => setDetail(item)}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }} align='start'>
                      <Space align='start'>
                        <Avatar className='customer-avatar'>{item.customer.charAt(0)}</Avatar>
                        <span>
                          <Typography.Text strong>{item.customer}</Typography.Text>
                          <small className='table-secondary-text'>
                            {item.code} - {formatMoney(item.totalAmount)}
                          </small>
                        </span>
                      </Space>
                      <AppStatusTag value={item.status} label={meta.label} color={meta.color} />
                    </Space>
                  </ProCard>
                </List.Item>
              );
            }}
          />
        </div>
      </Space>

      <Drawer
        title='Tạo báo giá'
        open={open}
        onClose={() => setOpen(false)}
        width='min(980px, calc(100vw - 40px))'
        className='quotation-form-drawer'
        footer={(
          <div className='quotation-drawer-footer'>
            <Button onClick={() => setOpen(false)}>Hủy</Button>
            <Button type='primary' loading={saving} onClick={() => void save()}>
              Lưu báo giá
            </Button>
          </div>
        )}
      >
        <Form form={form} layout='vertical' requiredMark>
          <div className='quotation-form-layout'>
            <div className='quotation-form-main'>
              <div className='form-section-heading'>Thông tin báo giá</div>
              <Form.Item name='consultationProfileId' label='Hồ sơ tư vấn' rules={[{ required: true, message: 'Vui lòng chọn hồ sơ tư vấn' }]}>
                <Select
                  showSearch
                  optionFilterProp='label'
                  placeholder='Chọn hồ sơ tư vấn'
                  options={customers.map((customer) => ({
                    value: customer.id,
                    label: `${customer.code} - ${customer.name} - ${customer.phone}`,
                  }))}
                />
              </Form.Item>
              <div className='quotation-form-grid two-columns'>
                <Form.Item name='title' label='Tên báo giá' rules={[{ required: true, message: 'Vui lòng nhập tên báo giá' }]}>
                  <Input placeholder='Ví dụ: Báo giá thang máy gia đình 450kg' />
                </Form.Item>
                <Form.Item name='validUntil' label='Hiệu lực đến'>
                  <Input type='date' />
                </Form.Item>
                <Form.Item name='status' label='Trạng thái'>
                  <Select options={quotationStatuses} />
                </Form.Item>
                <Form.Item name='vatRate' label='VAT (%)'>
                  <InputNumber min={0} max={20} />
                </Form.Item>
              </div>

              <div className='quotation-section-head'>
                <span>Cấu hình thang áp dụng</span>
                <Typography.Text type='secondary'>{selectedSpecs.length} cấu hình được chọn</Typography.Text>
              </div>
              {customerSpecs.length ? (
                <Checkbox.Group value={selectedSpecIds} onChange={(values) => setSelectedSpecIds(values.map(String))}>
                  <div className='quotation-spec-list'>
                    {customerSpecs.map((spec) => (
                      <label key={spec.id} className='quotation-spec-item'>
                        <Checkbox value={spec.id} />
                        <span>
                          <b>{spec.name}</b>
                          <small>
                            {spec.floors ? `${spec.floors} tầng` : 'Chưa nhập số tầng'}
                            {spec.capacityKg ? ` - ${spec.capacityKg} kg` : ''}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                </Checkbox.Group>
              ) : (
                <div className='quotation-empty-inline'>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description='Hồ sơ tư vấn chưa có cấu hình thang.' />
                </div>
              )}

              <div className='quotation-section-head'>
                <span>Hạng mục chi phí</span>
                <Button icon={<PlusOutlined />} onClick={() => setCostLines((items) => [...items, makeDefaultCostLine('Khác')])}>
                  Thêm hạng mục
                </Button>
              </div>
              <div className='quotation-cost-lines'>
                <div className='quotation-cost-line head'>
                  <span>Loại</span>
                  <span>Mô tả</span>
                  <span>SL</span>
                  <span>Đơn giá</span>
                  <span>Xóa</span>
                </div>
                {costLines.map((line) => (
                  <div key={line.id} className='quotation-cost-line'>
                    <Select
                      value={line.category}
                      options={costCategories.map((value) => ({ value, label: value }))}
                      onChange={(category) => updateCostLine(line.id, { category })}
                    />
                    <Input
                      value={line.description}
                      placeholder='Mô tả hạng mục'
                      onChange={(event) => updateCostLine(line.id, { description: event.target.value })}
                    />
                    <InputNumber
                      min={1}
                      value={line.quantity}
                      onChange={(quantity) => updateCostLine(line.id, { quantity: toNumber(quantity, 1) })}
                    />
                    <InputNumber
                      min={0}
                      value={line.unitPrice}
                      formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(value) => toNumber(value?.replace(/\$\s?|(,*)/g, ''), 0)}
                      onChange={(unitPrice) => updateCostLine(line.id, { unitPrice: toNumber(unitPrice, 0) })}
                    />
                    <Tooltip title='Xóa hạng mục'>
                      <Button
                        type='text'
                        danger
                        aria-label='Xóa hạng mục'
                        icon={<DeleteOutlined />}
                        onClick={() => setCostLines((items) => items.filter((item) => item.id !== line.id))}
                      />
                    </Tooltip>
                  </div>
                ))}
              </div>

              <Form.Item name='notes' label='Ghi chú thương mại'>
                <Input.TextArea rows={3} placeholder='Điều kiện giao hàng, hiệu lực báo giá, lưu ý thanh toán...' />
              </Form.Item>
            </div>

            <aside className='quotation-summary-panel'>
              <div className='quotation-summary-title'>Tóm tắt báo giá</div>
              <div className='quotation-summary-row'>
                <span>Tạm tính</span>
                <b>{formatMoney(subtotalAmount)}</b>
              </div>
              <Form.Item name='discountAmount' label='Chiết khấu'>
                <InputNumber
                  min={0}
                  max={subtotalAmount}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => toNumber(value?.replace(/\$\s?|(,*)/g, ''), 0)}
                />
              </Form.Item>
              <div className='quotation-summary-row'>
                <span>Sau chiết khấu</span>
                <b>{formatMoney(taxableAmount)}</b>
              </div>
              <div className='quotation-summary-row'>
                <span>VAT {vatRate || 0}%</span>
                <b>{formatMoney(vatAmount)}</b>
              </div>
              <div className='quotation-summary-total'>
                <span>Tổng thanh toán</span>
                <b>{formatMoney(totalAmount)}</b>
              </div>
            </aside>
          </div>
        </Form>
      </Drawer>

      <Drawer
        title={detail ? `${detail.code} - ${detail.customer}` : 'Chi tiết báo giá'}
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        width='min(760px, calc(100vw - 40px))'
        className='business-detail-drawer quotation-detail-drawer'
      >
        {detail && (
          <>
            <Descriptions bordered column={1} size='middle'>
              <Descriptions.Item label='Báo giá'>{detail.title}</Descriptions.Item>
              <Descriptions.Item label='Khách hàng'>
                {detail.customerCode} - {detail.customer}
              </Descriptions.Item>
              <Descriptions.Item label='Phiên bản'>V{detail.versionNo}</Descriptions.Item>
              <Descriptions.Item label='Trạng thái'>
                <AppStatusTag
                  value={detail.status}
                  label={statusMeta(detail.status).label}
                  color={statusMeta(detail.status).color}
                />
              </Descriptions.Item>
              <Descriptions.Item label='Tạm tính'>{formatMoney(detail.subtotalAmount)}</Descriptions.Item>
              <Descriptions.Item label='Chiết khấu'>{formatMoney(detail.discountAmount)}</Descriptions.Item>
              <Descriptions.Item label='VAT'>{formatMoney(detail.vatAmount)}</Descriptions.Item>
              <Descriptions.Item label='Tổng tiền'>{formatMoney(detail.totalAmount)}</Descriptions.Item>
            </Descriptions>
            <ProCard title='Cấu hình thang' className='section-gap'>
              {parseJsonArray<ElevatorSpec>(detail.elevatorSpecsJson).length ? (
                <Space direction='vertical' style={{ width: '100%' }}>
                  {parseJsonArray<ElevatorSpec>(detail.elevatorSpecsJson).map((spec) => (
                    <div key={spec.id} className='quotation-detail-line'>
                      <b>{spec.name}</b>
                      <span>
                        {spec.floors ? `${spec.floors} tầng` : 'Chưa nhập số tầng'}
                        {spec.capacityKg ? ` - ${spec.capacityKg} kg` : ''}
                      </span>
                    </div>
                  ))}
                </Space>
              ) : (
                <Typography.Text type='secondary'>Chưa chọn cấu hình thang.</Typography.Text>
              )}
            </ProCard>
            <ProCard title='Hạng mục chi phí' className='section-gap'>
              <Space direction='vertical' style={{ width: '100%' }}>
                {parseJsonArray<QuotationCostLine>(detail.costLinesJson).map((line) => (
                  <div key={line.id} className='quotation-detail-line'>
                    <b>{line.category}</b>
                    <span>
                      {line.description || 'Không có mô tả'} - {line.quantity} x {formatMoney(line.unitPrice)}
                    </span>
                  </div>
                ))}
              </Space>
            </ProCard>
          </>
        )}
      </Drawer>
    </PageContainer>
  );
}
