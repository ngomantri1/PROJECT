'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, Col, Descriptions, Empty, Result, Row, Space, Spin, Table, Tabs, Tag, Timeline, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PageContainer, ProCard } from '@ant-design/pro-components';
import { AppstoreOutlined, ArrowLeftOutlined, BuildOutlined, CalendarOutlined, CustomerServiceOutlined, DollarOutlined, FileTextOutlined, FundProjectionScreenOutlined, HistoryOutlined, PhoneOutlined, ProfileOutlined, SafetyCertificateOutlined, ToolOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppStatusTag from '@/components/AppStatusTag';
import Customer360TableActions from '@/components/Customer360TableActions';
import { api } from '@/lib/api';

type ConsultationProfile = {
  id: string;
  code: string;
  profileType: string;
  status: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
  technicalConfigurationCount: number;
  quotationCount: number;
  customerElevatorCount: number;
};

type Quotation = {
  id: string;
  code: string;
  title: string;
  status: string;
  totalAmount: number;
  consultationProfileId?: string;
  consultationProfileCode?: string;
  createdAt: string;
};

type CustomerElevator = {
  id: string;
  code: string;
  name: string;
  elevatorType?: string;
  status: string;
  installationAddress?: string;
  contractReference?: string;
  signedAt?: string;
  handedOverAt?: string;
  warrantyExpiresAt?: string;
  consultationProfileCode?: string;
  sourceQuotationId?: string;
  sourceQuotationCode?: string;
  sourceQuotationTotalAmount?: number;
};

type CustomerContract = {
  reference: string;
  elevators: CustomerElevator[];
  quotationCodes: string[];
  contractValue?: number;
  signedAt?: string;
};

type ConsultationElevator = {
  id: string;
  configurationId: string;
  consultationProfileId: string;
  consultationProfileCode: string;
  consultationProfileStatus: string;
  name: string;
  elevatorType?: string;
  floors?: number;
  capacityKg?: number;
  installationAddress?: string;
  area?: string;
};

type AuditEntry = {
  id: string;
  createdAt: string;
  username?: string;
  action: string;
  module?: string;
  entityType?: string;
  details?: string;
};

type CareActivity = {
  id: string;
  careType: string;
  scheduledAt: string;
  content: string;
  result?: string;
  status: string;
  nextCareAt?: string;
  assignee?: string;
};

type Customer360 = {
  customer: {
    id: string;
    code: string;
    name: string;
    phone: string;
    email?: string;
    address?: string;
    customerType: 'PERSONAL' | 'BUSINESS';
    source?: string;
    status: string;
    owner?: string;
  };
  summary: {
    consultationProfileCount: number;
    technicalConfigurationCount: number;
    quotationCount: number;
    customerElevatorCount: number;
    activeElevatorCount: number;
  };
  consultationProfiles: ConsultationProfile[];
  consultationElevators: ConsultationElevator[];
  quotations: Quotation[];
  elevators: CustomerElevator[];
  history: AuditEntry[];
};

const tabs = ['overview', 'profiles', 'elevators', 'quotations', 'contracts', 'receivables', 'progress', 'maintenance', 'care', 'history'] as const;
type CustomerTab = (typeof tabs)[number];

const tabLabels: Record<CustomerTab, string> = {
  overview: 'Tổng quan',
  profiles: 'Hồ sơ tư vấn',
  elevators: 'Thang máy',
  quotations: 'Báo giá',
  contracts: 'Hợp đồng',
  receivables: 'Công nợ',
  progress: 'Tiến độ',
  maintenance: 'Bảo trì',
  care: 'Chăm sóc',
  history: 'Lịch sử',
};

const tabIcons: Record<CustomerTab, ReactNode> = {
  overview: <AppstoreOutlined />,
  profiles: <ProfileOutlined />,
  elevators: <BuildOutlined />,
  quotations: <FileTextOutlined />,
  contracts: <SafetyCertificateOutlined />,
  receivables: <DollarOutlined />,
  progress: <FundProjectionScreenOutlined />,
  maintenance: <CustomerServiceOutlined />,
  care: <CalendarOutlined />,
  history: <HistoryOutlined />,
};

function tabLabel(tab: CustomerTab, count?: number) {
  return <span className='customer-360-tab-label'>{tabIcons[tab]}<span>{tabLabels[tab]}{count !== undefined ? ` (${count})` : ''}</span></span>;
}

const statusColor: Record<string, string> = {
  NEW: 'blue',
  CONTACTED: 'cyan',
  CARING: 'green',
  WAITING_SURVEY: 'purple',
  SURVEYED: 'purple',
  VISITED_SHOWROOM: 'geekblue',
  QUOTED: 'cyan',
  WAITING_RESPONSE: 'orange',
  NEGOTIATING: 'orange',
  CONVERTED: 'green',
  PAUSED: 'default',
  ACTIVE: 'green',
  CLOSED: 'default',
  WON: 'green',
  LOST: 'red',
  DRAFT: 'default',
  SENT: 'blue',
  APPROVED: 'green',
  ACCEPTED: 'green',
  SIGNED: 'green',
  PENDING_IMPLEMENTATION: 'gold',
  IMPLEMENTING: 'blue',
  WARRANTY: 'cyan',
  MAINTENANCE: 'purple',
  COMPLETED: 'green',
};

const statusLabel: Record<string, string> = {
  NEW: 'Mới tiếp nhận',
  CONTACTED: 'Đã liên hệ',
  CARING: 'Đang chăm sóc',
  WAITING_SURVEY: 'Chờ khảo sát',
  SURVEYED: 'Đã khảo sát',
  VISITED_SHOWROOM: 'Đã xem thang mẫu',
  QUOTED: 'Đã gửi báo giá',
  WAITING_RESPONSE: 'Chờ phản hồi',
  NEGOTIATING: 'Đang đàm phán',
  CONVERTED: 'Đã chuyển sang hợp đồng',
  PAUSED: 'Tạm dừng chăm sóc',
  ACTIVE: 'Đang hoạt động',
  CLOSED: 'Đã đóng',
  WON: 'Thành công',
  LOST: 'Không thành công',
  DRAFT: 'Nháp',
  SENT: 'Đã gửi',
  APPROVED: 'Đã duyệt',
  ACCEPTED: 'Đã chấp nhận',
  SIGNED: 'Đã ký hợp đồng',
  PENDING_IMPLEMENTATION: 'Chờ triển khai',
  IMPLEMENTING: 'Đang triển khai',
  WARRANTY: 'Đang bảo hành',
  MAINTENANCE: 'Đang bảo trì',
  COMPLETED: 'Hoàn thành',
};

function formatStatus(value?: string) {
  if (!value) return '-';
  return statusLabel[value] ?? value.replaceAll('_', ' ');
}

function StatusTag({ value }: { value?: string }) {
  return (
    <AppStatusTag
      value={value ?? ''}
      label={formatStatus(value)}
      color={statusColor[value ?? '']}
    />
  );
}

function formatCurrency(value?: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value ?? 0);
}

function lifecyclePhase(status?: string) {
  const phases: Record<string, string> = {
    PENDING_IMPLEMENTATION: 'Chờ triển khai',
    IMPLEMENTING: 'Đang triển khai',
    COMPLETED: 'Hoàn thành',
    WARRANTY: 'Bảo hành',
    MAINTENANCE: 'Bảo trì',
  };
  return phases[status ?? ''] ?? formatStatus(status);
}

function elevatorTypeLabel(value?: string) {
  const labels: Record<string, string> = { BUILT: 'Thang xây', GLASS: 'Thang kính' };
  return value ? labels[value] ?? value : '-';
}

export default function Customer360Page() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = params.id;
  const requestedTab = searchParams.get('tab');
  const requestedProfileId = searchParams.get('profileId');
  const returnTo = searchParams.get('returnTo');
  const returnTarget = returnTo === 'consultation-profiles' ? '/customers' : '/business/customers';
  const returnLabel = returnTo === 'consultation-profiles' ? 'Danh sách hồ sơ tư vấn' : 'Danh sách khách hàng';
  const activeTab: CustomerTab = tabs.includes(requestedTab as CustomerTab) ? requestedTab as CustomerTab : 'overview';
  const [data, setData] = useState<Customer360>();
  const [careActivities, setCareActivities] = useState<CareActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const overview = await api<Customer360>(`/customers/${customerId}/customer-360`);
      setData(overview);
      try {
        setCareActivities(await api<CareActivity[]>(`/customers/${customerId}/care-activities`));
      } catch {
        setCareActivities([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được hồ sơ Customer 360.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (activeTab !== 'profiles' || !requestedProfileId || !data?.consultationProfiles.some((profile) => profile.id === requestedProfileId)) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`consultation-profile-${requestedProfileId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, data?.consultationProfiles, requestedProfileId]);

  const contracts = useMemo(() => {
    if (!data) return [] as CustomerContract[];
    const groups = new Map<string, CustomerElevator[]>();
    data.elevators.forEach((elevator) => {
      if (!elevator.contractReference) return;
      groups.set(elevator.contractReference, [...(groups.get(elevator.contractReference) ?? []), elevator]);
    });
    return Array.from(groups, ([reference, elevators]) => {
      const sourceQuotations = Array.from(new Map(
        elevators
          .filter((elevator) => elevator.sourceQuotationId)
          .map((elevator) => [elevator.sourceQuotationId!, elevator]),
      ).values());
      const knownValues = sourceQuotations
        .map((elevator) => elevator.sourceQuotationTotalAmount)
        .filter((value): value is number => typeof value === 'number');

      return {
        reference,
        elevators,
        quotationCodes: sourceQuotations.map((elevator) => elevator.sourceQuotationCode).filter((code): code is string => Boolean(code)),
        contractValue: knownValues.length === sourceQuotations.length && knownValues.length > 0
          ? knownValues.reduce((total, value) => total + value, 0)
          : undefined,
        signedAt: elevators.map((elevator) => elevator.signedAt).filter((value): value is string => Boolean(value)).sort().at(-1),
      };
    });
  }, [data]);

  const implementationElevators = useMemo(
    () => data?.elevators.filter((elevator) => ['PENDING_IMPLEMENTATION', 'IMPLEMENTING', 'COMPLETED', 'WARRANTY', 'MAINTENANCE'].includes(elevator.status)) ?? [],
    [data],
  );

  const maintenanceElevators = useMemo(
    () => data?.elevators.filter((elevator) => Boolean(elevator.handedOverAt) || ['WARRANTY', 'MAINTENANCE'].includes(elevator.status)) ?? [],
    [data],
  );

  const knownContractValue = useMemo(
    () => contracts.reduce((total, contract) => total + (contract.contractValue ?? 0), 0),
    [contracts],
  );

  const changeTab = (tab: string) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set('tab', tab);
    router.replace(`/business/customers/${customerId}?${nextSearchParams.toString()}`);
  };

  const configurationUrl = (item: ConsultationElevator, mode?: 'edit') => {
    const query = new URLSearchParams({
      returnTo: 'customer360',
      customerId,
      customerReturnTo: returnTo === 'consultation-profiles' ? 'consultation-profiles' : 'customers',
    });
    if (mode === 'edit') query.set('mode', 'edit');
    return `/consultation-profiles/${item.consultationProfileId}/configurations/${item.configurationId}?${query.toString()}`;
  };

  const profileColumns: ColumnsType<ConsultationProfile> = [
    { title: 'Mã hồ sơ', dataIndex: 'code', width: 150, render: (_, item) => <Tooltip title='Mở chi tiết hồ sơ tư vấn'><Typography.Link className='record-link record-link-code' onClick={() => router.push(`/consultation-profiles/${item.id}`)}>{item.code}</Typography.Link></Tooltip> },
    { title: 'Trạng thái', dataIndex: 'status', width: 150, render: (value) => <StatusTag value={value} /> },
    { title: 'Nguồn', dataIndex: 'source', width: 150, render: (value) => value || '-' },
    { title: 'Cấu hình thang', dataIndex: 'technicalConfigurationCount', align: 'right', width: 150 },
    { title: 'Báo giá', dataIndex: 'quotationCount', align: 'right', width: 110 },
    { title: 'Tạo ngày', dataIndex: 'createdAt', width: 130, render: (value) => dayjs(value).format('DD/MM/YYYY') },
    { title: 'Thao tác', key: 'actions', width: 116, fixed: 'right', align: 'center', render: (_, item) => <Customer360TableActions onView={() => router.push(`/consultation-profiles/${item.id}`)} onEdit={() => router.push(`/customers?profileId=${item.id}`)} viewLabel='Xem hồ sơ tư vấn' editLabel='Sửa hồ sơ tư vấn' moreItems={[{ key: 'quotations', label: 'Mở báo giá liên kết', onClick: () => router.push(`/quotations?consultationProfileId=${item.id}`) }]} /> },
  ];

  const consultationProfileRowProps = (profile: ConsultationProfile) => ({
    id: `consultation-profile-${profile.id}`,
    className: profile.id === requestedProfileId ? 'customer-360-focused-row' : undefined,
  });

  const elevatorColumns: ColumnsType<CustomerElevator> = [
    { title: 'Mã thang', dataIndex: 'code', width: 130 },
    { title: 'Tên thang', dataIndex: 'name', width: 180 },
    { title: 'Loại thang máy', dataIndex: 'elevatorType', width: 160, render: (value) => elevatorTypeLabel(value) },
    { title: 'Trạng thái', dataIndex: 'status', width: 170, render: (value) => <StatusTag value={value} /> },
    { title: 'Hồ sơ nguồn', dataIndex: 'consultationProfileCode', width: 150, render: (value) => value || '-' },
    { title: 'Vị trí lắp đặt', dataIndex: 'installationAddress', render: (value) => value || '-' },
    { title: 'Thao tác', key: 'actions', width: 96, fixed: 'right', align: 'center', render: (_, item) => <Customer360TableActions onView={() => router.push(item.contractReference ? `/quotations?contractReference=${encodeURIComponent(item.contractReference)}` : '/quotations')} viewLabel={item.contractReference ? 'Mở hợp đồng nguồn' : 'Xem báo giá nguồn'} /> },
  ];

  const consultationElevatorColumns: ColumnsType<ConsultationElevator> = [
    { title: 'Tên thang', dataIndex: 'name', width: 190, render: (_, item) => <Tooltip title='Xem cấu hình kỹ thuật'><Typography.Link className='record-link' onClick={() => router.push(configurationUrl(item))}>{item.name}</Typography.Link></Tooltip> },
    { title: 'Loại thang máy', dataIndex: 'elevatorType', width: 160, render: (value) => elevatorTypeLabel(value) },
    { title: 'Số tầng', dataIndex: 'floors', align: 'right', width: 100, render: (value) => value ?? '-' },
    { title: 'Tải trọng', dataIndex: 'capacityKg', align: 'right', width: 130, render: (value) => value ? `${value} kg` : '-' },
    { title: 'Hồ sơ nguồn', dataIndex: 'consultationProfileCode', width: 155, render: (_, item) => <Typography.Link className='record-link record-link-code' onClick={() => router.push(`/consultation-profiles/${item.consultationProfileId}`)}>{item.consultationProfileCode}</Typography.Link> },
    { title: 'Trạng thái hồ sơ', dataIndex: 'consultationProfileStatus', width: 155, render: (value) => <StatusTag value={value} /> },
    { title: 'Vị trí lắp đặt', dataIndex: 'installationAddress', render: (value, item) => value || item.area || '-' },
    { title: 'Thao tác', key: 'actions', width: 96, fixed: 'right', align: 'center', render: (_, item) => <Customer360TableActions onView={() => router.push(configurationUrl(item))} onEdit={() => router.push(configurationUrl(item, 'edit'))} viewLabel='Xem cấu hình kỹ thuật' editLabel='Sửa cấu hình kỹ thuật' /> },
  ];

  const quotationColumns: ColumnsType<Quotation> = [
    { title: 'Mã báo giá', dataIndex: 'code', width: 150, render: (value) => <Typography.Link onClick={() => router.push('/quotations')}>{value}</Typography.Link> },
    { title: 'Tên báo giá', dataIndex: 'title' },
    { title: 'Hồ sơ tư vấn', dataIndex: 'consultationProfileCode', width: 155, render: (value) => value || '-' },
    { title: 'Trạng thái', dataIndex: 'status', width: 145, render: (value) => <StatusTag value={value} /> },
    { title: 'Giá trị', dataIndex: 'totalAmount', align: 'right', width: 170, render: (value) => formatCurrency(value) },
    { title: 'Ngày tạo', dataIndex: 'createdAt', width: 130, render: (value) => dayjs(value).format('DD/MM/YYYY') },
    { title: 'Thao tác', key: 'actions', width: 82, fixed: 'right', align: 'center', render: (_, item) => <Customer360TableActions onView={() => router.push(`/quotations?consultationProfileId=${item.consultationProfileId ?? ''}`)} viewLabel='Xem báo giá' /> },
  ];

  const receivableColumns: ColumnsType<CustomerContract> = [
    { title: 'Mã hợp đồng', dataIndex: 'reference', width: 170, render: (value) => <Typography.Link className='record-link record-link-code' onClick={() => router.push(`/quotations?contractReference=${encodeURIComponent(value)}`)}>{value}</Typography.Link> },
    { title: 'Báo giá nguồn', dataIndex: 'quotationCodes', width: 180, render: (value: string[]) => value.length ? value.join(', ') : 'Chưa liên kết' },
    { title: 'Giá trị hợp đồng', dataIndex: 'contractValue', align: 'right', width: 180, render: (value?: number) => value === undefined ? 'Chưa có dữ liệu' : formatCurrency(value) },
    { title: 'Đã thu', align: 'right', width: 150, render: () => 'Chưa ghi nhận' },
    { title: 'Còn phải thu', align: 'right', width: 160, render: () => 'Chưa có dữ liệu' },
    { title: 'Quá hạn', align: 'right', width: 130, render: () => 'Chưa có dữ liệu' },
    { title: 'Thao tác', key: 'actions', width: 82, fixed: 'right', align: 'center', render: (_, item) => <Customer360TableActions onView={() => router.push(`/quotations?contractReference=${encodeURIComponent(item.reference)}`)} viewLabel='Xem hợp đồng' /> },
  ];

  const progressColumns: ColumnsType<CustomerElevator> = [
    { title: 'Mã thang', dataIndex: 'code', width: 135 },
    { title: 'Tên thang', dataIndex: 'name', width: 180 },
    { title: 'Hợp đồng', dataIndex: 'contractReference', width: 170, render: (value) => value || '-' },
    { title: 'Giai đoạn hiện tại', dataIndex: 'status', width: 175, render: (value) => lifecyclePhase(value) },
    { title: 'Trạng thái', dataIndex: 'status', width: 155, render: (value) => <StatusTag value={value} /> },
    { title: 'Ngày ký', dataIndex: 'signedAt', width: 125, render: (value) => value ? dayjs(value).format('DD/MM/YYYY') : '-' },
    { title: 'Bàn giao', dataIndex: 'handedOverAt', width: 125, render: (value) => value ? dayjs(value).format('DD/MM/YYYY') : '-' },
    { title: 'Thao tác', key: 'actions', width: 82, fixed: 'right', align: 'center', render: (_, item) => <Customer360TableActions onView={() => router.push(item.contractReference ? `/quotations?contractReference=${encodeURIComponent(item.contractReference)}` : '/quotations')} viewLabel='Xem thang máy tài sản' /> },
  ];

  const maintenanceColumns: ColumnsType<CustomerElevator> = [
    { title: 'Mã thang', dataIndex: 'code', width: 135 },
    { title: 'Tên thang', dataIndex: 'name', width: 180 },
    { title: 'Hợp đồng', dataIndex: 'contractReference', width: 170, render: (value) => value || '-' },
    { title: 'Tình trạng', dataIndex: 'status', width: 160, render: (value) => <StatusTag value={value} /> },
    { title: 'Bảo hành đến', dataIndex: 'warrantyExpiresAt', width: 160, render: (value) => value ? dayjs(value).format('DD/MM/YYYY') : 'Chưa thiết lập' },
    { title: 'Bảo trì gần nhất', width: 170, render: () => 'Chưa ghi nhận' },
    { title: 'Lịch kế tiếp', width: 150, render: () => 'Chưa ghi nhận' },
    { title: 'Thao tác', key: 'actions', width: 82, fixed: 'right', align: 'center', render: (_, item) => <Customer360TableActions onView={() => router.push(item.contractReference ? `/quotations?contractReference=${encodeURIComponent(item.contractReference)}` : '/quotations')} viewLabel='Xem thang máy tài sản' /> },
  ];

  const contractColumns: ColumnsType<CustomerContract> = [
    { title: 'Mã hợp đồng', dataIndex: 'reference', render: (value) => <Typography.Text strong>{value}</Typography.Text> },
    { title: 'Số thang máy', dataIndex: 'elevators', align: 'right', render: (value: CustomerElevator[]) => value.length },
    { title: 'Thang máy', dataIndex: 'elevators', render: (value: CustomerElevator[]) => value.map((item) => item.name).join(', ') },
    { title: 'Tình trạng', dataIndex: 'elevators', render: (value: CustomerElevator[]) => <StatusTag value={value[0]?.status} /> },
    { title: 'Thao tác', key: 'actions', width: 82, fixed: 'right', align: 'center', render: (_, item) => <Customer360TableActions onView={() => router.push(`/quotations?contractReference=${encodeURIComponent(item.reference)}`)} viewLabel='Xem hợp đồng' /> },
  ];

  const careColumns: ColumnsType<CareActivity> = [
    { title: 'Thời gian', dataIndex: 'scheduledAt', width: 150, render: (value) => dayjs(value).format('DD/MM/YYYY HH:mm') },
    { title: 'Loại chăm sóc', dataIndex: 'careType', width: 150 },
    { title: 'Nội dung', dataIndex: 'content' },
    { title: 'Người phụ trách', dataIndex: 'assignee', width: 160, render: (value) => value || '-' },
    { title: 'Trạng thái', dataIndex: 'status', width: 150, render: (value) => <StatusTag value={value} /> },
    { title: 'Thao tác', key: 'actions', width: 82, fixed: 'right', align: 'center', render: () => <Customer360TableActions onView={() => router.push(`/care?customerId=${customerId}`)} viewLabel='Xem lịch chăm sóc' /> },
  ];

  if (loading) {
    return <div className='customer-360-loading'><Spin size='large' tip='Đang tải Customer 360...' /></div>;
  }

  if (error || !data) {
    return <Result status='error' title='Không tải được Customer 360' subTitle={error} extra={<Button type='primary' onClick={() => void load()}>Tải lại</Button>} />;
  }

  const { customer, summary } = data;
  const tabItems = [
    {
      key: 'overview',
      label: tabLabel('overview'),
      children: (
        <Space direction='vertical' size={16} className='customer-360-stack'>
          <Row gutter={[12, 12]}>
            <Col xs={12} md={6}><ProCard className='mini-stat mini-stat-blue'><span className='mini-stat-icon'><ProfileOutlined /></span><span><small>Hồ sơ tư vấn</small><b>{summary.consultationProfileCount}</b></span></ProCard></Col>
            <Col xs={12} md={6}><ProCard className='mini-stat mini-stat-cyan'><span className='mini-stat-icon'><ToolOutlined /></span><span><small>Cấu hình thang</small><b>{summary.technicalConfigurationCount}</b></span></ProCard></Col>
            <Col xs={12} md={6}><ProCard className='mini-stat mini-stat-violet'><span className='mini-stat-icon'><FileTextOutlined /></span><span><small>Báo giá</small><b>{summary.quotationCount}</b></span></ProCard></Col>
            <Col xs={12} md={6}><ProCard className='mini-stat mini-stat-green'><span className='mini-stat-icon'><BuildOutlined /></span><span><small>Thang máy tài sản</small><b>{summary.customerElevatorCount}</b></span></ProCard></Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col xs={24} xl={14}>
              <Card title='Hồ sơ tư vấn gần đây' extra={<Button type='link' onClick={() => changeTab('profiles')}>Xem tất cả</Button>}>
                <Table size='small' rowKey='id' columns={profileColumns.slice(0, 4)} dataSource={data.consultationProfiles.slice(0, 5)} pagination={false} onRow={consultationProfileRowProps} locale={{ emptyText: 'Chưa có hồ sơ tư vấn.' }} />
              </Card>
            </Col>
            <Col xs={24} xl={10}>
              <Card title='Thang máy theo vòng đời' extra={<Button type='link' onClick={() => changeTab('elevators')}>Xem tất cả</Button>}>
                <Descriptions size='small' column={1}>
                  <Descriptions.Item label='Đang triển khai/bảo hành'>{summary.activeElevatorCount} thang</Descriptions.Item>
                  <Descriptions.Item label='Cấu hình đang tư vấn'>{summary.technicalConfigurationCount} thang</Descriptions.Item>
                  <Descriptions.Item label='Đã ghi nhận tài sản'>{summary.customerElevatorCount} thang</Descriptions.Item>
                  <Descriptions.Item label='Hợp đồng đã chốt'>{contracts.length} hợp đồng</Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          </Row>
        </Space>
      ),
    },
    {
      key: 'profiles',
      label: tabLabel('profiles', summary.consultationProfileCount),
      children: (
        <Card className='customer-360-table-card' title='Danh sách hồ sơ tư vấn'>
          <Table rowKey='id' columns={profileColumns} dataSource={data.consultationProfiles} scroll={{ x: 1000 }} pagination={{ pageSize: 10, showSizeChanger: true }} onRow={consultationProfileRowProps} />
        </Card>
      ),
    },
    {
      key: 'elevators',
      label: tabLabel('elevators', summary.technicalConfigurationCount),
      children: (
        <Space direction='vertical' size={16} className='customer-360-stack'>
          <Card className='customer-360-table-card' title='Cấu hình thang theo hồ sơ tư vấn'>
            <Typography.Paragraph type='secondary'>Các thang đang được tư vấn hoặc khảo sát. Mỗi dòng thuộc duy nhất một hồ sơ nguồn; bấm tên thang để xem hoặc sửa cấu hình kỹ thuật.</Typography.Paragraph>
            <Table rowKey='id' columns={consultationElevatorColumns} dataSource={data.consultationElevators} scroll={{ x: 1140 }} pagination={{ pageSize: 10, showSizeChanger: true }} locale={{ emptyText: 'Chưa có cấu hình thang trong các hồ sơ tư vấn.' }} />
          </Card>
          <Card className='customer-360-table-card' title='Thang máy tài sản'>
            <Typography.Paragraph type='secondary'>Chỉ các thang máy đã chốt hợp đồng mới trở thành tài sản để triển khai, bảo hành và bảo trì.</Typography.Paragraph>
            <Table rowKey='id' columns={elevatorColumns} dataSource={data.elevators} scroll={{ x: 1020 }} pagination={{ pageSize: 10, showSizeChanger: true }} locale={{ emptyText: 'Chưa có thang máy tài sản.' }} />
          </Card>
        </Space>
      ),
    },
    { key: 'quotations', label: tabLabel('quotations', summary.quotationCount), children: <Card className='customer-360-table-card' title='Danh sách báo giá'><Table rowKey='id' columns={quotationColumns} dataSource={data.quotations} scroll={{ x: 1040 }} pagination={{ pageSize: 10, showSizeChanger: true }} /></Card> },
    { key: 'contracts', label: tabLabel('contracts', contracts.length), children: <Card className='customer-360-table-card' title='Hợp đồng đã chốt'><Typography.Paragraph type='secondary'>Danh sách được tổng hợp từ các thang máy tài sản đã được tạo khi chốt hợp đồng.</Typography.Paragraph>{contracts.length === 0 ? <Empty description='Chưa có hợp đồng đã chốt.' /> : <Table rowKey='reference' pagination={false} dataSource={contracts} columns={contractColumns} scroll={{ x: 760 }} />}</Card> },
    { key: 'care', label: tabLabel('care', careActivities.length), children: <Card className='customer-360-table-card' title='Lịch chăm sóc khách hàng'><Table rowKey='id' dataSource={careActivities} scroll={{ x: 920 }} pagination={{ pageSize: 10, showSizeChanger: true }} columns={careColumns} /></Card> },
    { key: 'history', label: tabLabel('history', data.history.length), children: <Card title='Lịch sử hoạt động'>{data.history.length === 0 ? <Empty description='Chưa có dữ liệu lịch sử.' /> : <Timeline items={data.history.map((item) => ({ color: 'green', dot: <HistoryOutlined />, children: <div className='customer-360-history-item'><Typography.Text strong>{item.action}</Typography.Text><Typography.Paragraph type='secondary'>{item.details || item.module || item.entityType}</Typography.Paragraph><Typography.Text type='secondary'>{item.username || 'Hệ thống'} · {dayjs(item.createdAt).format('DD/MM/YYYY HH:mm')}</Typography.Text></div> }))} />}</Card> },
    {
      key: 'receivables',
      label: tabLabel('receivables', contracts.length),
      children: (
        <Space direction='vertical' size={16} className='customer-360-stack'>
          <Row gutter={[12, 12]}>
            <Col xs={24} md={8}><ProCard className='mini-stat mini-stat-violet'><span className='mini-stat-icon'><DollarOutlined /></span><span><small>Giá trị hợp đồng đã xác định</small><b>{formatCurrency(knownContractValue)}</b></span></ProCard></Col>
            <Col xs={12} md={8}><ProCard className='mini-stat mini-stat-cyan'><span className='mini-stat-icon'><DollarOutlined /></span><span><small>Đã thu</small><b>-</b></span></ProCard></Col>
            <Col xs={12} md={8}><ProCard className='mini-stat mini-stat-blue'><span className='mini-stat-icon'><DollarOutlined /></span><span><small>Còn phải thu</small><b>-</b></span></ProCard></Col>
          </Row>
          <Card className='customer-360-table-card' title='Công nợ theo hợp đồng'>
            <Typography.Paragraph type='secondary'>Customer 360 chỉ tổng hợp. Dữ liệu đã thu, còn phải thu và quá hạn sẽ hiển thị khi nghiệp vụ thu tiền được ghi nhận tại hợp đồng.</Typography.Paragraph>
            <Table rowKey='reference' columns={receivableColumns} dataSource={contracts} scroll={{ x: 1150 }} pagination={{ pageSize: 10, showSizeChanger: true }} locale={{ emptyText: 'Chưa có hợp đồng để tổng hợp công nợ.' }} />
          </Card>
        </Space>
      ),
    },
    {
      key: 'progress',
      label: tabLabel('progress', implementationElevators.length),
      children: (
        <Card className='customer-360-table-card' title='Tiến độ thang máy tài sản'>
          <Typography.Paragraph type='secondary'>Chỉ tổng hợp thang máy đã chốt hợp đồng. Cập nhật tiến độ thực hiện tại hồ sơ thang máy tài sản hoặc hợp đồng nguồn.</Typography.Paragraph>
          <Table rowKey='id' columns={progressColumns} dataSource={implementationElevators} scroll={{ x: 1130 }} pagination={{ pageSize: 10, showSizeChanger: true }} locale={{ emptyText: 'Chưa có thang máy tài sản cần theo dõi tiến độ.' }} />
        </Card>
      ),
    },
    {
      key: 'maintenance',
      label: tabLabel('maintenance', maintenanceElevators.length),
      children: (
        <Card className='customer-360-table-card' title='Bảo hành và bảo trì'>
          <Typography.Paragraph type='secondary'>Chỉ hiển thị thang đã bàn giao, đang bảo hành hoặc đang bảo trì. Kế hoạch và phiếu bảo trì được quản lý tại từng thang máy tài sản.</Typography.Paragraph>
          <Table rowKey='id' columns={maintenanceColumns} dataSource={maintenanceElevators} scroll={{ x: 1130 }} pagination={{ pageSize: 10, showSizeChanger: true }} locale={{ emptyText: 'Chưa có thang máy đủ điều kiện theo dõi bảo hành hoặc bảo trì.' }} />
        </Card>
      ),
    },
  ];

  const orderedTabItems = tabs.map((tab) => tabItems.find((item) => item.key === tab)!);

  return (
    <PageContainer
      className='erp-page-container customer-360-page'
      header={{
        title: <div className='page-title-stack'><Typography.Title level={3}>{customer.name}</Typography.Title><Typography.Text>{customer.code} · Customer 360</Typography.Text></div>,
        extra: <Space><Button icon={<ArrowLeftOutlined />} onClick={() => router.push(returnTarget)}>{returnLabel}</Button><Button icon={<CalendarOutlined />} onClick={() => router.push(`/care?customerId=${customer.id}`)}>Ghi chăm sóc</Button><Button type='primary' icon={<ProfileOutlined />} onClick={() => router.push(`/customers?customerId=${customer.id}`)}>Tạo hồ sơ tư vấn</Button></Space>,
        breadcrumb: {},
      }}
    >
      <Card className='customer-360-header-card'>
        <Row gutter={[24, 16]} align='middle'>
          <Col xs={24} lg={16}>
            <Space direction='vertical' size={6}>
              <Space wrap><Tag color={customer.customerType === 'BUSINESS' ? 'blue' : 'green'}>{customer.customerType === 'BUSINESS' ? 'Doanh nghiệp' : 'Cá nhân'}</Tag><StatusTag value={customer.status} />{customer.source && <Tag>{customer.source}</Tag>}</Space>
              <Typography.Text><PhoneOutlined /> {customer.phone}</Typography.Text>
              <Typography.Text type='secondary'>{customer.email || 'Chưa có email'}{customer.address ? ` · ${customer.address}` : ''}</Typography.Text>
            </Space>
          </Col>
          <Col xs={24} lg={8} className='customer-360-owner'><Typography.Text type='secondary'>Người phụ trách</Typography.Text><Typography.Text strong>{customer.owner || 'Chưa phân công'}</Typography.Text></Col>
        </Row>
      </Card>
      <Tabs className='customer-360-tabs' activeKey={activeTab} onChange={changeTab} items={orderedTabItems} />
    </PageContainer>
  );
}
