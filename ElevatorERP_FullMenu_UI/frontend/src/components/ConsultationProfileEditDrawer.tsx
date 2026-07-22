'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { CameraOutlined, CopyOutlined, DeleteOutlined, EditOutlined, EllipsisOutlined, EnvironmentOutlined, LinkOutlined, PaperClipOutlined, PlusOutlined, PushpinOutlined, SlidersOutlined } from '@ant-design/icons';
import { Badge, Button, Col, Drawer, Form, Input, Modal, Radio, Row, Select, Space, Tooltip, Typography, message } from 'antd';
import TechnicalConfigurationForm, { type TechnicalConfigurationValues } from '@/components/TechnicalConfigurationForm';
import { api } from '@/lib/api';

const LocationPickerMap = dynamic(() => import('@/components/LocationPickerMap'), { ssr: false });
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

type ProfileDetail = {
  profile: { id: string; code: string; source?: string; status: string; elevatorType?: string; notes?: string; technicalSpecsJson?: string; attachmentLinksJson?: string; isKpiEligible?: boolean; owner?: string };
  customer: { id: string; code: string; customerType: 'PERSONAL' | 'BUSINESS'; name: string; phone: string; email?: string; address?: string };
};

type ProfileValues = { customerType: 'PERSONAL' | 'BUSINESS'; name: string; phone: string; email?: string; address?: string; source?: string; status: string; notes?: string };
type Attachment = { id: string; storedFileId?: string; url?: string; name: string; type: 'IMAGE' | 'DOCUMENT' | 'LINK'; source?: 'CAMERA' | 'UPLOAD' | 'LINK'; category: string; sizeBytes?: number; createdAt: string };
type Configuration = TechnicalConfigurationValues;

type Props = {
  profileId?: string;
  open: boolean;
  initialConfigurationId?: string;
  configurationOnly?: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

const statusOptions = [['NEW', 'Mới tiếp nhận'], ['CONTACTED', 'Đã liên hệ'], ['CARING', 'Đang chăm sóc'], ['WAITING_SURVEY', 'Chờ khảo sát'], ['SURVEYED', 'Đã khảo sát'], ['QUOTED', 'Đã gửi báo giá'], ['NEGOTIATING', 'Đang đàm phán'], ['CONVERTED', 'Đã chuyển sang hợp đồng'], ['PAUSED', 'Tạm dừng chăm sóc'], ['LOST', 'Không thành công']].map(([value, label]) => ({ value, label }));
const sourceOptions = ['Marketing', 'Giới thiệu', 'Telesale', 'Khách cũ', 'Cộng tác viên', 'Khác'].map((value) => ({ value, label: value }));

function parseConfigurations(raw?: string): Configuration[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is Configuration => Boolean(item) && typeof item === 'object') : [];
  } catch { return []; }
}

function typeLabel(value?: string) { return value === 'GLASS' ? 'Thang kính' : value === 'BUILT' ? 'Thang xây' : 'Chưa cập nhật'; }

export default function ConsultationProfileEditDrawer({ profileId, open, initialConfigurationId, configurationOnly = false, onClose, onSaved }: Props) {
  const [form] = Form.useForm<ProfileValues>();
  const [detail, setDetail] = useState<ProfileDetail>();
  const [configurations, setConfigurations] = useState<Configuration[]>([]);
  const [saving, setSaving] = useState(false);
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number>();
  const [configDraft, setConfigDraft] = useState<Configuration>();
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [attachmentLinkOpen, setAttachmentLinkOpen] = useState(false);
  const [attachmentLinkUrl, setAttachmentLinkUrl] = useState('');
  const [attachmentLinkName, setAttachmentLinkName] = useState('');
  const attachmentFileInputRef = useRef<HTMLInputElement>(null);
  const attachmentCameraInputRef = useRef<HTMLInputElement>(null);
  const pendingFilesRef = useRef<Record<string, File>>({});
  const openedInitialConfigIdRef = useRef<string | undefined>(undefined);
  const customerAddress = Form.useWatch('address', form);

  const load = useCallback(async () => {
    if (!profileId) return;
    try {
      const response = await api<ProfileDetail>(`/consultation-profiles/${profileId}`);
      setDetail(response);
      setConfigurations(parseConfigurations(response.profile.technicalSpecsJson));
      form.setFieldsValue({ customerType: response.customer.customerType, name: response.customer.name, phone: response.customer.phone, email: response.customer.email, address: response.customer.address, source: response.profile.source, status: response.profile.status, notes: response.profile.notes });
    } catch (error) { message.error(error instanceof Error ? error.message : 'Không thể tải đăng ký tư vấn.'); }
  }, [form, profileId]);

  useEffect(() => { if (open) void load(); }, [load, open]);

  useEffect(() => {
    if (!open) {
      openedInitialConfigIdRef.current = undefined;
      return;
    }
    if (!initialConfigurationId || !configurations.length || openedInitialConfigIdRef.current === initialConfigurationId) return;
    const index = configurations.findIndex((item, currentIndex) => (item.id ?? String(currentIndex)) === initialConfigurationId);
    if (index >= 0) {
      openedInitialConfigIdRef.current = initialConfigurationId;
      openTechnical(index);
    }
  // Chỉ phản ứng khi hồ sơ/cấu hình đích được nạp xong.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialConfigurationId, configurations]);

  const openTechnical = (index: number) => {
    pendingFilesRef.current = {};
    setEditingIndex(index);
    setConfigDraft({ ...configurations[index], attachments: [...(configurations[index].attachments ?? [])] });
    setTechnicalOpen(true);
  };

  const addTechnical = () => {
    const configuration: Configuration = { id: `elevator-${Date.now()}`, name: `Thang máy ${configurations.length + 1}`, elevatorType: 'BUILT', floors: 1, capacityKg: 450, counterweightPosition: 'BACK', floorHeights: [{ id: `floor-${Date.now()}`, floorName: 'Tầng 1', heightMm: 3600 }], attachments: [] };
    setConfigurations((current) => [...current, configuration]);
    pendingFilesRef.current = {};
    setEditingIndex(configurations.length);
    setConfigDraft(configuration);
    setTechnicalOpen(true);
  };

  const copyTechnical = (index: number) => {
    const source = configurations[index];
    const copied: Configuration = { ...source, id: `elevator-${Date.now()}`, name: `${source.name || 'Thang máy'} (bản sao)`, floorHeights: source.floorHeights?.map((floor, floorIndex) => ({ ...floor, id: `floor-${Date.now()}-${floorIndex}` })), attachments: [] };
    setConfigurations((current) => [...current, copied]);
  };

  const updatePin = async (latitude: number, longitude: number) => {
    let locationLabel = `Tọa độ: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    let installationWard: string | undefined;
    let installationProvince: string | undefined;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, { headers: { Accept: 'application/json' } });
      if (response.ok) {
        const result = await response.json() as { display_name?: string; address?: { suburb?: string; village?: string; town?: string; city_district?: string; state?: string; city?: string } };
        locationLabel = result.display_name || locationLabel;
        installationWard = result.address?.suburb || result.address?.village || result.address?.town || result.address?.city_district;
        installationProvince = result.address?.state || result.address?.city;
      }
    } catch { /* vẫn lưu tọa độ khi không tra được địa chỉ */ }
    setConfigDraft((current) => current ? { ...current, latitude, longitude, locationLabel, installationWard: installationWard || current.installationWard, installationProvince: installationProvince || current.installationProvince } : current);
    setLocationPickerOpen(false);
  };

  const addAttachments = (files: FileList | null, source: Attachment['source']) => {
    if (!files?.length) return;
    const additions: Attachment[] = Array.from(files).map((file, index) => {
      const id = `pending-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
      pendingFilesRef.current[id] = file;
      return { id, name: file.name, sizeBytes: file.size, type: file.type.startsWith('image/') ? 'IMAGE' : 'DOCUMENT', source, category: 'SURVEY', createdAt: new Date().toISOString() };
    });
    setConfigDraft((current) => current ? { ...current, attachments: [...((current.attachments ?? []) as Attachment[]), ...additions] } : current);
  };

  const addAttachmentLink = () => {
    const url = attachmentLinkUrl.trim();
    if (!url) return message.warning('Nhập đường dẫn tài liệu hoặc ảnh khảo sát.');
    try { new URL(url); } catch { return message.warning('Đường dẫn liên kết chưa hợp lệ.'); }
    const name = attachmentLinkName.trim() || url;
    const attachment: Attachment = { id: `link-${Date.now()}`, name, url, type: 'LINK', source: 'LINK', category: 'SURVEY', createdAt: new Date().toISOString() };
    setConfigDraft((current) => current ? { ...current, attachments: [...((current.attachments ?? []) as Attachment[]), attachment] } : current);
    setAttachmentLinkUrl(''); setAttachmentLinkName(''); setAttachmentLinkOpen(false);
  };

  const uploadAttachments = async (configuration: Configuration) => {
    const attachments = (configuration.attachments ?? []) as Attachment[];
    const next = await Promise.all(attachments.map(async (attachment) => {
      const file = pendingFilesRef.current[attachment.id];
      if (!file || !profileId) return attachment;
      const formData = new FormData(); formData.append('file', file);
      const response = await fetch(`${API_BASE}/files/upload?module=consultation-profiles&recordId=${profileId}`, { method: 'POST', body: formData, credentials: 'include' });
      if (!response.ok) throw new Error('Không thể tải tệp khảo sát lên máy chủ.');
      const stored = await response.json() as { id?: string; originalName?: string; sizeBytes?: number };
      delete pendingFilesRef.current[attachment.id];
      return { ...attachment, storedFileId: stored.id, name: stored.originalName || attachment.name, sizeBytes: stored.sizeBytes ?? attachment.sizeBytes };
    }));
    return { ...configuration, attachments: next };
  };

  const saveTechnical = async () => {
    if (editingIndex === undefined || !configDraft) return;
    setSaving(true);
    try {
      const updated = await uploadAttachments(configDraft);
      if (configurationOnly && profileId) {
        const configurationId = updated.id ?? initialConfigurationId ?? String(editingIndex);
        await api(`/consultation-profiles/${profileId}/technical-configurations/${configurationId}`, {
          method: 'PUT',
          body: JSON.stringify({ configuration: { ...updated, id: configurationId } }),
        });
        setTechnicalOpen(false);
        setConfigDraft(undefined);
        pendingFilesRef.current = {};
        message.success('Đã lưu cấu hình kỹ thuật thang máy.');
        onClose();
        await onSaved();
        return;
      }
      setConfigurations((current) => current.map((item, index) => index === editingIndex ? updated : item));
      setTechnicalOpen(false); setConfigDraft(undefined); pendingFilesRef.current = {};
      message.success('Đã cập nhật cấu hình vào đăng ký tư vấn.');
    } catch (error) { message.error(error instanceof Error ? error.message : 'Không thể lưu cấu hình kỹ thuật.'); }
    finally { setSaving(false); }
  };

  const saveProfile = async (values: ProfileValues) => {
    if (!detail || !profileId) return;
    setSaving(true);
    try {
      await api(`/consultation-profiles/${profileId}`, { method: 'PUT', body: JSON.stringify({ customerId: detail.customer.id, ...values, elevatorType: detail.profile.elevatorType, technicalSpecsJson: JSON.stringify(configurations), attachmentLinksJson: detail.profile.attachmentLinksJson, isKpiEligible: detail.profile.isKpiEligible }) });
      message.success('Đã cập nhật đăng ký tư vấn.');
      onClose(); await onSaved();
    } catch (error) { message.error(error instanceof Error ? error.message : 'Không thể cập nhật đăng ký tư vấn.'); }
    finally { setSaving(false); }
  };

  const active = configDraft;
  const isPinned = typeof active?.latitude === 'number' && typeof active?.longitude === 'number';
  const attachments = (active?.attachments ?? []) as Attachment[];
  const locationExtra = active && <div className={`technical-location-panel ${isPinned ? 'is-pinned' : 'is-unpinned'}`}><div><Typography.Text strong>Vị trí ghim triển khai <b className='required-marker'>*</b></Typography.Text><Typography.Text type='secondary'>Ghim tọa độ riêng cho thang này để kỹ thuật mở bản đồ khi khảo sát/lắp đặt.</Typography.Text><span className={`technical-pin-state ${isPinned ? 'is-pinned' : 'is-unpinned'}`}><EnvironmentOutlined /> {isPinned ? 'Đã ghim vị trí' : 'Chưa ghim vị trí'}</span></div><Space wrap><Button className={`technical-pin-button ${isPinned ? 'is-pinned' : 'is-unpinned'}`} icon={<PushpinOutlined />} onClick={() => setLocationPickerOpen(true)}>{isPinned ? 'Sửa vị trí ghim' : 'Ghim vị trí'}</Button>{isPinned && <Button icon={<DeleteOutlined />} onClick={() => setConfigDraft((current) => current ? { ...current, latitude: undefined, longitude: undefined, locationLabel: undefined, installationWard: undefined, installationProvince: undefined } : current)}>Xóa ghim</Button>}</Space>{isPinned && <><div className='location-pin-summary'><EnvironmentOutlined /><span>{active.locationLabel || 'Đã ghim vị trí'} · {active.latitude?.toFixed(6)}, {active.longitude?.toFixed(6)}</span></div><div className='technical-installation-area'><span>Khu vực lắp đặt</span><Typography.Text type='secondary'>Tự động từ vị trí ghim</Typography.Text><div className='technical-installation-area-value'><EnvironmentOutlined /><span>{[active.installationWard, active.installationProvince].filter(Boolean).join(' · ') || 'Đang xác định khu vực'}</span></div></div></>}</div>;
  const attachmentsExtra = <div className='technical-attachment-section'><div className='technical-attachment-actions'><Typography.Text type='secondary'>Tài liệu và ảnh chỉ thuộc thang máy đang chọn.</Typography.Text><Space size={8} wrap><Button icon={<LinkOutlined />} onClick={() => setAttachmentLinkOpen(true)}>Link</Button><Button icon={<CameraOutlined />} onClick={() => attachmentCameraInputRef.current?.click()}>Chụp ảnh</Button><Button icon={<PaperClipOutlined />} onClick={() => attachmentFileInputRef.current?.click()}>Tệp</Button></Space></div><input ref={attachmentFileInputRef} className='customer-file-input' type='file' multiple hidden accept='image/*,.pdf,.doc,.docx,.xls,.xlsx' onChange={(event) => { addAttachments(event.target.files, 'UPLOAD'); event.target.value = ''; }} /><input ref={attachmentCameraInputRef} className='customer-file-input' type='file' hidden accept='image/*' capture='environment' onChange={(event) => { addAttachments(event.target.files, 'CAMERA'); event.target.value = ''; }} />{attachments.length ? <div className='attachment-list'>{attachments.map((attachment) => <div key={attachment.id} className='attachment-item'><span className='attachment-type-icon'>{attachment.type === 'IMAGE' ? <CameraOutlined /> : attachment.type === 'LINK' ? <LinkOutlined /> : <PaperClipOutlined />}</span><div className='attachment-copy'>{attachment.url || attachment.storedFileId ? <a href={attachment.url ?? `${API_BASE}/files/${attachment.storedFileId}`} target='_blank' rel='noreferrer'>{attachment.name}</a> : <Typography.Text strong>{attachment.name}</Typography.Text>}<Typography.Text type='secondary'>{attachment.source === 'CAMERA' ? 'Ảnh chụp hiện trường' : attachment.type === 'LINK' ? 'Link' : attachment.type === 'IMAGE' ? 'Ảnh tải lên' : 'Tài liệu'}</Typography.Text></div><Tooltip title='Xóa tài liệu'><Button danger icon={<DeleteOutlined />} onClick={() => setConfigDraft((current) => current ? { ...current, attachments: ((current.attachments ?? []) as Attachment[]).filter((item) => item.id !== attachment.id) } : current)} /></Tooltip></div>)}</div> : <Typography.Text type='secondary' className='technical-attachment-empty'>Chưa có tài liệu hoặc ảnh khảo sát cho thang máy này.</Typography.Text>}</div>;

  return <>
    {!configurationOnly && <Drawer title='Sửa đăng ký tư vấn' open={open} onClose={onClose} width='min(1120px, calc(100vw - 40px))' className='customer-form-drawer' rootClassName='customer-form-drawer-root' destroyOnClose footer={<Space><Button onClick={onClose}>Hủy</Button><Button type='primary' loading={saving} onClick={() => form.submit()}>Lưu thay đổi</Button></Space>}>
      <Form form={form} layout='vertical' onFinish={saveProfile} className='consultation-profile-edit-form'>
        <div className='form-section-heading'>Thông tin khách hàng</div>
        <Row gutter={[16, 0]}><Col xs={24}><Form.Item name='customerType' label='Nhóm khách hàng' rules={[{ required: true }]}><Radio.Group options={[{ value: 'PERSONAL', label: 'Cá nhân' }, { value: 'BUSINESS', label: 'Doanh nghiệp' }]} /></Form.Item></Col><Col xs={24} md={12}><Form.Item name='name' label='Tên khách hàng' rules={[{ required: true }]}><Input /></Form.Item></Col><Col xs={24} md={12}><Form.Item name='phone' label='Số điện thoại' rules={[{ required: true }]}><Input /></Form.Item></Col><Col xs={24} md={12}><Form.Item name='email' label='Email'><Input /></Form.Item></Col><Col xs={24} md={12}><Form.Item name='source' label='Nguồn khách hàng'><Select options={sourceOptions} /></Form.Item></Col><Col xs={24}><Form.Item name='address' label='Địa chỉ liên hệ'><Input.TextArea rows={2} /></Form.Item></Col></Row>
        <div className='form-section-heading'>Thông tin đăng ký tư vấn</div>
        <Row gutter={[16, 0]}><Col xs={24} md={12}><Form.Item name='status' label='Trạng thái hồ sơ' rules={[{ required: true }]}><Select options={statusOptions} /></Form.Item></Col><Col xs={24}><Form.Item name='notes' label='Yêu cầu / Ghi chú ban đầu'><Input.TextArea rows={3} placeholder='Loại thang, số tầng, tải trọng, thời gian dự kiến...' /></Form.Item></Col></Row>
        <div className='form-section-heading'>Hồ sơ khảo sát</div>
        <div className='customer-supplement-section'><div className='customer-supplement-heading'><span><SlidersOutlined /> Cấu hình thông số kỹ thuật thang máy <Badge count={configurations.length} showZero size='small' className='section-count-badge' /></span><Typography.Text type='secondary'>Có thể bổ sung khi đã có thông tin khảo sát</Typography.Text></div>{configurations.map((configuration, index) => <div key={configuration.id ?? index} className='elevator-spec-summary-item'><div><Typography.Text strong>{configuration.name || `Thang máy ${index + 1}`}</Typography.Text><Typography.Text type='secondary'>{configuration.floors || '—'} tầng · {configuration.capacityKg || '—'} kg · {typeLabel(configuration.elevatorType)}</Typography.Text></div><Space size={6}><Tooltip title='Nhân bản cấu hình'><Button icon={<CopyOutlined />} onClick={() => copyTechnical(index)} /></Tooltip><Tooltip title='Sửa cấu hình kỹ thuật'><Button icon={<EditOutlined />} onClick={() => openTechnical(index)} /></Tooltip></Space></div>)}<div className='customer-supplement-footer'><Button icon={<PlusOutlined />} onClick={addTechnical}>Thêm thang</Button>{configurations.length > 0 && <Button type='primary' icon={<SlidersOutlined />} onClick={() => openTechnical(0)}>Mở cấu hình chi tiết</Button>}</div></div>
      </Form>
    </Drawer>}
    <Drawer title={<span className='technical-drawer-title'><SlidersOutlined /> Cấu hình kỹ thuật thang máy</span>} open={open && technicalOpen} onClose={() => { setTechnicalOpen(false); setConfigDraft(undefined); pendingFilesRef.current = {}; if (configurationOnly) onClose(); }} width='min(1040px, calc(100vw - 64px))' className='technical-config-drawer' rootClassName='technical-config-drawer-root' destroyOnClose footer={<div className='technical-drawer-footer'><span /><Space><Button onClick={() => { setTechnicalOpen(false); if (configurationOnly) onClose(); }}>Đóng</Button><Button type='primary' loading={saving} onClick={() => void saveTechnical()}>Lưu cấu hình</Button></Space></div>}>
      {active && <>
        <div className='technical-tab-row'>
          <div className='technical-tab-list'>
            <button type='button' className='technical-tab-button active'><span>{active.name || 'Thang máy'} ({active.floors ?? '—'} tầng)</span></button>
            {!configurationOnly && <Button className='technical-add-tab' icon={<PlusOutlined />} onClick={addTechnical}>Thêm thang</Button>}
          </div>
          {!configurationOnly && <Button className='technical-more-action' icon={<EllipsisOutlined />} aria-label='Thao tác cấu hình thang máy' />}
        </div>
        <TechnicalConfigurationForm value={active} onChange={setConfigDraft} contactAddress={customerAddress} locationExtra={locationExtra} attachmentsExtra={attachmentsExtra} />
      </>}
    </Drawer>
    <Modal title='Ghim vị trí lắp đặt' open={locationPickerOpen} onCancel={() => setLocationPickerOpen(false)} footer={<Button onClick={() => setLocationPickerOpen(false)}>Đóng</Button>} width={760} destroyOnClose><Typography.Paragraph type='secondary'>Chọn vị trí trên bản đồ để cập nhật cấu hình thang máy.</Typography.Paragraph>{active && <div style={{ height: 420 }}><LocationPickerMap center={[active.latitude ?? 19.8071, active.longitude ?? 105.7763]} pin={isPinned ? [active.latitude!, active.longitude!] : undefined} onPick={(latitude, longitude) => void updatePin(latitude, longitude)} /></div>}</Modal>
    <Modal title='Thêm link tài liệu / ảnh khảo sát' open={attachmentLinkOpen} onCancel={() => setAttachmentLinkOpen(false)} onOk={addAttachmentLink} okText='Thêm link' cancelText='Hủy' destroyOnClose>
      <Space direction='vertical' size={12} style={{ width: '100%' }}>
        <Input value={attachmentLinkUrl} onChange={(event) => setAttachmentLinkUrl(event.target.value)} placeholder='https://... hoặc đường dẫn tài liệu' prefix={<LinkOutlined />} />
        <Input value={attachmentLinkName} onChange={(event) => setAttachmentLinkName(event.target.value)} placeholder='Tên hiển thị (không bắt buộc)' />
      </Space>
    </Modal>
  </>;
}
