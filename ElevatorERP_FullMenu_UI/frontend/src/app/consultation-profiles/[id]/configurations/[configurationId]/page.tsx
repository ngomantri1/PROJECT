'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftOutlined, CameraOutlined, DeleteOutlined, EditOutlined, EnvironmentOutlined, PaperClipOutlined, PushpinOutlined, SaveOutlined, SlidersOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Result, Space, Spin, Tag, Tooltip, Typography, message } from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import DeploymentLocationPickerModal from '@/components/DeploymentLocationPickerModal';
import TechnicalConfigurationForm, { type TechnicalConfigurationValues } from '@/components/TechnicalConfigurationForm';
import { api } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

type TechnicalConfiguration = TechnicalConfigurationValues;

type ProfileResponse = {
  profile: { id: string; code: string; technicalSpecsJson?: string; owner?: string };
  customer: { id: string; code: string; name: string; address?: string };
};

type Attachment = {
  id: string;
  storedFileId?: string;
  name: string;
  type: 'IMAGE' | 'DOCUMENT';
  source?: 'CAMERA' | 'UPLOAD';
  category: string;
  sizeBytes?: number;
  createdAt: string;
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
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const attachmentFileInputRef = useRef<HTMLInputElement>(null);
  const attachmentCameraInputRef = useRef<HTMLInputElement>(null);
  const pendingFilesRef = useRef<Record<string, File>>({});

  const backTarget = useMemo(() => {
    if (returnTo === 'profile-edit') {
      const query = new URLSearchParams();
      if (searchParams.get('customer360') === 'true' && customerId) {
        query.set('returnTo', 'customer360');
        query.set('customerId', customerId);
        query.set('customerReturnTo', customerReturnTo);
      }
      const suffix = query.toString();
      return `/consultation-profiles/${profileId}/edit${suffix ? `?${suffix}` : ''}`;
    }
    if (returnTo === 'customer360' && customerId) return `/business/customers/${customerId}?tab=profiles&profileId=${profileId}&returnTo=${customerReturnTo}`;
    return `/consultation-profiles/${profileId}?tab=requirements`;
  }, [customerId, customerReturnTo, profileId, returnTo, searchParams]);

  const backLabel = returnTo === 'customer360' ? 'Quay lại Customer 360' : returnTo === 'profile-edit' ? 'Quay lại sửa đăng ký tư vấn' : 'Quay lại đăng ký tư vấn';

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
    pendingFilesRef.current = {};
    setDraft(configuration);
    setEditing(false);
  };

  const addAttachments = (files: FileList | null, source: Attachment['source']) => {
    if (!files?.length) return;
    const additions: Attachment[] = Array.from(files).map((file, index) => {
      const id = `pending-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
      pendingFilesRef.current[id] = file;
      return {
        id,
        name: file.name,
        sizeBytes: file.size,
        type: file.type.startsWith('image/') ? 'IMAGE' : 'DOCUMENT',
        source,
        category: 'SURVEY',
        createdAt: new Date().toISOString(),
      };
    });
    setDraft((current) => current ? { ...current, attachments: [...((current.attachments ?? []) as Attachment[]), ...additions] } : current);
  };

  const removeAttachment = (attachmentId: string) => {
    delete pendingFilesRef.current[attachmentId];
    setDraft((current) => current ? { ...current, attachments: ((current.attachments ?? []) as Attachment[]).filter((attachment) => attachment.id !== attachmentId) } : current);
  };

  const uploadPendingAttachments = async (value: TechnicalConfiguration): Promise<TechnicalConfiguration> => {
    const attachments = (value.attachments ?? []) as Attachment[];
    const uploaded = await Promise.all(attachments.map(async (attachment) => {
      const file = pendingFilesRef.current[attachment.id];
      if (!file) return attachment;
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${API_BASE}/files/upload?module=consultation-profiles&recordId=${profileId}`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Không thể tải tệp khảo sát lên máy chủ.');
      const stored = await response.json() as { id?: string; originalName?: string; sizeBytes?: number };
      delete pendingFilesRef.current[attachment.id];
      return { ...attachment, storedFileId: stored.id, name: stored.originalName || attachment.name, sizeBytes: stored.sizeBytes ?? attachment.sizeBytes };
    }));
    return { ...value, attachments: uploaded };
  };

  const save = async () => {
    if (!configuration || !draft) return;
    setSaving(true);
    try {
      const updated = await uploadPendingAttachments({ ...configuration, ...draft, id: configurationId });
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
  const editingValue = draft ?? configuration;
  const attachments = (editingValue.attachments ?? []) as Attachment[];
  const isPinned = typeof editingValue.latitude === 'number' && typeof editingValue.longitude === 'number';
  const pinnedLocationText = isPinned ? `${editingValue.locationLabel || 'Đã ghim vị trí'} · ${editingValue.latitude?.toFixed(6)}, ${editingValue.longitude?.toFixed(6)}` : '';
  const installationAreaText = [editingValue.installationWard, editingValue.installationProvince].filter(Boolean).join(' · ') || 'Đang xác định khu vực';

  const locationExtra = (
    <div className={`technical-location-panel compact ${isPinned ? 'is-pinned' : 'is-unpinned'}`}>
      <div className='technical-location-heading'>
        <Typography.Text strong>Vị trí ghim triển khai <b className='required-marker'>*</b></Typography.Text>
        <span className={`technical-pin-state ${isPinned ? 'is-pinned' : 'is-unpinned'}`}>
          <EnvironmentOutlined /> {isPinned ? 'Đã ghim vị trí' : 'Chưa ghim vị trí'}
        </span>
      </div>
      <Space wrap>
        <Button className={`technical-pin-button ${isPinned ? 'is-pinned' : 'is-unpinned'}`} icon={<PushpinOutlined />} onClick={() => setLocationPickerOpen(true)}>
          {isPinned ? 'Sửa vị trí ghim' : 'Ghim vị trí'}
        </Button>
        {isPinned && <Button icon={<DeleteOutlined />} onClick={() => setDraft((current) => current ? {
          ...current,
          latitude: undefined,
          longitude: undefined,
          locationLabel: undefined,
          installationWard: undefined,
          installationProvince: undefined,
        } : current)}>Xóa ghim</Button>}
      </Space>
      {isPinned && <>
        <div className='location-pin-summary'><EnvironmentOutlined /><Tooltip title={pinnedLocationText}><span>{pinnedLocationText}</span></Tooltip></div>
        <div className='technical-installation-area'>
          <span>Khu vực:</span>
          <Tooltip title={installationAreaText}><div className='technical-installation-area-value'><EnvironmentOutlined /><span>{installationAreaText}</span></div></Tooltip>
          <Typography.Text type='secondary'>Tự động từ vị trí ghim</Typography.Text>
        </div>
      </>}
    </div>
  );

  const attachmentsExtra = (
    <div className='technical-attachment-section'>
      <div className='technical-attachment-actions'>
        <Typography.Text type='secondary'>Tài liệu và ảnh chỉ thuộc cấu hình thang máy đang chỉnh sửa.</Typography.Text>
        <Space size={8} wrap>
          <Button icon={<CameraOutlined />} onClick={() => attachmentCameraInputRef.current?.click()}>Chụp ảnh</Button>
          <Button icon={<PaperClipOutlined />} onClick={() => attachmentFileInputRef.current?.click()}>Đính kèm tệp</Button>
        </Space>
      </div>
      <input ref={attachmentFileInputRef} className='customer-file-input' type='file' multiple hidden accept='image/*,.pdf,.doc,.docx,.xls,.xlsx' onChange={(event) => { addAttachments(event.target.files, 'UPLOAD'); event.target.value = ''; }} />
      <input ref={attachmentCameraInputRef} className='customer-file-input' type='file' hidden accept='image/*' capture='environment' onChange={(event) => { addAttachments(event.target.files, 'CAMERA'); event.target.value = ''; }} />
      {attachments.length ? <div className='attachment-list'>
        {attachments.map((attachment) => <div key={attachment.id} className='attachment-item'>
          <span className='attachment-type-icon'>{attachment.type === 'IMAGE' ? <CameraOutlined /> : <PaperClipOutlined />}</span>
          <div className='attachment-copy'>
            {attachment.storedFileId ? <a href={`${API_BASE}/files/${attachment.storedFileId}`} target='_blank' rel='noreferrer'>{attachment.name}</a> : <Typography.Text strong>{attachment.name}</Typography.Text>}
            <Typography.Text type='secondary'>{attachment.source === 'CAMERA' ? 'Ảnh chụp hiện trường' : attachment.type === 'IMAGE' ? 'Ảnh tải lên' : 'Tài liệu đính kèm'}{attachment.sizeBytes ? ` · ${Math.ceil(attachment.sizeBytes / 1024)} KB` : ''}</Typography.Text>
          </div>
          <Tooltip title='Xóa tài liệu'><Button danger icon={<DeleteOutlined />} onClick={() => removeAttachment(attachment.id)} /></Tooltip>
        </div>)}
      </div> : <Typography.Text type='secondary' className='technical-attachment-empty'>Chưa có tài liệu hoặc ảnh khảo sát cho thang máy này.</Typography.Text>}
    </div>
  );

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
          <TechnicalConfigurationForm
            value={editingValue}
            onChange={setDraft}
            contactAddress={profile.customer.address}
            locationExtra={locationExtra}
            attachmentsExtra={attachmentsExtra}
          />
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
      <DeploymentLocationPickerModal
        open={locationPickerOpen}
        value={isPinned ? { latitude: editingValue.latitude!, longitude: editingValue.longitude!, accuracyMeters: typeof editingValue.locationAccuracyMeters === 'number' ? editingValue.locationAccuracyMeters : undefined, label: editingValue.locationLabel, ward: editingValue.installationWard, province: editingValue.installationProvince } : undefined}
        searchSeed={editingValue.installationAddress}
        onCancel={() => setLocationPickerOpen(false)}
        onConfirm={(location) => {
          setDraft((current) => current ? { ...current, latitude: location.latitude, longitude: location.longitude, locationAccuracyMeters: location.accuracyMeters, locationLabel: location.label, installationWard: location.ward, installationProvince: location.province, installationAreaSource: 'PIN' } : current);
          setLocationPickerOpen(false);
          message.success('Đã cập nhật vị trí ghim triển khai.');
        }}
      />
    </PageContainer>
  );
}
