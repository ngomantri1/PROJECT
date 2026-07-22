'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftOutlined, CopyOutlined, FileProtectOutlined, FileTextOutlined, HistoryOutlined, SlidersOutlined } from '@ant-design/icons';
import { Button, Card, Col, Descriptions, Empty, List, Modal, Result, Row, Select, Space, Spin, Table, Tabs, Tag, Timeline, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PageContainer, ProCard } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import AppStatusTag from '@/components/AppStatusTag';
import { api } from '@/lib/api';

type TechnicalConfiguration = Record<string, unknown> & {
  id?: string;
  name?: string;
  elevatorType?: string;
  floors?: number;
  capacityKg?: number;
  installationAddress?: string;
  installationWard?: string;
  installationProvince?: string;
  attachments?: unknown[];
  technicalNotes?: string;
};

type ConsultationProfileDetail = {
  id: string;
  code: string;
  customerId: string;
  profileType: string;
  source?: string;
  status: string;
  notes?: string;
  technicalSpecsJson?: string;
  createdAt: string;
  updatedAt?: string;
  owner?: string;
};

type ConsultationProfileListItem = {
  id: string;
  customerId: string;
  code: string;
  source?: string;
  status: string;
  technicalSpecsJson?: string;
  createdAt: string;
};

type Quotation = {
  id: string;
  code: string;
  title: string;
  status: string;
  totalAmount: number;
  validUntil?: string;
  createdAt: string;
};

type CustomerElevator = {
  id: string;
  code: string;
  name: string;
  elevatorType?: string;
  status: string;
  contractReference?: string;
  createdAt: string;
};

type Activity = {
  id: string;
  createdAt: string;
  username?: string;
  action: string;
  module?: string;
  details?: string;
};

type DetailResponse = {
  profile: ConsultationProfileDetail;
  customer: { id: string; code: string; name: string; phone: string; email?: string; address?: string };
  summary: { technicalConfigurationCount: number; quotationCount: number; customerElevatorCount: number };
  quotations: Quotation[];
  customerElevators: CustomerElevator[];
};

const detailTabs = ['overview', 'requirements', 'quotations', 'contracts', 'history'] as const;
type DetailTab = (typeof detailTabs)[number];

const profileStatusLabels: Record<string, string> = {
  NEW: 'Mới tiếp nhận',
  CONTACTED: 'Đã liên hệ',
  CARING: 'Đang chăm sóc',
  WAITING_SURVEY: 'Chờ khảo sát',
  SURVEYED: 'Đã khảo sát',
  WAITING_RESPONSE: 'Chờ phản hồi',
  QUOTED: 'Đã báo giá',
  WON: 'Đã chốt',
  LOST: 'Không thành công',
};

function parseConfigurations(raw?: string): TechnicalConfiguration[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is TechnicalConfiguration => Boolean(item) && typeof item === 'object') : [];
  } catch {
    return [];
  }
}

function displayValue(value: unknown, empty = 'Chưa cập nhật') {
  if (value === undefined || value === null || value === '') return empty;
  return String(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0);
}

function profileStatusLabel(status: string) {
  return profileStatusLabels[status] ?? status;
}

function elevatorTypeLabel(value?: string) {
  const labels: Record<string, string> = { BUILT: 'Thang xây', GLASS: 'Thang kính' };
  return value ? labels[value] ?? value : 'Chưa cập nhật';
}

export default function ConsultationProfileDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = params.id;
  const requestedTab = searchParams.get('tab');
  const activeTab: DetailTab = detailTabs.includes(requestedTab as DetailTab) ? requestedTab as DetailTab : 'overview';
  const [detail, setDetail] = useState<DetailResponse>();
  const [history, setHistory] = useState<Activity[]>([]);
  const [relatedProfiles, setRelatedProfiles] = useState<ConsultationProfileListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [copying, setCopying] = useState(false);
  const [copySourceId, setCopySourceId] = useState<string>();
  const [copyConfigurationId, setCopyConfigurationId] = useState<string>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await api<DetailResponse>(`/consultation-profiles/${profileId}`);
      setDetail(response);
      const [historyRows, profileRows] = await Promise.all([
        api<Activity[]>(`/consultation-profiles/${profileId}/history`).catch(() => []),
        api<ConsultationProfileListItem[]>('/consultation-profiles').catch(() => []),
      ]);
      setHistory(historyRows);
      setRelatedProfiles(profileRows.filter((item) => item.customerId === response.profile.customerId && item.id !== response.profile.id));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không tải được chi tiết hồ sơ tư vấn.');
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const configurations = useMemo(() => parseConfigurations(detail?.profile.technicalSpecsJson), [detail?.profile.technicalSpecsJson]);
  const copySource = useMemo(() => relatedProfiles.find((item) => item.id === copySourceId), [copySourceId, relatedProfiles]);
  const sourceConfigurations = useMemo(() => parseConfigurations(copySource?.technicalSpecsJson), [copySource?.technicalSpecsJson]);

  const changeTab = (tab: string) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set('tab', tab);
    router.replace(`/consultation-profiles/${profileId}?${nextSearchParams.toString()}`);
  };

  const copyConfiguration = () => {
    if (!copySourceId) {
      message.warning('Chọn hồ sơ nguồn để sao chép cấu hình.');
      return;
    }
    const source = relatedProfiles.find((item) => item.id === copySourceId);
    const selectedConfiguration = sourceConfigurations.find((item) => item.id === copyConfigurationId);
    Modal.confirm({
      title: 'Sao chép cấu hình kỹ thuật?',
      content: copyConfigurationId === 'ALL'
        ? `Tất cả cấu hình từ ${source?.code ?? 'hồ sơ nguồn'} sẽ được sao chép thành bản độc lập vào hồ sơ hiện tại.`
        : `Cấu hình ${selectedConfiguration?.name ?? 'đã chọn'} từ ${source?.code ?? 'hồ sơ nguồn'} sẽ được sao chép thành bản độc lập vào hồ sơ hiện tại.`,
      okText: 'Sao chép',
      cancelText: 'Hủy',
      onOk: async () => {
        setCopying(true);
        try {
          const result = await api<{ copiedCount: number }>(`/consultation-profiles/${profileId}/copy-technical-configuration`, {
            method: 'POST',
            body: JSON.stringify({ sourceProfileId: copySourceId, configurationId: copyConfigurationId === 'ALL' ? null : copyConfigurationId }),
          });
          message.success(`Đã sao chép ${result.copiedCount} cấu hình.`);
          await load();
        } catch (copyError) {
          message.error(copyError instanceof Error ? copyError.message : 'Không thể sao chép cấu hình.');
          throw copyError;
        } finally {
          setCopying(false);
        }
      },
    });
  };

  if (loading) {
    return <div className='consultation-detail-loading'><Spin size='large' tip='Đang tải chi tiết hồ sơ tư vấn...' /></div>;
  }

  if (error || !detail) {
    return <Result status='error' title='Không tải được chi tiết hồ sơ tư vấn' subTitle={error} extra={<Button type='primary' onClick={() => void load()}>Tải lại</Button>} />;
  }

  const quotationColumns: ColumnsType<Quotation> = [
    { title: 'Mã báo giá', dataIndex: 'code', width: 160, render: (value) => <Typography.Link className='record-link record-link-code' onClick={() => router.push(`/quotations?consultationProfileId=${profileId}`)}>{value}</Typography.Link> },
    { title: 'Tên báo giá', dataIndex: 'title' },
    { title: 'Trạng thái', dataIndex: 'status', width: 150, render: (value) => <AppStatusTag value={value} /> },
    { title: 'Giá trị', dataIndex: 'totalAmount', align: 'right', width: 170, render: (value) => formatCurrency(value) },
    { title: 'Hiệu lực đến', dataIndex: 'validUntil', width: 140, render: (value) => value ? dayjs(value).format('DD/MM/YYYY') : '—' },
  ];

  const contractColumns: ColumnsType<CustomerElevator> = [
    { title: 'Mã thang', dataIndex: 'code', width: 150 },
    { title: 'Tên thang', dataIndex: 'name' },
    { title: 'Loại thang', dataIndex: 'elevatorType', width: 150, render: (value) => elevatorTypeLabel(value) },
    { title: 'Hợp đồng', dataIndex: 'contractReference', width: 160, render: (value) => value ? <Typography.Link className='record-link record-link-code' onClick={() => router.push(`/contracts?consultationProfileId=${profileId}`)}>{value}</Typography.Link> : '—' },
    { title: 'Trạng thái', dataIndex: 'status', width: 150, render: (value) => <AppStatusTag value={value} /> },
  ];

  const configurationCards = configurations.length ? (
    <div className='consultation-configuration-list'>
      {configurations.map((configuration, index) => {
        const area = [configuration.installationWard, configuration.installationProvince].filter(Boolean).join(', ');
        const attachments = Array.isArray(configuration.attachments) ? configuration.attachments.length : 0;
        return (
          <Card
            key={configuration.id ?? `${configuration.name}-${index}`}
            className='consultation-configuration-card'
            size='small'
            extra={configuration.id ? <Button type='link' onClick={() => router.push(`/consultation-profiles/${profileId}/configurations/${configuration.id}`)}>Xem cấu hình</Button> : undefined}
          >
            <div className='consultation-configuration-title'>
              <span><SlidersOutlined /> {configuration.name || `Cấu hình ${index + 1}`}</span>
              <Tag color='green'>Cấu hình của hồ sơ này</Tag>
            </div>
            <Descriptions size='small' column={{ xs: 1, md: 2 }}>
              <Descriptions.Item label='Loại thang'>{elevatorTypeLabel(configuration.elevatorType)}</Descriptions.Item>
              <Descriptions.Item label='Tải trọng'>{configuration.capacityKg ? `${configuration.capacityKg} kg` : 'Chưa cập nhật'}</Descriptions.Item>
              <Descriptions.Item label='Số tầng'>{displayValue(configuration.floors)}</Descriptions.Item>
              <Descriptions.Item label='Hố thang'>{configuration.shaftWidthMm && configuration.shaftDepthMm ? `${configuration.shaftWidthMm} × ${configuration.shaftDepthMm} mm` : 'Chưa cập nhật'}</Descriptions.Item>
              <Descriptions.Item label='Vị trí lắp đặt' span={2}>{displayValue(configuration.installationAddress)}</Descriptions.Item>
              {area && <Descriptions.Item label='Khu vực' span={2}>{area}</Descriptions.Item>}
              <Descriptions.Item label='Tài liệu khảo sát'>{attachments ? `${attachments} tệp` : 'Chưa có'}</Descriptions.Item>
              <Descriptions.Item label='Ghi chú kỹ thuật'>{displayValue(configuration.technicalNotes)}</Descriptions.Item>
            </Descriptions>
          </Card>
        );
      })}
    </div>
  ) : <Empty description='Hồ sơ này chưa có cấu hình nhu cầu thang máy.' />;

  const tabItems = [
    {
      key: 'overview',
      label: 'Tổng quan',
      children: (
        <Space direction='vertical' size={16} className='consultation-detail-stack'>
          <Row gutter={[12, 12]}>
            <Col xs={24} md={8}><ProCard className='mini-stat mini-stat-cyan'><span className='mini-stat-icon'><SlidersOutlined /></span><span><small>Cấu hình nhu cầu</small><b>{detail.summary.technicalConfigurationCount}</b></span></ProCard></Col>
            <Col xs={12} md={8}><ProCard className='mini-stat mini-stat-violet'><span className='mini-stat-icon'><FileTextOutlined /></span><span><small>Báo giá</small><b>{detail.summary.quotationCount}</b></span></ProCard></Col>
            <Col xs={12} md={8}><ProCard className='mini-stat mini-stat-green'><span className='mini-stat-icon'><FileProtectOutlined /></span><span><small>Thang máy tài sản</small><b>{detail.summary.customerElevatorCount}</b></span></ProCard></Col>
          </Row>
          <Card title='Nhu cầu tư vấn' extra={<Button type='link' onClick={() => changeTab('requirements')}>Xem cấu hình</Button>}>
            <Descriptions size='small' column={{ xs: 1, md: 2 }}>
              <Descriptions.Item label='Nguồn'>{detail.profile.source || 'Chưa cập nhật'}</Descriptions.Item>
              <Descriptions.Item label='Người phụ trách'>{detail.profile.owner || 'Chưa phân công'}</Descriptions.Item>
              <Descriptions.Item label='Ghi chú' span={2}>{detail.profile.notes || 'Chưa có ghi chú'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Space>
      ),
    },
    {
      key: 'requirements',
      label: `Cấu hình nhu cầu (${detail.summary.technicalConfigurationCount})`,
      children: (
        <Space direction='vertical' size={16} className='consultation-detail-stack'>
          <Card title='Cấu hình thuộc hồ sơ hiện tại'>
            {configurationCards}
          </Card>
          <Card title='Tham khảo và sao chép từ hồ sơ khác' className='consultation-copy-card'>
            <Typography.Paragraph type='secondary'>Cấu hình từ hồ sơ khác chỉ được tham khảo. Khi sao chép, hệ thống tạo bản độc lập thuộc hồ sơ hiện tại; hồ sơ nguồn không bị thay đổi.</Typography.Paragraph>
            {relatedProfiles.length ? (
              <Space direction='vertical' size={12} style={{ width: '100%' }}>
                <div className='consultation-copy-controls'>
                  <Select
                    value={copySourceId}
                    onChange={(value) => { setCopySourceId(value); setCopyConfigurationId('ALL'); }}
                    placeholder='Chọn hồ sơ nguồn của cùng khách hàng'
                    options={relatedProfiles.map((profile) => ({ value: profile.id, label: `${profile.code} · ${profileStatusLabel(profile.status)} (${parseConfigurations(profile.technicalSpecsJson).length} cấu hình)` }))}
                  />
                  <Select
                    value={copyConfigurationId}
                    onChange={setCopyConfigurationId}
                    disabled={!copySourceId}
                    options={[{ value: 'ALL', label: 'Sao chép tất cả cấu hình' }, ...sourceConfigurations.flatMap((configuration, index) => configuration.id ? [{ value: configuration.id, label: configuration.name || `Cấu hình ${index + 1}` }] : [])]}
                  />
                  <Button type='primary' icon={<CopyOutlined />} loading={copying} onClick={copyConfiguration}>Sao chép</Button>
                </div>
                {copySource && (
                  <List
                    size='small'
                    bordered
                    dataSource={sourceConfigurations}
                    locale={{ emptyText: 'Hồ sơ nguồn chưa có cấu hình để tham khảo.' }}
                    renderItem={(configuration, index) => <List.Item><Space><Tag>Chỉ đọc</Tag><Typography.Text strong>{configuration.name || `Cấu hình ${index + 1}`}</Typography.Text><Typography.Text type='secondary'>{elevatorTypeLabel(configuration.elevatorType)} · {configuration.capacityKg ? `${configuration.capacityKg} kg` : 'chưa rõ tải trọng'}</Typography.Text></Space></List.Item>}
                  />
                )}
              </Space>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description='Khách hàng chưa có hồ sơ tư vấn khác để tham khảo.' />}
          </Card>
        </Space>
      ),
    },
    {
      key: 'quotations',
      label: `Báo giá (${detail.summary.quotationCount})`,
      children: <Card className='customer-360-table-card' title='Báo giá liên kết' extra={<Button type='primary' icon={<FileTextOutlined />} onClick={() => router.push(`/quotations?consultationProfileId=${profileId}`)}>Tạo báo giá</Button>}><Table rowKey='id' columns={quotationColumns} dataSource={detail.quotations} scroll={{ x: 860 }} pagination={{ pageSize: 10 }} locale={{ emptyText: 'Chưa có báo giá liên kết với hồ sơ này.' }} /></Card>,
    },
    {
      key: 'contracts',
      label: `Hợp đồng (${detail.customerElevators.length})`,
      children: <Card className='customer-360-table-card' title='Hợp đồng và thang máy tài sản' extra={<Button icon={<FileProtectOutlined />} onClick={() => router.push(`/contracts?consultationProfileId=${profileId}`)}>Mở hợp đồng</Button>}><Typography.Paragraph type='secondary'>Thang máy tài sản chỉ xuất hiện sau khi báo giá được chốt hợp đồng thành công.</Typography.Paragraph><Table rowKey='id' columns={contractColumns} dataSource={detail.customerElevators} scroll={{ x: 860 }} pagination={{ pageSize: 10 }} locale={{ emptyText: 'Chưa có hợp đồng hoặc thang máy tài sản từ hồ sơ này.' }} /></Card>,
    },
    {
      key: 'history',
      label: `Lịch sử (${history.length})`,
      children: <Card title='Lịch sử hoạt động'><Timeline items={history.map((item) => ({ color: 'green', dot: <HistoryOutlined />, children: <div className='consultation-history-item'><Typography.Text strong>{item.action}</Typography.Text><Typography.Paragraph type='secondary'>{item.details || item.module || 'Hồ sơ tư vấn'}</Typography.Paragraph><Typography.Text type='secondary'>{item.username || 'Hệ thống'} · {dayjs(item.createdAt).format('DD/MM/YYYY HH:mm')}</Typography.Text></div> }))} /></Card>,
    },
  ];

  return (
    <PageContainer
      className='erp-page-container consultation-detail-page'
      header={{
        title: <div className='page-title-stack'><Typography.Title level={3}>{detail.profile.code}</Typography.Title><Typography.Text>Hồ sơ tư vấn · {detail.customer.code} · {detail.customer.name}</Typography.Text></div>,
        extra: <Space wrap><Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/customers')}>Danh sách hồ sơ</Button><Button onClick={() => router.push(`/business/customers/${detail.customer.id}?tab=profiles&profileId=${profileId}&returnTo=consultation-profiles`)}>Customer 360</Button><Button icon={<FileTextOutlined />} onClick={() => router.push(`/quotations?consultationProfileId=${profileId}`)}>Báo giá</Button><Button type='primary' onClick={() => router.push(`/customers?profileId=${profileId}`)}>Chỉnh sửa hồ sơ</Button></Space>,
        breadcrumb: {},
      }}
    >
      <Card className='consultation-detail-header'>
        <Row gutter={[24, 16]} align='middle'>
          <Col xs={24} lg={16}>
            <Space direction='vertical' size={6}>
              <Space wrap><AppStatusTag value={detail.profile.status} label={profileStatusLabel(detail.profile.status)} />{detail.profile.source && <Tag>{detail.profile.source}</Tag>}<Tag color={detail.profile.profileType === 'NEW_CUSTOMER' ? 'blue' : 'green'}>{detail.profile.profileType === 'NEW_CUSTOMER' ? 'Khách hàng mới' : 'Nhu cầu mới'}</Tag></Space>
              <Typography.Text strong>{detail.customer.name}</Typography.Text>
              <Typography.Text type='secondary'>{detail.customer.phone}{detail.customer.email ? ` · ${detail.customer.email}` : ''}{detail.customer.address ? ` · ${detail.customer.address}` : ''}</Typography.Text>
            </Space>
          </Col>
          <Col xs={24} lg={8} className='consultation-detail-owner'><Typography.Text type='secondary'>Người phụ trách</Typography.Text><Typography.Text strong>{detail.profile.owner || 'Chưa phân công'}</Typography.Text></Col>
        </Row>
      </Card>
      <Tabs className='customer-360-tabs consultation-detail-tabs' activeKey={activeTab} onChange={changeTab} items={tabItems} />
    </PageContainer>
  );
}
