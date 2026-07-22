'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftOutlined, EditOutlined, SaveOutlined, SlidersOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Result, Space, Spin, Tag, Typography, message } from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import TechnicalConfigurationForm, { type TechnicalConfigurationValues } from '@/components/TechnicalConfigurationForm';
import { api } from '@/lib/api';

type TechnicalConfiguration = TechnicalConfigurationValues;

type ProfileResponse = {
  profile: { id: string; code: string; technicalSpecsJson?: string; owner?: string };
  customer: { id: string; code: string; name: string };
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

function valueOrDash(value: unknown) {
  return value === undefined || value === null || value === '' ? 'Chưa cập nhật' : String(value);
}

function elevatorTypeLabel(value?: string) {
  return ({ BUILT: 'Thang xây', GLASS: 'Thang kính' }[value ?? ''] ?? valueOrDash(value));
}

function counterweightLabel(value?: string) {
  return ({ BACK: 'Sau', SIDE: 'Hông', NONE: 'Không đối trọng' }[value ?? ''] ?? valueOrDash(value));
}

export default function TechnicalConfigurationPage() {
  const params = useParams<{ id: string; configurationId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = params.id;
  const configurationId = params.configurationId;
  const returnTo = searchParams.get('returnTo');
  const customerId = searchParams.get('customerId');
  const customerReturnTo = searchParams.get('customerReturnTo') === 'consultation-profiles' ? 'consultation-profiles' : 'customers';
  const startInEditMode = searchParams.get('mode') === 'edit';
  const [profile, setProfile] = useState<ProfileResponse>();
  const [configuration, setConfiguration] = useState<TechnicalConfiguration>();
  const [draft, setDraft] = useState<TechnicalConfiguration>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();

  const backTarget = useMemo(() => {
    if (returnTo === 'customer360' && customerId) return `/business/customers/${customerId}?tab=elevators&returnTo=${customerReturnTo}`;
    return `/consultation-profiles/${profileId}?tab=requirements`;
  }, [customerId, customerReturnTo, profileId, returnTo]);

  const backLabel = returnTo === 'customer360' ? 'Quay lại Customer 360' : 'Quay lại hồ sơ tư vấn';

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await api<ProfileResponse>(`/consultation-profiles/${profileId}`);
      const found = parseConfigurations(response.profile.technicalSpecsJson).find((item, index) => (item.id ?? String(index)) === configurationId);
      if (!found) {
        setError('Không tìm thấy cấu hình kỹ thuật thang máy.');
        return;
      }
      setProfile(response);
      setConfiguration(found);
      setDraft(found);
      setEditing(startInEditMode);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được cấu hình kỹ thuật thang máy.');
    } finally {
      setLoading(false);
    }
  }, [configurationId, profileId, startInEditMode]);

  useEffect(() => {
    void load();
  }, [load]);

  const cancelEditing = () => {
    setDraft(configuration);
    setEditing(false);
  };

  const save = async () => {
    if (!configuration || !draft) return;
    setSaving(true);
    try {
      const updated = { ...configuration, ...draft, id: configurationId };
      await api(`/consultation-profiles/${profileId}/technical-configurations/${configurationId}`, {
        method: 'PUT',
        body: JSON.stringify({ configuration: updated }),
      });
      setConfiguration(updated);
      setDraft(updated);
      setEditing(false);
      message.success('Đã cập nhật cấu hình kỹ thuật thang máy.');
    } catch (saveError) {
      message.error(saveError instanceof Error ? saveError.message : 'Không thể cập nhật cấu hình kỹ thuật.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className='consultation-detail-loading'><Spin size='large' tip='Đang tải cấu hình kỹ thuật...' /></div>;
  if (error || !configuration || !profile) return <Result status='error' title='Không tải được cấu hình kỹ thuật' subTitle={error} extra={<Button type='primary' onClick={() => void load()}>Tải lại</Button>} />;

  const location = [configuration.installationAddress, configuration.installationWard, configuration.installationProvince].filter(Boolean).join(', ');
  const shaft = configuration.shaftWidthMm && configuration.shaftDepthMm ? `${configuration.shaftWidthMm} × ${configuration.shaftDepthMm} mm` : 'Chưa cập nhật';

  return (
    <PageContainer
      className='erp-page-container technical-configuration-page'
      header={{
        title: <div className='page-title-stack'><Typography.Title level={3}>{configuration.name || 'Cấu hình kỹ thuật thang máy'}</Typography.Title><Typography.Text>{profile.profile.code} · {profile.customer.code} · {profile.customer.name}</Typography.Text></div>,
        extra: <Space wrap><Button icon={<ArrowLeftOutlined />} onClick={() => router.push(backTarget)}>{backLabel}</Button>{editing ? <><Button onClick={cancelEditing}>Hủy</Button><Button type='primary' icon={<SaveOutlined />} loading={saving} onClick={() => void save()}>Lưu cấu hình</Button></> : <Button type='primary' icon={<EditOutlined />} onClick={() => { setDraft(configuration); setEditing(true); }}>Sửa cấu hình</Button>}</Space>,
        breadcrumb: {},
      }}
    >
      <Card className='technical-configuration-header'>
        <Space wrap size={8}><Tag color='green'>Cấu hình thuộc {profile.profile.code}</Tag><Tag color={configuration.elevatorType === 'GLASS' ? 'blue' : 'green'}>{elevatorTypeLabel(configuration.elevatorType)}</Tag><Typography.Text type='secondary'>Người phụ trách: {profile.profile.owner || 'Chưa phân công'}</Typography.Text></Space>
      </Card>
      {editing ? (
        <Card title={<span><SlidersOutlined /> Chỉnh sửa cấu hình kỹ thuật</span>}>
          <TechnicalConfigurationForm value={draft ?? configuration} onChange={setDraft} />
        </Card>
      ) : (
        <Space direction='vertical' size={16} style={{ width: '100%' }}>
          <Card title='Thông tin vận hành và lắp đặt'>
            <Descriptions column={{ xs: 1, md: 3 }}>
              <Descriptions.Item label='Loại thang'>{elevatorTypeLabel(configuration.elevatorType)}</Descriptions.Item>
              <Descriptions.Item label='Số tầng'>{valueOrDash(configuration.floors)}</Descriptions.Item>
              <Descriptions.Item label='Tải trọng'>{configuration.capacityKg ? `${configuration.capacityKg} kg` : 'Chưa cập nhật'}</Descriptions.Item>
              <Descriptions.Item label='Vị trí đối trọng'>{counterweightLabel(configuration.counterweightPosition)}</Descriptions.Item>
              <Descriptions.Item label='Vị trí lắp đặt' span={2}>{location || 'Chưa cập nhật'}</Descriptions.Item>
            </Descriptions>
          </Card>
          <Card title='Thông số hố thang'>
            <Descriptions column={{ xs: 1, md: 3 }}>
              <Descriptions.Item label='Kích thước hố thang'>{shaft}</Descriptions.Item>
              <Descriptions.Item label='Hố pit'>{configuration.pitDepthMm ? `${configuration.pitDepthMm} mm` : 'Chưa cập nhật'}</Descriptions.Item>
              <Descriptions.Item label='Chiều cao OH'>{configuration.overheadHeightMm ? `${configuration.overheadHeightMm} mm` : 'Chưa cập nhật'}</Descriptions.Item>
              <Descriptions.Item label='Chiều cao phòng máy'>{configuration.machineRoomHeightMm ? `${configuration.machineRoomHeightMm} mm` : 'Chưa cập nhật'}</Descriptions.Item>
              <Descriptions.Item label='Chiều cao tầng' span={2}>{configuration.floorHeights?.length ? configuration.floorHeights.map((floor) => `${floor.floorName || 'Tầng'}: ${floor.heightMm ?? '—'} mm`).join(' · ') : 'Chưa cập nhật'}</Descriptions.Item>
            </Descriptions>
          </Card>
          <Card title='Ghi chú và tài liệu khảo sát'>
            <Descriptions column={{ xs: 1, md: 2 }}><Descriptions.Item label='Ghi chú kỹ thuật'>{valueOrDash(configuration.technicalNotes)}</Descriptions.Item><Descriptions.Item label='Tài liệu khảo sát'>{configuration.attachments?.length ? `${configuration.attachments.length} tệp` : 'Chưa có'}</Descriptions.Item></Descriptions>
          </Card>
        </Space>
      )}
    </PageContainer>
  );
}
