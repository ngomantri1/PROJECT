'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftOutlined, EditOutlined, PlusOutlined, SaveOutlined, SlidersOutlined } from '@ant-design/icons';
import { Button, Card, Col, Form, Input, Radio, Result, Row, Select, Space, Spin, Tag, Typography, message } from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import { api } from '@/lib/api';

type ProfileDetail = {
  profile: {
    id: string;
    code: string;
    source?: string;
    status: string;
    elevatorType?: string;
    notes?: string;
    technicalSpecsJson?: string;
    attachmentLinksJson?: string;
    isKpiEligible?: boolean;
    owner?: string;
  };
  customer: { id: string; code: string; customerType: 'PERSONAL' | 'BUSINESS'; name: string; phone: string; email?: string; address?: string };
  summary: { technicalConfigurationCount: number; quotationCount: number; customerElevatorCount: number };
};

type EditValues = {
  customerType: 'PERSONAL' | 'BUSINESS';
  name: string;
  phone: string;
  email?: string;
  address?: string;
  source?: string;
  status: string;
  notes?: string;
};

type TechnicalConfiguration = {
  id?: string;
  name?: string;
  elevatorType?: string;
  floors?: number;
  capacityKg?: number;
};

function parseConfigurations(raw?: string): TechnicalConfiguration[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is TechnicalConfiguration => Boolean(item) && typeof item === 'object') : [];
  } catch {
    return [];
  }
}

function elevatorTypeLabel(value?: string) {
  return value === 'GLASS' ? 'Thang kính' : value === 'BUILT' ? 'Thang xây' : 'Chưa cập nhật loại thang';
}

const statusOptions = [
  ['NEW', 'Mới tiếp nhận'], ['CONTACTED', 'Đã liên hệ'], ['CARING', 'Đang chăm sóc'], ['WAITING_SURVEY', 'Chờ khảo sát'], ['SURVEYED', 'Đã khảo sát'], ['VISITED_SHOWROOM', 'Đã xem thang mẫu'], ['QUOTED', 'Đã gửi báo giá'], ['WAITING_RESPONSE', 'Chờ phản hồi'], ['NEGOTIATING', 'Đang đàm phán'], ['CONVERTED', 'Đã chuyển sang hợp đồng'], ['PAUSED', 'Tạm dừng chăm sóc'], ['LOST', 'Không thành công'],
].map(([value, label]) => ({ value, label }));

const sourceOptions = ['Marketing', 'Giới thiệu', 'Telesale', 'Khách cũ', 'Cộng tác viên', 'Khác'].map((value) => ({ value, label: value }));

export default function ConsultationProfileEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = params.id;
  const returnTo = searchParams.get('returnTo');
  const customerId = searchParams.get('customerId');
  const customerReturnTo = searchParams.get('customerReturnTo') === 'consultation-profiles' ? 'consultation-profiles' : 'customers';
  const [form] = Form.useForm<EditValues>();
  const [detail, setDetail] = useState<ProfileDetail>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const nextTargetAfterSaveRef = useRef<string | undefined>(undefined);

  const backTarget = useMemo(() => {
    if (returnTo === 'customer360' && customerId) return `/business/customers/${customerId}?tab=profiles&profileId=${profileId}&returnTo=${customerReturnTo}`;
    return `/consultation-profiles/${profileId}`;
  }, [customerId, customerReturnTo, profileId, returnTo]);

  const backLabel = returnTo === 'customer360' ? 'Quay lại Customer 360' : 'Quay lại chi tiết hồ sơ';
  const technicalConfigurations = parseConfigurations(detail?.profile.technicalSpecsJson);

  const openTechnicalConfiguration = (configuration: TechnicalConfiguration, index: number) => {
    const configurationId = configuration.id ?? String(index);
    const query = new URLSearchParams({ returnTo: 'profile-edit', customerReturnTo, mode: 'edit' });
    if (returnTo === 'customer360' && customerId) {
      query.set('customerId', customerId);
      query.set('customer360', 'true');
    }
    const target = `/consultation-profiles/${profileId}/configurations/${configurationId}?${query.toString()}`;
    void form.validateFields().then(() => {
      nextTargetAfterSaveRef.current = target;
      form.submit();
    }).catch(() => {
      message.warning('Hãy hoàn tất các thông tin bắt buộc của hồ sơ trước khi sửa cấu hình kỹ thuật.');
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await api<ProfileDetail>(`/consultation-profiles/${profileId}`);
      setDetail(response);
      form.setFieldsValue({
        customerType: response.customer.customerType,
        name: response.customer.name,
        phone: response.customer.phone,
        email: response.customer.email,
        address: response.customer.address,
        source: response.profile.source,
        status: response.profile.status,
        notes: response.profile.notes,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được đăng ký tư vấn.');
    } finally {
      setLoading(false);
    }
  }, [form, profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (values: EditValues) => {
    if (!detail) return;
    setSaving(true);
    try {
      await api(`/consultation-profiles/${profileId}`, {
        method: 'PUT',
        body: JSON.stringify({
          customerId: detail.customer.id,
          ...values,
          elevatorType: detail.profile.elevatorType,
          technicalSpecsJson: detail.profile.technicalSpecsJson,
          attachmentLinksJson: detail.profile.attachmentLinksJson,
          isKpiEligible: detail.profile.isKpiEligible,
        }),
      });
      message.success('Đã cập nhật đăng ký tư vấn.');
      const nextTarget = nextTargetAfterSaveRef.current;
      nextTargetAfterSaveRef.current = undefined;
      router.push(nextTarget || backTarget);
    } catch (saveError) {
      nextTargetAfterSaveRef.current = undefined;
      message.error(saveError instanceof Error ? saveError.message : 'Không thể cập nhật đăng ký tư vấn.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className='consultation-detail-loading'><Spin size='large' tip='Đang tải đăng ký tư vấn...' /></div>;
  if (error || !detail) return <Result status='error' title='Không tải được đăng ký tư vấn' subTitle={error} extra={<Button type='primary' onClick={() => void load()}>Tải lại</Button>} />;

  return (
    <PageContainer
      className='erp-page-container consultation-profile-edit-page'
      header={{
        title: <div className='page-title-stack'><Typography.Title level={3}>Sửa đăng ký tư vấn</Typography.Title><Typography.Text>{detail.profile.code} · {detail.customer.code} · {detail.customer.name}</Typography.Text></div>,
        extra: <Space wrap><Button icon={<ArrowLeftOutlined />} onClick={() => router.push(backTarget)}>{backLabel}</Button><Button type='primary' icon={<SaveOutlined />} loading={saving} onClick={() => form.submit()}>Lưu thay đổi</Button></Space>,
        breadcrumb: {},
      }}
    >
      <Card className='consultation-detail-header'>
        <Space wrap><Tag color='green'>Hồ sơ {detail.profile.code}</Tag><Tag>{detail.customer.customerType === 'BUSINESS' ? 'Doanh nghiệp' : 'Cá nhân'}</Tag><Typography.Text type='secondary'>Người phụ trách: {detail.profile.owner || 'Chưa phân công'}</Typography.Text></Space>
      </Card>
      <Card title='Thông tin đăng ký tư vấn'>
        <Form form={form} layout='vertical' onFinish={save} className='consultation-profile-edit-form'>
          <Typography.Title level={5}>Thông tin khách hàng</Typography.Title>
          <Row gutter={[16, 0]}>
            <Col xs={24}><Form.Item name='customerType' label='Nhóm khách hàng' rules={[{ required: true }]}><Radio.Group options={[{ value: 'PERSONAL', label: 'Cá nhân' }, { value: 'BUSINESS', label: 'Doanh nghiệp' }]} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name='name' label='Tên khách hàng' rules={[{ required: true, message: 'Nhập tên khách hàng.' }]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name='phone' label='Số điện thoại' rules={[{ required: true, message: 'Nhập số điện thoại.' }]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name='email' label='Email'><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name='source' label='Nguồn khách hàng'><Select allowClear options={sourceOptions} /></Form.Item></Col>
            <Col xs={24}><Form.Item name='address' label='Địa chỉ liên hệ'><Input.TextArea rows={2} /></Form.Item></Col>
          </Row>
          <Typography.Title level={5}>Thông tin đăng ký tư vấn</Typography.Title>
          <Row gutter={[16, 0]}>
            <Col xs={24} md={12}><Form.Item name='status' label='Trạng thái hồ sơ' rules={[{ required: true, message: 'Chọn trạng thái hồ sơ.' }]}><Select options={statusOptions} /></Form.Item></Col>
            <Col xs={24}><Form.Item name='notes' label='Yêu cầu / ghi chú ban đầu'><Input.TextArea rows={5} placeholder='Loại thang, số tầng, tải trọng, thời gian dự kiến...' /></Form.Item></Col>
          </Row>
          <div className='form-section-heading consultation-technical-heading'>
            <span><SlidersOutlined /> Cấu hình thông số kỹ thuật thang máy</span>
            <Tag color='green'>{technicalConfigurations.length} cấu hình</Tag>
          </div>
          <div className='consultation-technical-editor-list'>
            {technicalConfigurations.length ? technicalConfigurations.map((configuration, index) => (
              <Card key={configuration.id ?? index} size='small' className='consultation-technical-editor-item'>
                <Space direction='vertical' size={2}>
                  <Typography.Text strong>{configuration.name || `Thang máy ${index + 1}`}</Typography.Text>
                  <Typography.Text type='secondary'>
                    {configuration.floors ? `${configuration.floors} tầng` : 'Chưa nhập số tầng'}
                    {configuration.capacityKg ? ` · ${configuration.capacityKg} kg` : ''} · {elevatorTypeLabel(configuration.elevatorType)}
                  </Typography.Text>
                </Space>
                <Button icon={<EditOutlined />} onClick={() => openTechnicalConfiguration(configuration, index)}>Sửa cấu hình kỹ thuật</Button>
              </Card>
            )) : (
              <div className='consultation-technical-empty'>
                <Typography.Text type='secondary'>Chưa có cấu hình kỹ thuật. Có thể bổ sung khi đã có thông tin khảo sát.</Typography.Text>
                <Button disabled icon={<PlusOutlined />}>Thêm thang</Button>
              </div>
            )}
          </div>
        </Form>
      </Card>
    </PageContainer>
  );
}
