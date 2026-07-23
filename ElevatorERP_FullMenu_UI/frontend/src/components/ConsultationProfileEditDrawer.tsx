'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraOutlined, CopyOutlined, DeleteOutlined, EditOutlined, EllipsisOutlined, EnvironmentOutlined, LinkOutlined, PaperClipOutlined, PlusOutlined, PushpinOutlined, SlidersOutlined } from '@ant-design/icons';
import { Badge, Button, Col, Drawer, Dropdown, Form, Input, Modal, Radio, Row, Select, Space, Tooltip, Typography, message } from 'antd';
import DeploymentLocationPickerModal from '@/components/DeploymentLocationPickerModal';
import TechnicalConfigurationForm, { type TechnicalConfigurationValues } from '@/components/TechnicalConfigurationForm';
import { api } from '@/lib/api';
import { cloneConsultationConfiguration, parseConsultationConfigurations, technicalConfigurationErrors } from '@/lib/consultationProfileEditor';

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
  mode?: 'FULL_PROFILE' | 'SINGLE_CONFIGURATION';
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

const sourceOptions = ['Marketing', 'Giới thiệu', 'Telesale', 'Khách cũ', 'Cộng tác viên', 'Khác'].map((value) => ({ value, label: value }));

function parseAttachments(raw?: string): Attachment[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is Attachment => Boolean(item) && typeof item === 'object') : [];
  } catch { return []; }
}

function typeLabel(value?: string) { return value === 'GLASS' ? 'Thang kính' : value === 'BUILT' ? 'Thang xây' : 'Chưa cập nhật'; }

export default function ConsultationProfileEditDrawer({ profileId, open, initialConfigurationId, mode = 'FULL_PROFILE', onClose, onSaved }: Props) {
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
  const [deleteCandidateIndex, setDeleteCandidateIndex] = useState<number>();
  const attachmentFileInputRef = useRef<HTMLInputElement>(null);
  const attachmentCameraInputRef = useRef<HTMLInputElement>(null);
  const pendingFilesRef = useRef<Record<string, File>>({});
  const openedInitialConfigIdRef = useRef<string | undefined>(undefined);
  const watchedCustomerAddress = Form.useWatch('address', form);
  const isSingleConfiguration = mode === 'SINGLE_CONFIGURATION';
  const customerAddress = (isSingleConfiguration ? detail?.customer.address : watchedCustomerAddress) || detail?.customer.address;

  const load = useCallback(async () => {
    if (!profileId) return;
    try {
      const response = await api<ProfileDetail>(`/consultation-profiles/${profileId}`);
      const legacyAttachments = parseAttachments(response.profile.attachmentLinksJson);
      const loadedConfigurations = parseConsultationConfigurations(response.profile.technicalSpecsJson).map((configuration, index) => ({
        ...configuration,
        attachments: [
          ...((configuration.attachments ?? []) as Attachment[]),
          ...(index === 0 ? legacyAttachments : []),
        ],
      }));
      setDetail(response);
      setConfigurations(loadedConfigurations);
      pendingFilesRef.current = {};
      form.setFieldsValue({ customerType: response.customer.customerType, name: response.customer.name, phone: response.customer.phone, email: response.customer.email, address: response.customer.address, source: response.profile.source, status: response.profile.status, notes: response.profile.notes });
    } catch (error) { message.error(error instanceof Error ? error.message : 'Không thể tải đăng ký tư vấn.'); }
  }, [form, profileId]);

  useEffect(() => { if (open) void load(); }, [load, open]);

  useEffect(() => {
    if (!open) {
      openedInitialConfigIdRef.current = undefined;
      setDeleteCandidateIndex(undefined);
      return;
    }
    if (!initialConfigurationId || !detail || openedInitialConfigIdRef.current === initialConfigurationId) return;
    const index = configurations.findIndex((item) => item.id === initialConfigurationId);
    openedInitialConfigIdRef.current = initialConfigurationId;
    if (index >= 0) {
      openTechnical(index);
    } else if (isSingleConfiguration) {
      message.error('Không tìm thấy đúng cấu hình thang máy cần sửa.');
      onClose();
    }
  // Chỉ phản ứng khi hồ sơ/cấu hình đích được nạp xong.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialConfigurationId, configurations]);

  const openTechnical = (index: number) => {
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

  const openTechnicalWorkspace = () => {
    if (configurations.length) openTechnical(0);
    else addTechnical();
  };

  const copyTechnical = (index: number) => {
    const currentConfigurations = editingIndex !== undefined && configDraft
      ? configurations.map((item, currentIndex) => currentIndex === editingIndex ? configDraft : item)
      : configurations;
    const source = currentConfigurations[index];
    const id = `elevator-${Date.now()}`;
    const copied = cloneConsultationConfiguration(source, id);
    const nextConfigurations = [...currentConfigurations, copied];
    setConfigurations(nextConfigurations);
    setEditingIndex(nextConfigurations.length - 1);
    setConfigDraft(copied);
    message.success('Đã nhân bản cấu hình thang. Kiểm tra nội dung rồi lưu thay đổi.');
  };

  const removeTechnical = (index: number) => {
    setDeleteCandidateIndex(index);
  };

  const confirmRemoveTechnical = () => {
    if (deleteCandidateIndex === undefined) return;
    const nextConfigurations = configurations.filter((_, currentIndex) => currentIndex !== deleteCandidateIndex);
    setConfigurations(nextConfigurations);
    setDeleteCandidateIndex(undefined);
    if (!nextConfigurations.length) {
      setTechnicalOpen(false);
      setEditingIndex(undefined);
      setConfigDraft(undefined);
      return;
    }
    const nextIndex = Math.min(deleteCandidateIndex, nextConfigurations.length - 1);
    setEditingIndex(nextIndex);
    setConfigDraft({ ...nextConfigurations[nextIndex], attachments: [...(nextConfigurations[nextIndex].attachments ?? [])] });
  };

  const switchTechnical = (index: number) => {
    let nextConfigurations = configurations;
    if (editingIndex !== undefined && configDraft) {
      nextConfigurations = configurations.map((item, currentIndex) => currentIndex === editingIndex ? configDraft : item);
      setConfigurations(nextConfigurations);
    }
    setEditingIndex(index);
    setConfigDraft({ ...nextConfigurations[index], attachments: [...(nextConfigurations[index].attachments ?? [])] });
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
    const errors = technicalConfigurationErrors(configDraft);
    if (errors.length) {
      message.error(`Vui lòng hoàn tất: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '…' : ''}`);
      return;
    }
    setSaving(true);
    try {
      const updated = await uploadAttachments(configDraft);
      if (isSingleConfiguration && profileId) {
        if (!initialConfigurationId || updated.id !== initialConfigurationId) throw new Error('Không xác định được đúng cấu hình thang máy cần lưu.');
        const configurationId = initialConfigurationId;
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
    const invalidIndex = configurations.findIndex((configuration) => technicalConfigurationErrors(configuration).length > 0);
    if (invalidIndex >= 0) {
      const errors = technicalConfigurationErrors(configurations[invalidIndex]);
      message.error(`Cấu hình “${configurations[invalidIndex].name || `Thang máy ${invalidIndex + 1}`}” chưa đầy đủ: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '…' : ''}`);
      openTechnical(invalidIndex);
      return;
    }
    setSaving(true);
    try {
      const uploadedConfigurations = await Promise.all(configurations.map(uploadAttachments));
      await api(`/consultation-profiles/${profileId}`, { method: 'PUT', body: JSON.stringify({ customerId: detail.customer.id, ...values, elevatorType: detail.profile.elevatorType, technicalSpecsJson: JSON.stringify(uploadedConfigurations), attachmentLinksJson: null, isKpiEligible: detail.profile.isKpiEligible }) });
      setConfigurations(uploadedConfigurations);
      message.success('Đã cập nhật đăng ký tư vấn.');
      onClose(); await onSaved();
    } catch (error) { message.error(error instanceof Error ? error.message : 'Không thể cập nhật đăng ký tư vấn.'); }
    finally { setSaving(false); }
  };

  const active = configDraft;
  const isPinned = typeof active?.latitude === 'number' && typeof active?.longitude === 'number';
  const attachments = (active?.attachments ?? []) as Attachment[];
  const pinnedLocationText = active && isPinned ? `${active.locationLabel || 'Đã ghim vị trí'} · ${active.latitude?.toFixed(6)}, ${active.longitude?.toFixed(6)}` : '';
  const installationAreaText = active ? [active.installationWard, active.installationProvince].filter(Boolean).join(' · ') || 'Đang xác định khu vực' : '';
  const locationExtra = active && <div className={`technical-location-panel compact ${isPinned ? 'is-pinned' : 'is-unpinned'}`}>
    <div className='technical-location-heading'><Typography.Text strong>Vị trí ghim triển khai <b className='required-marker'>*</b></Typography.Text><span className={`technical-pin-state ${isPinned ? 'is-pinned' : 'is-unpinned'}`}><EnvironmentOutlined /> {isPinned ? 'Đã ghim vị trí' : 'Chưa ghim vị trí'}</span></div>
    <Space wrap><Button className={`technical-pin-button ${isPinned ? 'is-pinned' : 'is-unpinned'}`} icon={<PushpinOutlined />} onClick={() => setLocationPickerOpen(true)}>{isPinned ? 'Sửa vị trí ghim' : 'Ghim vị trí'}</Button>{isPinned && <Button icon={<DeleteOutlined />} onClick={() => setConfigDraft((current) => current ? { ...current, latitude: undefined, longitude: undefined, locationLabel: undefined, installationWard: undefined, installationProvince: undefined } : current)}>Xóa ghim</Button>}</Space>
    {isPinned && <><div className='location-pin-summary'><EnvironmentOutlined /><Tooltip title={pinnedLocationText}><span>{pinnedLocationText}</span></Tooltip></div><div className='technical-installation-area'><span>Khu vực:</span><Tooltip title={installationAreaText}><div className='technical-installation-area-value'><EnvironmentOutlined /><span>{installationAreaText}</span></div></Tooltip><Typography.Text type='secondary'>Tự động từ vị trí ghim</Typography.Text></div></>}
  </div>;
  const attachmentsExtra = <div className='technical-attachment-section'><div className='technical-attachment-actions'><Typography.Text type='secondary'>Tài liệu và ảnh chỉ thuộc thang máy đang chọn.</Typography.Text><Space size={8} wrap><Button icon={<LinkOutlined />} onClick={() => setAttachmentLinkOpen(true)}>Link</Button><Button icon={<CameraOutlined />} onClick={() => attachmentCameraInputRef.current?.click()}>Chụp ảnh</Button><Button icon={<PaperClipOutlined />} onClick={() => attachmentFileInputRef.current?.click()}>Tệp</Button></Space></div><input ref={attachmentFileInputRef} className='customer-file-input' type='file' multiple hidden accept='image/*,.pdf,.doc,.docx,.xls,.xlsx' onChange={(event) => { addAttachments(event.target.files, 'UPLOAD'); event.target.value = ''; }} /><input ref={attachmentCameraInputRef} className='customer-file-input' type='file' hidden accept='image/*' capture='environment' onChange={(event) => { addAttachments(event.target.files, 'CAMERA'); event.target.value = ''; }} />{attachments.length ? <div className='attachment-list'>{attachments.map((attachment) => <div key={attachment.id} className='attachment-item'><span className='attachment-type-icon'>{attachment.type === 'IMAGE' ? <CameraOutlined /> : attachment.type === 'LINK' ? <LinkOutlined /> : <PaperClipOutlined />}</span><div className='attachment-copy'>{attachment.url || attachment.storedFileId ? <a href={attachment.url ?? `${API_BASE}/files/${attachment.storedFileId}`} target='_blank' rel='noreferrer'>{attachment.name}</a> : <Typography.Text strong>{attachment.name}</Typography.Text>}<Typography.Text type='secondary'>{attachment.source === 'CAMERA' ? 'Ảnh chụp hiện trường' : attachment.type === 'LINK' ? 'Link' : attachment.type === 'IMAGE' ? 'Ảnh tải lên' : 'Tài liệu'}</Typography.Text></div><Tooltip title='Xóa tài liệu'><Button danger icon={<DeleteOutlined />} onClick={() => setConfigDraft((current) => current ? { ...current, attachments: ((current.attachments ?? []) as Attachment[]).filter((item) => item.id !== attachment.id) } : current)} /></Tooltip></div>)}</div> : <Typography.Text type='secondary' className='technical-attachment-empty'>Chưa có tài liệu hoặc ảnh khảo sát cho thang máy này.</Typography.Text>}</div>;

  return <>
    {!isSingleConfiguration && <Drawer title='Sửa đăng ký tư vấn' open={open} onClose={onClose} width='min(1120px, calc(100vw - 40px))' className='customer-form-drawer' rootClassName='customer-form-drawer-root' destroyOnClose footer={<Space><Button onClick={onClose}>Hủy</Button><Button type='primary' loading={saving} onClick={() => form.submit()}>Lưu thay đổi</Button></Space>}>
      <Form form={form} layout='vertical' onFinish={saveProfile} className='consultation-profile-edit-form'>
        <div className='form-section-heading'>Thông tin khách hàng</div>
        <Row gutter={[16, 0]}><Col xs={24}><Form.Item name='customerType' label='Nhóm khách hàng' rules={[{ required: true, message: 'Vui lòng chọn nhóm khách hàng' }]}><Radio.Group options={[{ value: 'PERSONAL', label: 'Cá nhân' }, { value: 'BUSINESS', label: 'Doanh nghiệp' }]} /></Form.Item></Col><Col xs={24} md={12}><Form.Item name='name' label='Tên khách hàng' rules={[{ required: true, message: 'Vui lòng nhập tên khách hàng' }]}><Input /></Form.Item></Col><Col xs={24} md={12}><Form.Item name='phone' label='Số điện thoại' rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}><Input /></Form.Item></Col><Col xs={24} md={12}><Form.Item name='email' label='Email' rules={[{ type: 'email', message: 'Email không hợp lệ' }]}><Input /></Form.Item></Col><Col xs={24} md={12}><Form.Item name='source' label='Nguồn khách hàng'><Select options={sourceOptions} /></Form.Item></Col><Col xs={24}><Form.Item name='address' label='Địa chỉ liên hệ' rules={[{ required: true, message: 'Vui lòng nhập địa chỉ liên hệ' }]}><Input.TextArea rows={2} /></Form.Item></Col></Row>
        <div className='form-section-heading'>Thông tin đăng ký tư vấn</div>
        <Form.Item name='status' hidden><Input /></Form.Item>
        <Row gutter={[16, 0]}><Col xs={24}><Form.Item name='notes' label='Yêu cầu / Ghi chú ban đầu'><Input.TextArea rows={3} placeholder='Loại thang, số tầng, tải trọng, thời gian dự kiến...' /></Form.Item></Col></Row>
        <div className='form-section-heading'>Hồ sơ khảo sát</div>
        <div className='customer-supplement-section'><div className='customer-supplement-heading'><span><SlidersOutlined /> Cấu hình thông số kỹ thuật thang máy <Badge count={configurations.length} showZero size='small' className='section-count-badge' /></span><Typography.Text type='secondary'>Có thể bổ sung khi đã có thông tin khảo sát</Typography.Text></div>{configurations.map((configuration, index) => <div key={configuration.id ?? index} className='elevator-spec-summary-item'><div><Typography.Text strong>{configuration.name || `Thang máy ${index + 1}`}</Typography.Text><Typography.Text type='secondary'>{configuration.floors || '—'} tầng · {configuration.capacityKg || '—'} kg · {typeLabel(configuration.elevatorType)}</Typography.Text></div><Space size={6}><Tooltip title='Sửa cấu hình kỹ thuật'><Button aria-label='Sửa cấu hình thang' icon={<EditOutlined />} onClick={() => openTechnical(index)} /></Tooltip></Space></div>)}<div className='customer-supplement-footer'><Button type='primary' icon={<SlidersOutlined />} onClick={openTechnicalWorkspace}>Mở cấu hình chi tiết</Button></div></div>
      </Form>
    </Drawer>}
    <Drawer title={<span className='technical-drawer-title'><SlidersOutlined /> Cấu hình kỹ thuật thang máy</span>} open={open && technicalOpen} onClose={() => { setTechnicalOpen(false); setConfigDraft(undefined); pendingFilesRef.current = {}; if (isSingleConfiguration) onClose(); }} width='min(1040px, calc(100vw - 64px))' className='technical-config-drawer' rootClassName='technical-config-drawer-root' destroyOnClose footer={<div className='technical-drawer-footer'><span /><Space><Button onClick={() => { setTechnicalOpen(false); if (isSingleConfiguration) onClose(); }}>Đóng</Button><Button type='primary' loading={saving} onClick={() => void saveTechnical()}>Lưu cấu hình</Button></Space></div>}>
      {active && <>
        <div className='technical-tab-row'>
          <div className='technical-tab-list'>
            {(isSingleConfiguration ? configurations.filter((_, index) => index === editingIndex) : configurations).map((configuration, index) => {
              const configurationIndex = isSingleConfiguration ? editingIndex ?? 0 : index;
              return <button key={configuration.id ?? configurationIndex} type='button' className={`technical-tab-button ${configurationIndex === editingIndex ? 'active' : ''}`} onClick={() => switchTechnical(configurationIndex)}><span>{configuration.name || `Thang máy ${configurationIndex + 1}`} ({configuration.floors ?? '—'} tầng)</span></button>;
            })}
            {!isSingleConfiguration && <Button className='technical-add-tab' icon={<PlusOutlined />} onClick={addTechnical}>Thêm thang</Button>}
          </div>
          {!isSingleConfiguration && editingIndex !== undefined && <Dropdown
            trigger={['click']}
            overlayClassName='technical-action-dropdown'
            overlayStyle={{ zIndex: 1700 }}
            getPopupContainer={() => document.body}
            menu={{
              onClick: ({ key }) => {
                if (key === 'copy') copyTechnical(editingIndex);
                if (key === 'delete') removeTechnical(editingIndex);
              },
              items: [
                { key: 'copy', icon: <CopyOutlined />, label: 'Nhân bản cấu hình' },
                { type: 'divider' },
                { key: 'delete', icon: <DeleteOutlined />, label: 'Xóa thang máy', danger: true },
              ],
            }}
          >
            <Button className='technical-more-action' icon={<EllipsisOutlined />} aria-label='Thao tác cấu hình thang máy' />
          </Dropdown>}
        </div>
        <TechnicalConfigurationForm value={active} onChange={setConfigDraft} contactAddress={customerAddress} locationExtra={locationExtra} attachmentsExtra={attachmentsExtra} />
      </>}
    </Drawer>
    <Modal
      title='Xóa thang máy?'
      open={deleteCandidateIndex !== undefined}
      onCancel={() => setDeleteCandidateIndex(undefined)}
      onOk={confirmRemoveTechnical}
      okText='Xóa thang máy'
      cancelText='Hủy'
      okButtonProps={{ danger: true }}
      getContainer={() => document.body}
      zIndex={10000}
      rootClassName='technical-delete-confirm-root'
      className='technical-delete-confirm-modal'
      width={360}
      centered
      maskClosable={false}
      destroyOnHidden
    >
      <Typography.Paragraph>Thang máy <Typography.Text strong>{deleteCandidateIndex !== undefined ? configurations[deleteCandidateIndex]?.name || `Thang máy ${deleteCandidateIndex + 1}` : ''}</Typography.Text> cùng cấu hình kỹ thuật và tài liệu khảo sát sẽ bị loại khỏi đăng ký khi bạn lưu thay đổi.</Typography.Paragraph>
    </Modal>
    <DeploymentLocationPickerModal
      open={locationPickerOpen}
      value={active && isPinned ? { latitude: active.latitude!, longitude: active.longitude!, accuracyMeters: typeof active.locationAccuracyMeters === 'number' ? active.locationAccuracyMeters : undefined, label: active.locationLabel, ward: active.installationWard, province: active.installationProvince } : undefined}
      searchSeed={active?.installationAddress}
      onCancel={() => setLocationPickerOpen(false)}
      onConfirm={(location) => {
        setConfigDraft((current) => current ? { ...current, latitude: location.latitude, longitude: location.longitude, locationAccuracyMeters: location.accuracyMeters, locationLabel: location.label, installationWard: location.ward, installationProvince: location.province, installationAreaSource: 'PIN' } : current);
        setLocationPickerOpen(false);
      }}
    />
    <Modal title='Thêm link tài liệu / ảnh khảo sát' open={attachmentLinkOpen} onCancel={() => setAttachmentLinkOpen(false)} onOk={addAttachmentLink} okText='Thêm link' cancelText='Hủy' destroyOnClose>
      <Space direction='vertical' size={12} style={{ width: '100%' }}>
        <Input value={attachmentLinkUrl} onChange={(event) => setAttachmentLinkUrl(event.target.value)} placeholder='https://... hoặc đường dẫn tài liệu' prefix={<LinkOutlined />} />
        <Input value={attachmentLinkName} onChange={(event) => setAttachmentLinkName(event.target.value)} placeholder='Tên hiển thị (không bắt buộc)' />
      </Space>
    </Modal>
  </>;
}
