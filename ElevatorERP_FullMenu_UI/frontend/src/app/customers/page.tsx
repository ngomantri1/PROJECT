'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AutoComplete,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Dropdown,
  Drawer,
  DatePicker,
  Empty,
  Input,
  InputNumber,
  List,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  AimOutlined,
  BankOutlined,
  CalendarOutlined,
  CameraOutlined,
  CheckOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EllipsisOutlined,
  EnvironmentOutlined,
  EditOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  FilterOutlined,
  LinkOutlined,
  PaperClipOutlined,
  PhoneOutlined,
  PlusOutlined,
  PushpinOutlined,
  ReloadOutlined,
  SearchOutlined,
  SlidersOutlined,
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
import type { ProFormInstance } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exportCsv';

const LocationPickerMap = dynamic(() => import('@/components/LocationPickerMap'), { ssr: false });
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

type CustomerRow = {
  id: string;
  code: string;
  customerId?: string;
  customerCode?: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  area?: string;
  elevatorType?: string;
  customerType: 'PERSONAL' | 'BUSINESS';
  notes?: string;
  source: string;
  owner: string;
  status: string;
  technicalSpecsJson?: string;
  attachmentLinksJson?: string;
  createdAt?: string;
};

type CustomerMasterRow = {
  id: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  area?: string;
  customerType: 'PERSONAL' | 'BUSINESS';
  source?: string;
};

type CustomerForm = {
  customerId?: string;
  customerType: 'PERSONAL' | 'BUSINESS';
  name: string;
  phone: string;
  email?: string;
  area?: string;
  elevatorType?: string;
  source: string;
  address?: string;
  notes?: string;
  status: string;
  technicalSpecsJson?: string;
  attachmentLinksJson?: string;
};

type CustomerLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  label?: string;
};

type CustomerSaveResponse = {
  id: string;
  code: string;
};

function normalizePhone(value?: string) {
  const digits = value?.replace(/[^\d]/g, '') ?? '';
  return digits.startsWith('84') && digits.length > 9 ? `0${digits.slice(2)}` : digits;
}

type FileUploadResponse = {
  id: string;
  originalName: string;
  sizeBytes: number;
};

type ElevatorFloorHeight = {
  id: string;
  floorName: string;
  heightMm?: number;
};

type ElevatorSpec = {
  id: string;
  name: string;
  floors?: number;
  capacityKg?: number;
  elevatorType?: string;
  counterweightPosition?: string;
  shaftWidthMm?: number;
  shaftDepthMm?: number;
  pitDepthMm?: number;
  machineRoomHeightMm?: number;
  overheadHeightMm?: number;
  installationAddress?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracyMeters?: number;
  locationLabel?: string;
  floorHeights: ElevatorFloorHeight[];
  technicalNotes?: string;
};

type CustomerAttachment = {
  id: string;
  storedFileId?: string;
  name: string;
  type: 'IMAGE' | 'DOCUMENT' | 'LINK';
  source?: 'CAMERA' | 'UPLOAD' | 'LINK';
  category: string;
  sizeBytes?: number;
  url?: string;
  capturedAt?: string;
  createdAt: string;
};

type GeoLocationSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  latitude?: number;
  longitude?: number;
  label: string;
  provider?: string;
  placeId?: string;
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
  customerType?: string;
  elevatorType?: string;
  source?: string;
  owner?: string;
  area?: string;
  createdFrom?: string;
  createdTo?: string;
};

const textSorter = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

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
const fallbackCustomerTypeOptions: CatalogOption[] = [
  { code: 'PERSONAL', label: 'Cá nhân', color: 'green' },
  { code: 'BUSINESS', label: 'Doanh nghiệp', color: 'blue' },
];
const fallbackElevatorTypeOptions: CatalogOption[] = [
  { code: 'BUILT', label: 'Thang xây', color: 'green' },
  { code: 'GLASS', label: 'Thang kính', color: 'blue' },
];

const counterweightOptions = [
  { value: 'BACK', label: 'Sau' },
  { value: 'SIDE', label: 'Hông' },
  { value: 'NONE', label: 'Không đối trọng' },
];

const attachmentCategoryOptions = ['Ảnh khảo sát', 'Bản vẽ', 'Nhu cầu khách hàng', 'Tài liệu pháp lý', 'Khác'];

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

function CatalogTag({ value, options }: { value?: string; options: CatalogOption[] }) {
  if (!value) return <Typography.Text type='secondary'>Chưa chọn</Typography.Text>;
  const type = statusMeta(options, value);
  return <Tag color={type.color}>{type.label}</Tag>;
}

function CustomerTypeTag({ value, typeOptions }: { value: string; typeOptions: CatalogOption[] }) {
  return <CatalogTag value={value} options={typeOptions} />;
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createElevatorSpec(index: number): ElevatorSpec {
  return {
    id: createId('elevator'),
    name: `Thang máy ${index}`,
    floors: 2,
    counterweightPosition: 'BACK',
    floorHeights: [
      { id: createId('floor'), floorName: 'Tầng 1', heightMm: 3600 },
      { id: createId('floor'), floorName: 'Tầng 2', heightMm: 3600 },
    ],
  };
}

function cloneElevatorSpec(source: ElevatorSpec, index: number): ElevatorSpec {
  return {
    ...source,
    id: createId('elevator'),
    name: `${source.name || `Thang máy ${index}`} - Bản sao`,
    floorHeights: source.floorHeights.map((floor) => ({ ...floor, id: createId('floor') })),
  };
}

function formatElevatorSpecLabel(spec: ElevatorSpec) {
  return `${spec.name || 'Thang máy'}${spec.floors ? ` (${spec.floors} tầng)` : ''}`;
}

function formatFileSize(sizeBytes?: number) {
  if (!sizeBytes) return '';
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}

function parseJsonArray<T>(value?: string): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

export default function Customers() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerFormRef = useRef<ProFormInstance<CustomerForm> | undefined>(undefined);
  const attachmentFileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentCameraInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentFileByIdRef = useRef<Record<string, File>>({});
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [data, setData] = useState<CustomerRow[]>([]);
  const [masterCustomers, setMasterCustomers] = useState<CustomerMasterRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow>();
  const [selectedExistingCustomerId, setSelectedExistingCustomerId] = useState<string>();
  const [duplicateConsultationCustomer, setDuplicateConsultationCustomer] = useState<CustomerMasterRow>();
  const [technicalDrawerOpen, setTechnicalDrawerOpen] = useState(false);
  const [elevatorSpecs, setElevatorSpecs] = useState<ElevatorSpec[]>([]);
  const [activeElevatorSpecId, setActiveElevatorSpecId] = useState<string>();
  const [deleteElevatorSpecCandidate, setDeleteElevatorSpecCandidate] = useState<ElevatorSpec>();
  const [attachments, setAttachments] = useState<CustomerAttachment[]>([]);
  const [attachmentLinkModalOpen, setAttachmentLinkModalOpen] = useState(false);
  const [attachmentLinkDraft, setAttachmentLinkDraft] = useState('');
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationTargetElevatorSpecId, setLocationTargetElevatorSpecId] = useState<string>();
  const [draftLocation, setDraftLocation] = useState<CustomerLocation>();
  const [locationSearch, setLocationSearch] = useState('');
  const [sharedLocationText, setSharedLocationText] = useState('');
  const [lastResolvedSharedLocation, setLastResolvedSharedLocation] = useState('');
  const [coordinateEditing, setCoordinateEditing] = useState(false);
  const [coordinateDraft, setCoordinateDraft] = useState({ latitude: '', longitude: '' });
  const [locationSuggestions, setLocationSuggestions] = useState<GeoLocationSuggestion[]>([]);
  const [locationSuggesting, setLocationSuggesting] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>();
  const [statusGroup, setStatusGroup] = useState<string>();
  const [customerType, setCustomerType] = useState<string>();
  const [elevatorType, setElevatorType] = useState<string>();
  const [source, setSource] = useState<string>();
  const [owner, setOwner] = useState<string>();
  const [area, setArea] = useState<string>();
  const [createdRange, setCreatedRange] = useState<[Dayjs, Dayjs]>();
  const [customerTablePage, setCustomerTablePage] = useState({ current: 1, pageSize: 10 });
  const [draftStatus, setDraftStatus] = useState<string>();
  const [draftCustomerType, setDraftCustomerType] = useState<string>();
  const [draftElevatorType, setDraftElevatorType] = useState<string>();
  const [draftSource, setDraftSource] = useState<string>();
  const [draftOwner, setDraftOwner] = useState<string>();
  const [draftArea, setDraftArea] = useState<string>();
  const [draftCreatedRange, setDraftCreatedRange] = useState<[Dayjs, Dayjs]>();
  const [catalogStatuses, setCatalogStatuses] = useState<CatalogOption[]>([]);
  const [catalogCustomerTypes, setCatalogCustomerTypes] = useState<CatalogOption[]>([]);
  const [catalogElevatorTypes, setCatalogElevatorTypes] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string>();
  const statusOptions = catalogStatuses.length ? catalogStatuses : fallbackStatusOptions;
  const customerTypeOptions = catalogCustomerTypes.length ? catalogCustomerTypes : fallbackCustomerTypeOptions;
  const elevatorTypeOptions = catalogElevatorTypes.length ? catalogElevatorTypes : fallbackElevatorTypeOptions;
  const activeElevatorSpec = elevatorSpecs.find((item) => item.id === activeElevatorSpecId) ?? elevatorSpecs[0];
  const masterCustomerOptions = useMemo(
    () => masterCustomers.map((customer) => ({
      value: customer.id,
      label: `${customer.code} - ${customer.name} - ${customer.phone}`,
    })),
    [masterCustomers],
  );
  const selectedExistingCustomer = masterCustomers.find((customer) => customer.id === selectedExistingCustomerId);
  const locationSuggestionOptions = useMemo(
    () => locationSuggestions.map((item) => ({
      value: item.id,
      label: (
        <div className='location-suggestion-option'>
          <div>
            <Typography.Text strong>{item.title}</Typography.Text>
            <Typography.Text type='secondary'>{item.subtitle || item.label}</Typography.Text>
          </div>
          <Tag>{item.provider === 'google' ? 'Google' : item.type}</Tag>
        </div>
      ),
    })),
    [locationSuggestions],
  );

  const load = useCallback(async (overrides?: CustomerFilters) => {
    setLoading(true);
    try {
      const hasOverride = (key: keyof CustomerFilters) =>
        overrides ? Object.prototype.hasOwnProperty.call(overrides, key) : false;
      const currentSearch = hasOverride('search') ? overrides?.search : search;
      const currentStatus = hasOverride('status') ? overrides?.status : status;
      const currentStatusGroup = hasOverride('statusGroup') ? overrides?.statusGroup : statusGroup;
      const currentCustomerType = hasOverride('customerType') ? overrides?.customerType : customerType;
      const currentElevatorType = hasOverride('elevatorType') ? overrides?.elevatorType : elevatorType;
      const currentSource = hasOverride('source') ? overrides?.source : source;
      const currentOwner = hasOverride('owner') ? overrides?.owner : owner;
      const currentArea = hasOverride('area') ? overrides?.area : area;
      const currentCreatedFrom = hasOverride('createdFrom') ? overrides?.createdFrom : createdRange?.[0].startOf('day').toISOString();
      const currentCreatedTo = hasOverride('createdTo') ? overrides?.createdTo : createdRange?.[1].endOf('day').toISOString();
      const params = new URLSearchParams();
      if (currentSearch?.trim()) params.set('search', currentSearch.trim());
      if (currentStatus) params.set('status', currentStatus);
      if (!currentStatus && currentStatusGroup) params.set('statusGroup', currentStatusGroup);
      if (currentCustomerType) params.set('customerType', currentCustomerType);
      if (currentElevatorType) params.set('elevatorType', currentElevatorType);
      if (currentSource) params.set('source', currentSource);
      if (currentOwner) params.set('owner', currentOwner);
      if (currentArea) params.set('area', currentArea);
      if (currentCreatedFrom) params.set('createdFrom', currentCreatedFrom);
      if (currentCreatedTo) params.set('createdTo', currentCreatedTo);
      const query = params.toString();
      setData(await api<CustomerRow[]>(`/consultation-profiles${query ? `?${query}` : ''}`));
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách hồ sơ tư vấn.');
    } finally {
      setLoading(false);
    }
  }, [area, createdRange, customerType, elevatorType, owner, search, source, status, statusGroup]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    setCustomerTablePage((page) => ({ ...page, current: 1 }));
  }, [area, createdRange, customerType, elevatorType, owner, search, source, status, statusGroup]);

  useEffect(() => {
    setCustomerTablePage((page) => {
      const maxPage = Math.max(1, Math.ceil(data.length / page.pageSize));
      return page.current > maxPage ? { ...page, current: maxPage } : page;
    });
  }, [data.length]);

  useEffect(() => {
    api<CatalogOption[]>('/catalogs/categories/customer_status/options?activeOnly=true')
      .then(setCatalogStatuses)
      .catch(() => setCatalogStatuses(fallbackStatusOptions));
    api<CatalogOption[]>('/catalogs/categories/customer_type/options?activeOnly=true')
      .then(setCatalogCustomerTypes)
      .catch(() => setCatalogCustomerTypes(fallbackCustomerTypeOptions));
    api<CatalogOption[]>('/catalogs/categories/elevator_type/options?activeOnly=true')
      .then(setCatalogElevatorTypes)
      .catch(() => setCatalogElevatorTypes(fallbackElevatorTypeOptions));
  }, []);

  useEffect(() => {
    api<CustomerMasterRow[]>('/customers')
      .then(setMasterCustomers)
      .catch(() => setMasterCustomers([]));
  }, []);

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
  }, []);

  useEffect(() => {
    const query = locationSearch.trim();
    if (!locationModalOpen || query.length < 2) {
      setLocationSuggestions([]);
      setLocationSuggesting(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLocationSuggesting(true);
      try {
        const params = new URLSearchParams({ q: query });
        const formArea = customerFormRef.current?.getFieldValue?.('area') as string | undefined;
        if (formArea?.trim()) params.set('area', formArea.trim());
        setLocationSuggestions(await api<GeoLocationSuggestion[]>(`/geo/search?${params.toString()}`, {
          signal: controller.signal,
        }));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setLocationSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setLocationSuggesting(false);
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [locationModalOpen, locationSearch]);

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

  const advancedFilterCount = [status, statusGroup, customerType, elevatorType, source, owner, area, createdRange].filter(Boolean).length;

  const openAdvancedFilters = () => {
    setDraftStatus(status);
    setDraftCustomerType(customerType);
    setDraftElevatorType(elevatorType);
    setDraftSource(source);
    setDraftOwner(owner);
    setDraftArea(area);
    setDraftCreatedRange(createdRange);
    setAdvancedOpen(true);
  };

  const resetFilters = async () => {
    setSearch('');
    setStatus(undefined);
    setStatusGroup(undefined);
    setCustomerType(undefined);
    setElevatorType(undefined);
    setSource(undefined);
    setOwner(undefined);
    setArea(undefined);
    setCreatedRange(undefined);
    setDraftStatus(undefined);
    setDraftCustomerType(undefined);
    setDraftElevatorType(undefined);
    setDraftSource(undefined);
    setDraftOwner(undefined);
    setDraftArea(undefined);
    setDraftCreatedRange(undefined);
    await load({
      search: '',
      status: undefined,
      statusGroup: undefined,
      customerType: undefined,
      elevatorType: undefined,
      source: undefined,
      owner: undefined,
      area: undefined,
      createdFrom: undefined,
      createdTo: undefined,
    });
  };

  const applyAdvancedFilters = async () => {
    setStatus(draftStatus);
    setStatusGroup(undefined);
    setCustomerType(draftCustomerType);
    setElevatorType(draftElevatorType);
    setSource(draftSource);
    setOwner(draftOwner);
    setArea(draftArea);
    setCreatedRange(draftCreatedRange);
    setAdvancedOpen(false);
    await load({
      status: draftStatus,
      statusGroup: undefined,
      customerType: draftCustomerType,
      elevatorType: draftElevatorType,
      source: draftSource,
      owner: draftOwner,
      area: draftArea,
      createdFrom: draftCreatedRange?.[0].startOf('day').toISOString(),
      createdTo: draftCreatedRange?.[1].endOf('day').toISOString(),
    });
  };

  const applyKpiFilter = async (group?: string) => {
    const nextGroup = statusGroup === group ? undefined : group;
    setStatus(undefined);
    setStatusGroup(nextGroup);
    await load({ status: undefined, statusGroup: nextGroup });
  };

  const exportCustomers = () => {
    exportCsv(`danh-sach-ho-so-tu-van-${dayjs().format('YYYYMMDD-HHmm')}`, data, [
      { header: 'Mã hồ sơ', value: (item) => item.code },
      { header: 'Khách hàng', value: (item) => item.name },
      { header: 'Số điện thoại', value: (item) => item.phone },
      { header: 'Email', value: (item) => item.email },
      { header: 'Nhóm khách hàng', value: (item) => statusMeta(customerTypeOptions, item.customerType).label },
      { header: 'Loại thang', value: (item) => item.elevatorType ? statusMeta(elevatorTypeOptions, item.elevatorType).label : '' },
      { header: 'Địa chỉ', value: (item) => item.address || item.area },
      { header: 'Nguồn', value: (item) => item.source },
      { header: 'Nhân viên phụ trách', value: (item) => item.owner },
      { header: 'Trạng thái', value: (item) => statusMeta(statusOptions, item.status).label },
      { header: 'Ngày tạo', value: (item) => item.createdAt ? dayjs(item.createdAt).format('DD/MM/YYYY') : '' },
    ]);
  };

  const openCreateDrawer = (existingCustomerId?: string) => {
    setEditingCustomer(undefined);
    setSelectedExistingCustomerId(existingCustomerId);
    setDuplicateConsultationCustomer(undefined);
    setElevatorSpecs([]);
    setActiveElevatorSpecId(undefined);
    setAttachments([]);
    attachmentFileByIdRef.current = {};
    setOpen(true);
  };

  const openEditDrawer = (customer: CustomerRow) => {
    setEditingCustomer(customer);
    setSelectedExistingCustomerId(customer.customerId);
    setDuplicateConsultationCustomer(undefined);
    const specs = parseJsonArray<ElevatorSpec>(customer.technicalSpecsJson);
    setElevatorSpecs(specs);
    setActiveElevatorSpecId(specs[0]?.id);
    setAttachments(parseJsonArray<CustomerAttachment>(customer.attachmentLinksJson));
    attachmentFileByIdRef.current = {};
    setOpen(true);
  };

  useEffect(() => {
    const requestedCustomerId = searchParams.get('customerId');
    if (!requestedCustomerId || open || editingCustomer || !masterCustomers.some((customer) => customer.id === requestedCustomerId)) return;
    openCreateDrawer(requestedCustomerId);
    router.replace('/customers');
  }, [editingCustomer, masterCustomers, open, router, searchParams]);

  const applyExistingCustomer = (customerId?: string) => {
    setSelectedExistingCustomerId(customerId);
    setDuplicateConsultationCustomer(undefined);
    if (!customerId) return;
    const customer = masterCustomers.find((item) => item.id === customerId);
    if (!customer) return;

    customerFormRef.current?.setFieldsValue({
      customerId,
      customerType: customer.customerType,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      area: customer.area,
      address: customer.address,
    });
  };

  const clearSelectedCustomerIfPhoneChanged = (nextPhone: string) => {
    if (!selectedExistingCustomerId) return;
    const selectedCustomer = masterCustomers.find((item) => item.id === selectedExistingCustomerId);
    if (!selectedCustomer || normalizePhone(selectedCustomer.phone) === normalizePhone(nextPhone)) return;
    setSelectedExistingCustomerId(undefined);
    customerFormRef.current?.setFieldValue('customerId', undefined);
  };

  const selectDuplicateCustomerForConsultation = (customer: CustomerMasterRow) => {
    applyExistingCustomer(customer.id);
    customerFormRef.current?.setFields([{ name: 'phone', errors: [] }]);
  };

  const resetSupplementalCustomerData = () => {
    setTechnicalDrawerOpen(false);
    setElevatorSpecs([]);
    setActiveElevatorSpecId(undefined);
    setAttachments([]);
    attachmentFileByIdRef.current = {};
    setAttachmentLinkModalOpen(false);
    setAttachmentLinkDraft('');
  };

  const openTechnicalConfig = () => {
    if (!elevatorSpecs.length) {
      const firstSpec = createElevatorSpec(1);
      setElevatorSpecs([firstSpec]);
      setActiveElevatorSpecId(firstSpec.id);
    } else if (!activeElevatorSpecId || !elevatorSpecs.some((item) => item.id === activeElevatorSpecId)) {
      setActiveElevatorSpecId(elevatorSpecs[0].id);
    }
    setTechnicalDrawerOpen(true);
  };

  const updateElevatorSpec = (id: string, patch: Partial<ElevatorSpec>) => {
    setElevatorSpecs((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addElevatorSpec = () => {
    setElevatorSpecs((items) => {
      const next = createElevatorSpec(items.length + 1);
      setActiveElevatorSpecId(next.id);
      return [...items, next];
    });
  };

  const duplicateElevatorSpec = (id: string) => {
    setElevatorSpecs((items) => {
      const source = items.find((item) => item.id === id);
      if (!source) return items;
      const copy = cloneElevatorSpec(source, items.length + 1);
      setActiveElevatorSpecId(copy.id);
      message.success('Đã nhân bản cấu hình thang.');
      return [...items, copy];
    });
  };

  const removeElevatorSpec = (id: string) => {
    setElevatorSpecs((items) => {
      const next = items.filter((item) => item.id !== id);
      setActiveElevatorSpecId(next[0]?.id);
      if (!next.length) setTechnicalDrawerOpen(false);
      return next;
    });
  };

  const confirmRemoveElevatorSpec = (spec: ElevatorSpec) => {
    if (elevatorSpecs.length <= 1) return;
    setDeleteElevatorSpecCandidate(spec);
  };

  const addElevatorFloor = (specId: string) => {
    setElevatorSpecs((items) => items.map((item) => {
      if (item.id !== specId) return item;
      const nextFloor = item.floorHeights.length + 1;
      return {
        ...item,
        floors: Math.max(item.floors ?? 0, nextFloor),
        floorHeights: [
          ...item.floorHeights,
          { id: createId('floor'), floorName: `Tầng ${nextFloor}`, heightMm: 3600 },
        ],
      };
    }));
  };

  const updateElevatorFloor = (specId: string, floorId: string, patch: Partial<ElevatorFloorHeight>) => {
    setElevatorSpecs((items) => items.map((item) => (
      item.id === specId
        ? {
          ...item,
          floorHeights: item.floorHeights.map((floor) => (floor.id === floorId ? { ...floor, ...patch } : floor)),
        }
        : item
    )));
  };

  const removeElevatorFloor = (specId: string, floorId: string) => {
    setElevatorSpecs((items) => items.map((item) => (
      item.id === specId
        ? { ...item, floorHeights: item.floorHeights.filter((floor) => floor.id !== floorId) }
        : item
    )));
  };

  const addAttachmentFiles = (files: FileList | null, source: 'file' | 'camera') => {
    if (!files?.length) return;
    const nextAttachments = Array.from(files).map<CustomerAttachment>((file) => {
      const id = createId('attachment');
      attachmentFileByIdRef.current[id] = file;
      const isCamera = source === 'camera';
      return {
        id,
        name: file.name,
        type: file.type.startsWith('image/') ? 'IMAGE' : 'DOCUMENT',
        source: isCamera ? 'CAMERA' : 'UPLOAD',
        category: isCamera ? 'Ảnh khảo sát' : 'Khác',
        sizeBytes: file.size,
        capturedAt: isCamera ? new Date().toISOString() : undefined,
        createdAt: new Date().toISOString(),
      };
    });
    setAttachments((items) => [...items, ...nextAttachments]);
    message.success(source === 'camera' ? 'Đã thêm ảnh chụp khảo sát vào hồ sơ.' : `Đã thêm ${nextAttachments.length} tài liệu/ảnh vào hồ sơ.`);
  };

  const stopCameraCapture = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
  };

  const closeCameraCapture = () => {
    stopCameraCapture();
    setCameraModalOpen(false);
    setCameraStarting(false);
    setCameraError('');
  };

  const openCameraCapture = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      message.warning('Trình duyệt không hỗ trợ mở camera trực tiếp, hệ thống sẽ dùng chế độ chụp ảnh mặc định.');
      attachmentCameraInputRef.current?.click();
      return;
    }

    setCameraModalOpen(true);
    setCameraStarting(true);
    try {
      stopCameraCapture();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1600 },
          height: { ideal: 1200 },
        },
      });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play();
      }
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : 'Không mở được camera.');
      message.warning('Không mở được camera trực tiếp, bạn có thể dùng trình chọn ảnh của thiết bị.');
      attachmentCameraInputRef.current?.click();
    } finally {
      setCameraStarting(false);
    }
  };

  const captureSurveyPhoto = async () => {
    const video = cameraVideoRef.current;
    const canvas = cameraCanvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      message.warning('Camera chưa sẵn sàng để chụp ảnh.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!blob) {
      message.error('Không tạo được ảnh từ camera.');
      return;
    }

    const codePrefix = editingCustomer?.code ? `${editingCustomer.code}_` : '';
    const filename = `${codePrefix}anh-khao-sat_${dayjs().format('YYYYMMDD_HHmmss')}.jpg`;
    const file = new File([blob], filename, { type: 'image/jpeg', lastModified: Date.now() });
    const id = createId('attachment');
    const now = new Date().toISOString();
    attachmentFileByIdRef.current[id] = file;
    setAttachments((items) => [
      ...items,
      {
        id,
        name: filename,
        type: 'IMAGE',
        source: 'CAMERA',
        category: 'Ảnh khảo sát',
        sizeBytes: file.size,
        capturedAt: now,
        createdAt: now,
      },
    ]);
    message.success('Đã chụp và thêm ảnh khảo sát vào hồ sơ.');
    closeCameraCapture();
  };

  const addAttachmentLink = () => {
    const url = attachmentLinkDraft.trim();
    if (!url) {
      message.warning('Vui lòng nhập đường dẫn tài liệu.');
      return;
    }

    try {
      new URL(url);
    } catch {
      message.error('Đường dẫn không hợp lệ.');
      return;
    }

    setAttachments((items) => [
      ...items,
      {
        id: createId('attachment'),
        name: url.replace(/^https?:\/\//, ''),
        type: 'LINK',
        source: 'LINK',
        category: 'Nhu cầu khách hàng',
        url,
        createdAt: new Date().toISOString(),
      },
    ]);
    setAttachmentLinkDraft('');
    setAttachmentLinkModalOpen(false);
  };

  const reverseLookupLocation = async (latitude: number, longitude: number) => {
    try {
      const params = new URLSearchParams({
        format: 'jsonv2',
        lat: String(latitude),
        lon: String(longitude),
        zoom: '18',
        addressdetails: '1',
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`);
      if (!response.ok) return undefined;
      const result = await response.json() as { display_name?: string };
      return result.display_name;
    } catch {
      return undefined;
    }
  };

  const openLocationPicker = (specId?: string) => {
    const targetSpec = elevatorSpecs.find((item) => item.id === (specId ?? activeElevatorSpecId));
    if (!targetSpec) {
      message.warning('Vui lòng chọn cấu hình thang trước khi ghim vị trí.');
      return;
    }

    const currentLocation = typeof targetSpec.latitude === 'number' && typeof targetSpec.longitude === 'number'
      ? {
        latitude: targetSpec.latitude,
        longitude: targetSpec.longitude,
        accuracyMeters: targetSpec.locationAccuracyMeters,
        label: targetSpec.locationLabel,
      }
      : undefined;

    setLocationTargetElevatorSpecId(targetSpec.id);
    setDraftLocation(currentLocation);
    setLocationSearch(targetSpec.installationAddress ?? currentLocation?.label ?? '');
    setSharedLocationText('');
    setLastResolvedSharedLocation('');
    setCoordinateEditing(false);
    setCoordinateDraft({
      latitude: currentLocation?.latitude.toFixed(6) ?? '',
      longitude: currentLocation?.longitude.toFixed(6) ?? '',
    });
    setLocationModalOpen(true);
  };

  const pickLocation = async (latitude: number, longitude: number, accuracyMeters?: number) => {
    setCoordinateEditing(false);
    setDraftLocation({ latitude, longitude, accuracyMeters, label: 'Đang xác định địa chỉ...' });
    const label = await reverseLookupLocation(latitude, longitude);
    setDraftLocation({ latitude, longitude, accuracyMeters, label });
  };

  const selectLocationSuggestion = async (suggestion: GeoLocationSuggestion) => {
    setLocationSearch(suggestion.label);
    setLocationSuggestions([]);
    let selected = suggestion;
    if ((selected.latitude === undefined || selected.longitude === undefined) && selected.placeId) {
      setLocationLoading(true);
      try {
        selected = await api<GeoLocationSuggestion>(`/geo/place?placeId=${encodeURIComponent(selected.placeId)}`);
        setLocationSearch(selected.label);
      } catch (error) {
        message.error(error instanceof Error ? error.message : 'Không lấy được tọa độ địa điểm.');
        return;
      } finally {
        setLocationLoading(false);
      }
    }

    if (selected.latitude === undefined || selected.longitude === undefined) {
      message.warning('Địa điểm này chưa có tọa độ để ghim.');
      return;
    }

    setDraftLocation({
      latitude: selected.latitude,
      longitude: selected.longitude,
      accuracyMeters: 100,
      label: selected.label,
    });
    setCoordinateEditing(false);
  };

  const beginCoordinateEdit = () => {
    setCoordinateDraft({
      latitude: draftLocation?.latitude.toFixed(6) ?? '',
      longitude: draftLocation?.longitude.toFixed(6) ?? '',
    });
    setCoordinateEditing(true);
  };

  const applyManualCoordinates = async () => {
    const latitude = Number(coordinateDraft.latitude.trim().replace(',', '.'));
    const longitude = Number(coordinateDraft.longitude.trim().replace(',', '.'));

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      message.error('Vĩ độ phải nằm trong khoảng -90 đến 90.');
      return;
    }

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      message.error('Kinh độ phải nằm trong khoảng -180 đến 180.');
      return;
    }

    const accuracyMeters = draftLocation?.accuracyMeters ?? 100;
    setLocationLoading(true);
    setDraftLocation({ latitude, longitude, accuracyMeters, label: 'Tọa độ nhập tay' });
    try {
      const label = await reverseLookupLocation(latitude, longitude);
      setDraftLocation({ latitude, longitude, accuracyMeters, label: label ?? 'Tọa độ nhập tay' });
      setLocationSearch(label ?? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      setCoordinateEditing(false);
      message.success('Đã cập nhật tọa độ.');
    } catch {
      setCoordinateEditing(false);
      message.warning('Đã cập nhật tọa độ, nhưng chưa lấy được địa chỉ tự động.');
    } finally {
      setLocationLoading(false);
    }
  };

  const applySharedLocation = useCallback(async (options?: { silent?: boolean }) => {
    const text = sharedLocationText.trim();
    if (!text) {
      if (!options?.silent) message.warning('Vui lòng dán link Google Maps hoặc tọa độ.');
      return;
    }

    setLocationLoading(true);
    try {
      const result = await api<GeoLocationSuggestion>('/geo/resolve-link', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      if (result.latitude === undefined || result.longitude === undefined) {
        if (!options?.silent) message.warning('Không đọc được tọa độ từ nội dung đã nhập.');
        return;
      }

      setLocationSearch(result.label);
      setLastResolvedSharedLocation(text);
      setDraftLocation({
        latitude: result.latitude,
        longitude: result.longitude,
        accuracyMeters: 100,
        label: result.label,
      });
      setCoordinateEditing(false);
      if (!options?.silent) message.success('Đã đọc tọa độ và ghim lên bản đồ.');
    } catch (error) {
      if (!options?.silent) {
        message.error(error instanceof Error ? error.message : 'Không đọc được link hoặc tọa độ.');
      }
    } finally {
      setLocationLoading(false);
    }
  }, [sharedLocationText]);

  useEffect(() => {
    const text = sharedLocationText.trim();
    if (!locationModalOpen || text.length < 8 || text === lastResolvedSharedLocation) return;

    const timer = window.setTimeout(() => {
      void applySharedLocation({ silent: true });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [applySharedLocation, lastResolvedSharedLocation, locationModalOpen, sharedLocationText]);

  const searchLocation = async () => {
    if (!locationSearch.trim()) return;
    setLocationLoading(true);
    try {
      const params = new URLSearchParams({ q: locationSearch.trim() });
      const formArea = customerFormRef.current?.getFieldValue?.('area') as string | undefined;
      if (formArea?.trim()) params.set('area', formArea.trim());
      const results = await api<GeoLocationSuggestion[]>(`/geo/search?${params.toString()}`);
      const first = results[0];
      if (!first) {
        message.warning('Không tìm thấy địa điểm phù hợp.');
        return;
      }
      void selectLocationSuggestion(first);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tìm được vị trí.');
    } finally {
      setLocationLoading(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      message.warning('Trình duyệt không hỗ trợ lấy vị trí hiện tại.');
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void pickLocation(
          position.coords.latitude,
          position.coords.longitude,
          Math.round(position.coords.accuracy),
        ).finally(() => setLocationLoading(false));
      },
      () => {
        setLocationLoading(false);
        message.error('Không lấy được vị trí hiện tại. Vui lòng cấp quyền vị trí hoặc ghim trên bản đồ.');
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const updateCustomerStatus = async (customer: CustomerRow, nextStatus: string) => {
    if (customer.status === nextStatus) return;
    setUpdatingStatusId(customer.id);
    try {
      await api(`/consultation-profiles/${customer.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      message.success('Đã cập nhật trạng thái hồ sơ tư vấn');
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không cập nhật được trạng thái.');
    } finally {
      setUpdatingStatusId(undefined);
    }
  };

  const renderEditableStatus = (customer: CustomerRow) => {
    const current = statusMeta(statusOptions, customer.status);
    return (
      <Dropdown
        trigger={['click']}
        menu={{
          selectedKeys: [customer.status],
          items: statusOptions.map((option) => ({
            key: option.code,
            label: (
              <span className='status-menu-item'>
                <Tag color={option.color}>{option.label}</Tag>
                {option.code === customer.status && <CheckOutlined />}
              </span>
            ),
            onClick: () => void updateCustomerStatus(customer, option.code),
          })),
        }}
      >
        <Button
          type='text'
          size='small'
          loading={updatingStatusId === customer.id}
          className='editable-status-button'
        >
          <Tag color={current.color} className='editable-status-pill'>
            <span>{current.label}</span>
            <span className='editable-status-chevron' aria-hidden='true' />
          </Tag>
        </Button>
      </Dropdown>
    );
  };

  const renderCustomerAddress = (customer: CustomerRow) => {
    const displayAddress = customer.address || customer.area;

    return displayAddress ? (
      <Tooltip title={displayAddress}>
        <span className='table-address-cell'>
          <span className='table-cell-inline'>
            <EnvironmentOutlined />
            <span className='table-cell-inline-text table-cell-clamp'>{displayAddress}</span>
          </span>
        </span>
      </Tooltip>
    ) : <Typography.Text type='secondary'>—</Typography.Text>;
  };

  const uploadPendingAttachments = async (consultationProfileId: string, currentAttachments: CustomerAttachment[]) => {
    const pendingAttachments = currentAttachments.filter((attachment) =>
      !attachment.storedFileId && attachmentFileByIdRef.current[attachment.id],
    );
    if (!pendingAttachments.length) return currentAttachments;

    const uploadedAttachments = await Promise.all(pendingAttachments.map(async (attachment) => {
      const file = attachmentFileByIdRef.current[attachment.id];
      const formData = new FormData();
      formData.append('file', file);
      const params = new URLSearchParams({ module: 'consultation-profiles', recordId: consultationProfileId });
      const response = await fetch(`${API_BASE}/files/upload?${params.toString()}`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (response.status === 401) {
        if (typeof window !== 'undefined' && !location.pathname.startsWith('/login')) location.href = '/login';
        throw new Error('Chưa đăng nhập');
      }
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }
      const uploaded = await response.json() as FileUploadResponse;
      delete attachmentFileByIdRef.current[attachment.id];
      return {
        ...attachment,
        storedFileId: uploaded.id,
        name: uploaded.originalName || attachment.name,
        sizeBytes: uploaded.sizeBytes || attachment.sizeBytes,
      };
    }));

    const uploadedById = new Map(uploadedAttachments.map((attachment) => [attachment.id, attachment]));
    return currentAttachments.map((attachment) => uploadedById.get(attachment.id) ?? attachment);
  };

  const columns: ProColumns<CustomerRow>[] = [
    {
      title: 'Mã hồ sơ',
      dataIndex: 'code',
      width: 112,
      fixed: 'left',
      sorter: (a, b) => textSorter.compare(a.code, b.code),
      defaultSortOrder: 'descend',
      render: (value) => <Typography.Text copyable={{ text: String(value) }}>{String(value)}</Typography.Text>,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'name',
      width: 160,
      fixed: 'left',
      sorter: (a, b) => textSorter.compare(a.name, b.name),
      render: (_, item) => (
        <b className='table-primary-text'>{item.name}</b>
      ),
    },
    {
      title: 'Số điện thoại',
      dataIndex: 'phone',
      width: 132,
      render: (value) => <span className='table-phone-text'><PhoneOutlined /> {String(value)}</span>,
    },
    {
      title: 'Nhóm KH',
      key: 'customerType',
      dataIndex: 'customerType',
      width: 110,
      sorter: (a, b) => textSorter.compare(
        statusMeta(customerTypeOptions, a.customerType).label,
        statusMeta(customerTypeOptions, b.customerType).label,
      ),
      render: (_, item) => <CustomerTypeTag value={item.customerType} typeOptions={customerTypeOptions} />,
    },
    {
      title: 'Loại thang',
      key: 'elevatorType',
      dataIndex: 'elevatorType',
      width: 112,
      sorter: (a, b) => textSorter.compare(
        a.elevatorType ? statusMeta(elevatorTypeOptions, a.elevatorType).label : '',
        b.elevatorType ? statusMeta(elevatorTypeOptions, b.elevatorType).label : '',
      ),
      render: (_, item) => <CatalogTag value={item.elevatorType} options={elevatorTypeOptions} />,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      width: 155,
      render: (value) => value ? (
        <Tooltip title={String(value)}>
          <span className='table-cell-ellipsis'>{String(value)}</span>
        </Tooltip>
      ) : <Typography.Text type='secondary'>Chưa có email</Typography.Text>,
    },
    {
      title: 'Địa chỉ',
      dataIndex: 'address',
      width: 175,
      sorter: (a, b) => textSorter.compare(a.address || a.area || '', b.address || b.area || ''),
      render: (_, item) => renderCustomerAddress(item),
    },
    { title: 'Nguồn', dataIndex: 'source', width: 100, sorter: (a, b) => textSorter.compare(a.source, b.source) },
    { title: 'Nhân viên phụ trách', dataIndex: 'owner', width: 128, sorter: (a, b) => textSorter.compare(a.owner, b.owner) },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 150,
      sorter: (a, b) => textSorter.compare(
        statusMeta(statusOptions, a.status).label,
        statusMeta(statusOptions, b.status).label,
      ),
      render: (_, item) => renderEditableStatus(item),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      width: 124,
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
      render: (value) => value ? dayjs(String(value)).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Thao tác',
      valueType: 'option',
      width: 96,
      align: 'right',
      fixed: 'right',
      render: (_, item) => [
        <Space key='actions' size={2} className='table-actions'>
          <Tooltip title='Sửa thông tin'>
            <Button type='text' className='table-action-button' icon={<EditOutlined />} onClick={() => openEditDrawer(item)} />
          </Tooltip>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'care',
                  icon: <CalendarOutlined />,
                  label: 'Ghi chăm sóc',
                  onClick: () => router.push(`/care?customerId=${item.customerId ?? item.id}`),
                },
                {
                  key: 'quotation',
                  icon: <FileTextOutlined />,
                  label: 'Tạo báo giá',
                  onClick: () => router.push(`/quotations?consultationProfileId=${item.id}`),
                },
                {
                  key: 'contract',
                  icon: <FileProtectOutlined />,
                  label: 'Tạo hợp đồng',
                  onClick: () => router.push(`/contracts?customerId=${item.customerId ?? item.id}`),
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
                  label: 'Hủy hồ sơ tư vấn',
                  danger: true,
                  disabled: true,
                },
              ],
            }}
          >
            <Tooltip title='Thao tác khác'>
              <Button type='text' className='table-action-button' icon={<EllipsisOutlined />} />
            </Tooltip>
          </Dropdown>
        </Space>,
      ],
    },
  ];

  const save = async (values: CustomerForm) => {
    const buildPayload = (currentAttachments: CustomerAttachment[]) => ({
      ...values,
      latitude: null,
      longitude: null,
      locationAccuracyMeters: null,
      locationLabel: null,
      technicalSpecsJson: elevatorSpecs.length ? JSON.stringify(elevatorSpecs) : null,
      attachmentLinksJson: currentAttachments.length ? JSON.stringify(currentAttachments) : null,
    });

    const duplicateCustomer = !editingCustomer
      ? masterCustomers.find((customer) => normalizePhone(customer.phone) === normalizePhone(values.phone))
      : undefined;
    const selectedCustomerId = values.customerId ?? selectedExistingCustomerId;

    if (duplicateCustomer && duplicateCustomer.id !== selectedCustomerId) {
      setDuplicateConsultationCustomer(duplicateCustomer);
      customerFormRef.current?.setFields([
        {
          name: 'phone',
          errors: [`Số điện thoại đã tồn tại ở khách hàng ${duplicateCustomer.code} - ${duplicateCustomer.name}.`],
        },
      ]);
      message.error(`Không thể tạo khách hàng mới vì SĐT đã thuộc ${duplicateCustomer.code} - ${duplicateCustomer.name}.`);
      return false;
    }

    try {
      let savedCustomerId = editingCustomer?.id;
      if (editingCustomer) {
        await api(`/consultation-profiles/${editingCustomer.id}`, { method: 'PUT', body: JSON.stringify(buildPayload(attachments)) });
      } else {
        const created = await api<CustomerSaveResponse>('/consultation-profiles', { method: 'POST', body: JSON.stringify(buildPayload(attachments)) });
        savedCustomerId = created.id;
      }

      if (savedCustomerId) {
        const uploadedAttachments = await uploadPendingAttachments(savedCustomerId, attachments);
        if (uploadedAttachments !== attachments) {
          await api(`/consultation-profiles/${savedCustomerId}`, { method: 'PUT', body: JSON.stringify(buildPayload(uploadedAttachments)) });
          setAttachments(uploadedAttachments);
        }
      }

      message.success(editingCustomer ? 'Đã cập nhật hồ sơ tư vấn' : 'Đã tạo hồ sơ tư vấn');
      setOpen(false);
      setEditingCustomer(undefined);
      resetSupplementalCustomerData();
      await load();
      api<CustomerMasterRow[]>('/customers').then(setMasterCustomers).catch(() => undefined);
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Số điện thoại')) {
        let matchedCustomer = masterCustomers.find((customer) => normalizePhone(customer.phone) === normalizePhone(values.phone));
        if (!matchedCustomer) {
          try {
            const refreshedCustomers = await api<CustomerMasterRow[]>('/customers');
            setMasterCustomers(refreshedCustomers);
            matchedCustomer = refreshedCustomers.find((customer) => normalizePhone(customer.phone) === normalizePhone(values.phone));
          } catch {
            // The original API error remains the fallback when the customer list cannot be refreshed.
          }
        }
        if (matchedCustomer && matchedCustomer.id !== selectedCustomerId) {
          setDuplicateConsultationCustomer(matchedCustomer);
          customerFormRef.current?.setFields([
            {
              name: 'phone',
              errors: [`Số điện thoại đã tồn tại ở khách hàng ${matchedCustomer.code} - ${matchedCustomer.name}.`],
            },
          ]);
        }
      }
      message.error(error instanceof Error ? error.message : 'Không lưu được hồ sơ tư vấn.');
      return false;
    }
  };

  return (
    <PageContainer
        className='erp-page-container'
        header={{
          title: (
            <div className='page-title-stack'>
              <Typography.Title level={3}>Hồ sơ tư vấn thang máy</Typography.Title>
              <Typography.Text>Quản lý nhu cầu thang máy, kỹ thuật sơ khai, báo giá và người phụ trách</Typography.Text>
            </div>
          ),
          extra: (
            <Button type='primary' icon={<PlusOutlined />} onClick={() => openCreateDrawer()}>
              Thêm hồ sơ tư vấn
            </Button>
          ),
          breadcrumb: {},
        }}
      >
        <Row gutter={[16, 16]} className='erp-kpi-row'>
          {[
            { label: 'Tổng hồ sơ tư vấn', value: summary.total, icon: <TeamOutlined />, tone: 'blue' },
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
          <div className='customer-search-row'>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              prefix={<SearchOutlined />}
              placeholder='Tìm mã hồ sơ, tên, SĐT hoặc email...'
              allowClear
              className='customer-search-input'
            />
            <Badge count={advancedFilterCount} size='small' offset={[-4, 4]}>
              <Button icon={<SlidersOutlined />} onClick={openAdvancedFilters}>
                Lọc nâng cao
              </Button>
            </Badge>
            <Button icon={<ReloadOutlined />} onClick={() => void resetFilters()}>
              Đặt lại
            </Button>
            <Typography.Text className='filter-result-count'>{data.length} hồ sơ</Typography.Text>
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
              <Button icon={<ReloadOutlined />} onClick={() => {
                setDraftStatus(undefined);
                setDraftCustomerType(undefined);
                setDraftElevatorType(undefined);
                setDraftSource(undefined);
                setDraftOwner(undefined);
                setDraftArea(undefined);
                setDraftCreatedRange(undefined);
              }}>
                Đặt lại
              </Button>
              <Space>
                <Button onClick={() => setAdvancedOpen(false)}>Hủy</Button>
                <Button type='primary' icon={<FilterOutlined />} onClick={() => void applyAdvancedFilters()}>
                  Áp dụng
                </Button>
              </Space>
            </div>
          )}
        >
          <Typography.Text className='advanced-filter-description'>
            Áp dụng nhiều điều kiện cùng lúc cho danh sách hồ sơ tư vấn hiện tại.
          </Typography.Text>
          <div className='advanced-filter-section'>
            <div className='advanced-filter-section-title'>Phân loại</div>
            <label className='advanced-filter-field'>
              <span>Trạng thái</span>
              <Select
                value={draftStatus}
                onChange={setDraftStatus}
                allowClear
                placeholder='Tất cả'
                options={statusOptions.map((item) => ({ value: item.code, label: item.label }))}
              />
            </label>
            <label className='advanced-filter-field'>
              <span>Nhóm khách hàng</span>
              <Select
                value={draftCustomerType}
                onChange={setDraftCustomerType}
                allowClear
                placeholder='Tất cả'
                options={customerTypeOptions.map((item) => ({ value: item.code, label: item.label }))}
              />
            </label>
            <label className='advanced-filter-field'>
              <span>Loại thang máy</span>
              <Select
                value={draftElevatorType}
                onChange={setDraftElevatorType}
                allowClear
                placeholder='Tất cả'
                options={elevatorTypeOptions.map((item) => ({ value: item.code, label: item.label }))}
              />
            </label>
            <label className='advanced-filter-field'>
              <span>Nguồn khách hàng</span>
              <Select
                value={draftSource}
                onChange={setDraftSource}
                allowClear
                placeholder='Tất cả'
                options={sourceOptions.map((item) => ({ value: item, label: item }))}
              />
            </label>
          </div>
          <div className='advanced-filter-section'>
            <div className='advanced-filter-section-title'>Phụ trách</div>
            <label className='advanced-filter-field'>
              <span>Người phụ trách</span>
              <Select
                value={draftOwner}
                onChange={setDraftOwner}
                allowClear
                showSearch
                optionFilterProp='label'
                placeholder='Chọn người phụ trách'
                options={ownerOptions}
              />
            </label>
          </div>
          <div className='advanced-filter-section'>
            <div className='advanced-filter-section-title'>Vị trí</div>
            <label className='advanced-filter-field'>
              <span>Khu vực</span>
              <Select
                value={draftArea}
                onChange={setDraftArea}
                allowClear
                showSearch
                optionFilterProp='label'
                placeholder='Chọn khu vực'
                options={areaOptions}
              />
            </label>
          </div>
          <div className='advanced-filter-section'>
            <div className='advanced-filter-section-title'>Thời gian</div>
            <label className='advanced-filter-field'>
              <span>Ngày tạo</span>
              <DatePicker.RangePicker
                value={draftCreatedRange}
                onChange={(value) => setDraftCreatedRange(value?.[0] && value[1] ? [value[0], value[1]] : undefined)}
                format='DD/MM/YYYY'
                placeholder={['Từ ngày', 'Đến ngày']}
              />
            </label>
          </div>
          {statusGroup && (
            <div className='advanced-filter-note'>
              Đang áp dụng bộ lọc nhanh từ KPI. Chọn trạng thái cụ thể rồi bấm Áp dụng sẽ thay thế bộ lọc nhanh này.
            </div>
          )}
        </Drawer>

        <div className='desktop-table section-gap'>
          <ProTable<CustomerRow>
            rowKey='id'
            loading={loading}
            dataSource={data}
            columns={columns}
            search={false}
            cardBordered
            options={{ density: true, fullScreen: true, reload: () => void load() }}
            columnsState={{
              defaultValue: {
                customerType: { show: false },
                elevatorType: { show: false },
              },
            }}
            pagination={{
              current: customerTablePage.current,
              pageSize: customerTablePage.pageSize,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              showTotal: (total) => `${total} hồ sơ`,
              onChange: (current, pageSize) => setCustomerTablePage({ current, pageSize }),
              onShowSizeChange: (_, pageSize) => setCustomerTablePage({ current: 1, pageSize }),
            }}
            scroll={{ x: 1510 }}
            headerTitle='Danh sách hồ sơ tư vấn'
          />
        </div>

        <div className='mobile-card-list section-gap'>
          <List
            loading={loading}
            dataSource={data}
            locale={{ emptyText: 'Chưa có hồ sơ tư vấn' }}
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
                    <Descriptions.Item label='Địa chỉ'>{customer.address || customer.area || '—'}</Descriptions.Item>
                    <Descriptions.Item label='Nhóm khách hàng'>
                      <CustomerTypeTag value={customer.customerType} typeOptions={customerTypeOptions} />
                    </Descriptions.Item>
                    <Descriptions.Item label='Loại thang'>
                      <CatalogTag value={customer.elevatorType} options={elevatorTypeOptions} />
                    </Descriptions.Item>
                    <Descriptions.Item label='Email'>{customer.email || 'Chưa có email'}</Descriptions.Item>
                    <Descriptions.Item label='Nguồn'>{customer.source}</Descriptions.Item>
                    <Descriptions.Item label='Phụ trách'>{customer.owner}</Descriptions.Item>
                  </Descriptions>
                  <Button block icon={<EditOutlined />} onClick={() => openEditDrawer(customer)}>
                    Sửa thông tin
                  </Button>
                </Card>
              </List.Item>
            )}
          />
        </div>

        <DrawerForm<CustomerForm>
          key={editingCustomer?.id ?? 'consultation-form'}
          formRef={customerFormRef}
          title={editingCustomer ? 'Sửa hồ sơ tư vấn' : 'Thêm hồ sơ tư vấn'}
          open={open}
          onOpenChange={(visible) => {
            setOpen(visible);
            if (!visible) {
              closeCameraCapture();
              setDeleteElevatorSpecCandidate(undefined);
              setEditingCustomer(undefined);
              setSelectedExistingCustomerId(undefined);
              setDuplicateConsultationCustomer(undefined);
              resetSupplementalCustomerData();
            }
          }}
          width='min(1120px, calc(100vw - 40px))'
          initialValues={editingCustomer ? {
            customerId: editingCustomer.customerId,
            customerType: editingCustomer.customerType,
            name: editingCustomer.name,
            phone: editingCustomer.phone,
            email: editingCustomer.email,
            area: editingCustomer.area,
            elevatorType: editingCustomer.elevatorType,
            source: editingCustomer.source,
            address: editingCustomer.address,
            notes: editingCustomer.notes,
            status: editingCustomer.status,
          } : selectedExistingCustomer ? {
            customerId: selectedExistingCustomer.id,
            customerType: selectedExistingCustomer.customerType,
            name: selectedExistingCustomer.name,
            phone: selectedExistingCustomer.phone,
            email: selectedExistingCustomer.email,
            area: selectedExistingCustomer.area,
            address: selectedExistingCustomer.address,
            source: selectedExistingCustomer.source || 'Marketing',
            status: 'NEW',
          } : { customerType: 'PERSONAL', source: 'Marketing', status: 'NEW' }}
          onFinish={save}
          drawerProps={{ destroyOnClose: true, className: 'customer-form-drawer', rootClassName: 'customer-form-drawer-root' }}
          submitter={{ searchConfig: { submitText: editingCustomer ? 'Lưu thay đổi' : 'Lưu hồ sơ', resetText: 'Hủy' } }}
        >
          <div className='customer-form-layout'>
            <div className='customer-form-main'>
              <div className='form-section-heading'>Thông tin khách hàng</div>
              {!editingCustomer && (
                <>
                  <ProFormSelect
                    name='customerId'
                    label='Tìm/chọn khách hàng đã có'
                    placeholder='Nhập tên, mã KH hoặc số điện thoại để tìm khách cũ'
                    showSearch
                    allowClear
                    options={masterCustomerOptions}
                    fieldProps={{
                      optionFilterProp: 'label',
                      onChange: (value) => applyExistingCustomer(value as string | undefined),
                    }}
                  />
                  {duplicateConsultationCustomer && (
                    <Alert
                      className='customer-duplicate-alert consultation-duplicate-alert'
                      type='error'
                      showIcon
                      message={(
                        <span>
                          <b>Số điện thoại đã tồn tại.</b> Thuộc khách hàng <b>{duplicateConsultationCustomer.code} - {duplicateConsultationCustomer.name}</b>.
                          <Button
                            type='link'
                            size='small'
                            onClick={() => selectDuplicateCustomerForConsultation(duplicateConsultationCustomer)}
                          >
                            Chọn khách hàng này
                          </Button>
                        </span>
                      )}
                    />
                  )}
                </>
              )}
              <ProFormRadio.Group
                name='customerType'
                label='Nhóm khách hàng'
                formItemProps={{ className: 'customer-type-field' }}
                options={customerTypeOptions.map((item) => ({ value: item.code, label: item.label }))}
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
                  fieldProps={{
                    onChange: (event) => {
                      clearSelectedCustomerIfPhoneChanged(event.target.value);
                      if (duplicateConsultationCustomer) setDuplicateConsultationCustomer(undefined);
                    },
                  }}
                  rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
                />
              </ProForm.Group>
              <ProForm.Group>
                <ProFormText name='email' label='Email' width='md' rules={[{ type: 'email' }]} />
                <ProFormText name='area' label='Khu vực' width='md' placeholder='Tỉnh/thành, quận/huyện' />
              </ProForm.Group>

              <div className='form-section-heading'>Nhu cầu và nguồn khách</div>
              <ProForm.Group>
                <ProFormSelect
                  name='source'
                  label='Nguồn khách hàng'
                  width='md'
                  options={sourceOptions.map((value) => ({ value, label: value }))}
                />
                <ProFormSelect
                  name='elevatorType'
                  label='Loại thang máy'
                  width='md'
                  placeholder='Chọn loại thang'
                  options={elevatorTypeOptions.map((item) => ({ value: item.code, label: item.label }))}
                  rules={[{ required: true, message: 'Vui lòng chọn loại thang máy' }]}
                />
              </ProForm.Group>
              <ProFormTextArea
                name='address'
                label='Địa chỉ liên hệ'
                placeholder='Nhập địa chỉ liên hệ của khách hàng'
                fieldProps={{ rows: 2 }}
              />
              <ProFormTextArea
                name='notes'
                label='Yêu cầu / Ghi chú ban đầu'
                placeholder='Loại thang, số tầng, tải trọng, thời gian dự kiến...'
                fieldProps={{ rows: 2 }}
              />
            </div>

            <aside className='customer-form-aside'>
              <div className='customer-aside-title'>Hồ sơ khảo sát</div>
              <div className='customer-supplement-section'>
            <div className='customer-supplement-heading'>
              <span>
                <SlidersOutlined />
                Cấu hình thông số kỹ thuật thang máy
                <Badge count={elevatorSpecs.length} showZero size='small' className='section-count-badge' />
              </span>
              <Typography.Text type='secondary'>Hỗ trợ một khách hàng nhiều cấu hình thang</Typography.Text>
            </div>
            {elevatorSpecs.length ? (
              <div className='elevator-spec-summary-list'>
                {elevatorSpecs.map((spec) => (
                  <div key={spec.id} className='elevator-spec-summary-item'>
                    <div>
                      <Typography.Text strong>{spec.name}</Typography.Text>
                      <Typography.Text type='secondary'>
                        {spec.floors ? `${spec.floors} tầng` : 'Chưa nhập số tầng'}
                        {spec.capacityKg ? ` · ${spec.capacityKg} kg` : ''}
                        {spec.elevatorType ? ` · ${statusMeta(elevatorTypeOptions, spec.elevatorType).label}` : ''}
                      </Typography.Text>
                    </div>
                    <Space size={6}>
                      <Tooltip title='Nhân bản cấu hình này'>
                        <Button aria-label='Nhân bản cấu hình thang' icon={<CopyOutlined />} onClick={() => duplicateElevatorSpec(spec.id)} />
                      </Tooltip>
                      <Tooltip title='Sửa cấu hình'>
                        <Button
                          aria-label='Sửa cấu hình thang'
                          icon={<EditOutlined />}
                          onClick={() => {
                            setActiveElevatorSpecId(spec.id);
                            setTechnicalDrawerOpen(true);
                          }}
                        />
                      </Tooltip>
                    </Space>
                  </div>
                ))}
              </div>
            ) : (
              <div className='customer-empty-panel'>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description='Chưa có cấu hình thông số kỹ thuật thang máy.'
                />
                <Button icon={<PlusOutlined />} onClick={openTechnicalConfig}>
                  Tạo cấu hình kỹ thuật
                </Button>
              </div>
            )}
            {elevatorSpecs.length > 0 && (
              <div className='customer-supplement-footer'>
                <Button icon={<PlusOutlined />} onClick={addElevatorSpec}>
                  Thêm thang
                </Button>
                <Button type='primary' icon={<SlidersOutlined />} onClick={openTechnicalConfig}>
                  Mở cấu hình chi tiết
                </Button>
              </div>
            )}
          </div>

          <div className='customer-supplement-section'>
            <div className='customer-supplement-heading'>
              <span>
                <PaperClipOutlined />
                Tài liệu / Ảnh khảo sát
                <Badge count={attachments.length} showZero size='small' className='section-count-badge' />
              </span>
              <Space size={8} wrap>
                <Button icon={<LinkOutlined />} onClick={() => setAttachmentLinkModalOpen(true)}>
                  Link
                </Button>
                <Button icon={<CameraOutlined />} onClick={() => void openCameraCapture()}>
                  Chụp ảnh
                </Button>
                <Button icon={<PaperClipOutlined />} onClick={() => attachmentFileInputRef.current?.click()}>
                  Tệp
                </Button>
              </Space>
            </div>
            <input
              ref={attachmentFileInputRef}
              className='customer-file-input'
              type='file'
              multiple
              hidden
              accept='image/*,.pdf,.doc,.docx,.xls,.xlsx'
              onChange={(event) => {
                addAttachmentFiles(event.target.files, 'file');
                event.target.value = '';
              }}
            />
            <input
              ref={attachmentCameraInputRef}
              className='customer-file-input'
              type='file'
              hidden
              accept='image/*'
              capture='environment'
              onChange={(event) => {
                addAttachmentFiles(event.target.files, 'camera');
                closeCameraCapture();
                event.target.value = '';
              }}
            />
            {attachments.length ? (
              <div className='attachment-list'>
                {attachments.map((attachment) => (
                  <div key={attachment.id} className='attachment-item'>
                    <span className='attachment-type-icon'>
                      {attachment.type === 'IMAGE' ? <FileImageOutlined /> : attachment.type === 'LINK' ? <LinkOutlined /> : <FilePdfOutlined />}
                    </span>
                    <div className='attachment-copy'>
                      {attachment.url || attachment.storedFileId ? (
                        <a href={attachment.url ?? `${API_BASE}/files/${attachment.storedFileId}`} target='_blank' rel='noreferrer'>{attachment.name}</a>
                      ) : (
                        <Typography.Text strong>{attachment.name}</Typography.Text>
                      )}
                      <Typography.Text type='secondary'>
                        {attachment.source === 'CAMERA' ? 'Ảnh chụp hiện trường' : attachment.type === 'IMAGE' ? 'Ảnh tải lên' : attachment.type === 'LINK' ? 'Link' : 'Tài liệu'}
                        {attachment.sizeBytes ? ` · ${formatFileSize(attachment.sizeBytes)}` : ''}
                      </Typography.Text>
                    </div>
                    <Select
                      className='attachment-category-select'
                      value={attachment.category}
                      options={attachmentCategoryOptions.map((value) => ({ value, label: value }))}
                      onChange={(category) => setAttachments((items) => items.map((item) => (
                        item.id === attachment.id ? { ...item, category } : item
                      )))}
                    />
                    <Tooltip title='Xóa tài liệu'>
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => {
                          delete attachmentFileByIdRef.current[attachment.id];
                          setAttachments((items) => items.filter((item) => item.id !== attachment.id));
                        }}
                      />
                    </Tooltip>
                  </div>
                ))}
              </div>
            ) : (
              <div className='customer-empty-panel compact'>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description='Chưa có tài liệu hoặc hình ảnh khảo sát.'
                />
              </div>
            )}
          </div>
            </aside>
          </div>
          <ProFormText name='status' hidden />
        </DrawerForm>
        <Drawer
          title={(
            <span className='technical-drawer-title'>
              <SlidersOutlined />
              Cấu hình kỹ thuật thang máy
            </span>
          )}
          open={technicalDrawerOpen}
          onClose={() => setTechnicalDrawerOpen(false)}
          width='min(1040px, calc(100vw - 64px))'
          getContainer={() => document.body}
          zIndex={1300}
          className='technical-config-drawer'
          footer={activeElevatorSpec ? (
            <div className='technical-drawer-footer'>
              <span />
              <Space>
                <Button onClick={() => setTechnicalDrawerOpen(false)}>Đóng</Button>
                <Button type='primary' onClick={() => setTechnicalDrawerOpen(false)}>Lưu cấu hình</Button>
              </Space>
            </div>
          ) : null}
        >
          {activeElevatorSpec ? (
            <>
              <div className='technical-tab-row'>
                <div className='technical-tab-list'>
                  {elevatorSpecs.map((spec) => (
                    <button
                      key={spec.id}
                      type='button'
                      title={formatElevatorSpecLabel(spec)}
                      className={`technical-tab-button ${spec.id === activeElevatorSpec.id ? 'active' : ''}`}
                      onClick={() => setActiveElevatorSpecId(spec.id)}
                    >
                      <span>{formatElevatorSpecLabel(spec)}</span>
                    </button>
                  ))}
                  <Button className='technical-add-tab' icon={<PlusOutlined />} onClick={addElevatorSpec}>
                    Thêm thang
                  </Button>
                </div>
                <div className='technical-mobile-toolbar'>
                  <Select
                    className='technical-mobile-spec-select'
                    value={activeElevatorSpec.id}
                    onChange={setActiveElevatorSpecId}
                    options={elevatorSpecs.map((spec) => ({
                      value: spec.id,
                      label: formatElevatorSpecLabel(spec),
                    }))}
                  />
                  <Tooltip title='Thêm thang'>
                    <Button aria-label='Thêm thang' icon={<PlusOutlined />} onClick={addElevatorSpec} />
                  </Tooltip>
                </div>
                <Dropdown
                  trigger={['click']}
                  overlayClassName='technical-action-dropdown'
                  overlayStyle={{ zIndex: 1700 }}
                  getPopupContainer={() => document.body}
                  menu={{
                    onClick: ({ key }) => {
                      if (key === 'duplicate') duplicateElevatorSpec(activeElevatorSpec.id);
                      if (key === 'delete') confirmRemoveElevatorSpec(activeElevatorSpec);
                    },
                    items: [
                      {
                        key: 'duplicate',
                        icon: <CopyOutlined />,
                        label: 'Nhân bản thang này',
                      },
                      {
                        key: 'delete',
                        icon: <DeleteOutlined />,
                        label: elevatorSpecs.length <= 1 ? 'Cần giữ ít nhất một thang' : 'Xóa thang này',
                        danger: elevatorSpecs.length > 1,
                        disabled: elevatorSpecs.length <= 1,
                      },
                    ],
                  }}
                >
                  <Button
                    className='technical-more-action'
                    aria-label='Mở thao tác thang'
                    title='Thao tác với thang đang chọn'
                    icon={<EllipsisOutlined />}
                  />
                </Dropdown>
              </div>
              <div className='technical-config-body'>
                <div className='technical-grid five-columns'>
                  <label>
                    <span>Tên cấu hình thang máy *</span>
                    <Input
                      value={activeElevatorSpec.name}
                      onChange={(event) => updateElevatorSpec(activeElevatorSpec.id, { name: event.target.value })}
                      placeholder='Thang máy 1'
                    />
                  </label>
                  <label>
                    <span>Số tầng</span>
                    <InputNumber
                      min={1}
                      value={activeElevatorSpec.floors}
                      onChange={(value) => updateElevatorSpec(activeElevatorSpec.id, { floors: value ?? undefined })}
                      placeholder='Ví dụ: 5'
                    />
                  </label>
                  <label>
                    <span>Tải trọng (kg)</span>
                    <InputNumber
                      min={100}
                      step={50}
                      value={activeElevatorSpec.capacityKg}
                      onChange={(value) => updateElevatorSpec(activeElevatorSpec.id, { capacityKg: value ?? undefined })}
                      placeholder='Ví dụ: 450'
                    />
                  </label>
                  <label>
                    <span>Loại thang quan tâm</span>
                    <Select
                      allowClear
                      value={activeElevatorSpec.elevatorType}
                      placeholder='Chưa chọn'
                      options={elevatorTypeOptions.map((item) => ({ value: item.code, label: item.label }))}
                      onChange={(value) => updateElevatorSpec(activeElevatorSpec.id, { elevatorType: value })}
                    />
                  </label>
                  <label>
                    <span>Vị trí đối trọng</span>
                    <Select
                      allowClear
                      value={activeElevatorSpec.counterweightPosition}
                      options={counterweightOptions}
                      onChange={(value) => updateElevatorSpec(activeElevatorSpec.id, { counterweightPosition: value })}
                    />
                  </label>
                </div>

                <div className='technical-section-title'>Thông tin hố thang</div>
                <div className='technical-grid five-columns'>
                  <label>
                    <span>Rộng thông thủy (mm)</span>
                    <InputNumber value={activeElevatorSpec.shaftWidthMm} onChange={(value) => updateElevatorSpec(activeElevatorSpec.id, { shaftWidthMm: value ?? undefined })} placeholder='Ví dụ: 1500' />
                  </label>
                  <label>
                    <span>Sâu thông thủy (mm)</span>
                    <InputNumber value={activeElevatorSpec.shaftDepthMm} onChange={(value) => updateElevatorSpec(activeElevatorSpec.id, { shaftDepthMm: value ?? undefined })} placeholder='Ví dụ: 1500' />
                  </label>
                  <label>
                    <span>Hố pit (mm)</span>
                    <InputNumber value={activeElevatorSpec.pitDepthMm} onChange={(value) => updateElevatorSpec(activeElevatorSpec.id, { pitDepthMm: value ?? undefined })} placeholder='Ví dụ: 1400' />
                  </label>
                  <label>
                    <span>Chiều cao phòng máy (mm)</span>
                    <InputNumber value={activeElevatorSpec.machineRoomHeightMm} onChange={(value) => updateElevatorSpec(activeElevatorSpec.id, { machineRoomHeightMm: value ?? undefined })} placeholder='Ví dụ: 1200' />
                  </label>
                  <label>
                    <span>Chiều cao OH (mm)</span>
                    <InputNumber value={activeElevatorSpec.overheadHeightMm} onChange={(value) => updateElevatorSpec(activeElevatorSpec.id, { overheadHeightMm: value ?? undefined })} placeholder='Ví dụ: 4200' />
                  </label>
                </div>

                <div className='technical-table-heading'>
                  <span>Chiều cao từng tầng thực tế</span>
                  <Button icon={<PlusOutlined />} onClick={() => addElevatorFloor(activeElevatorSpec.id)}>
                    Thêm tầng
                  </Button>
                </div>
                <div className='floor-height-table'>
                  <div className='floor-height-row head'>
                    <span>Tên tầng</span>
                    <span>Chiều cao (mm)</span>
                    <span>Xóa</span>
                  </div>
                  {activeElevatorSpec.floorHeights.map((floor) => (
                    <div key={floor.id} className='floor-height-row'>
                      <Input
                        value={floor.floorName}
                        onChange={(event) => updateElevatorFloor(activeElevatorSpec.id, floor.id, { floorName: event.target.value })}
                      />
                      <InputNumber
                        min={0}
                        value={floor.heightMm}
                        onChange={(value) => updateElevatorFloor(activeElevatorSpec.id, floor.id, { heightMm: value ?? undefined })}
                      />
                      <Tooltip title='Xóa tầng'>
                        <Button
                          type='text'
                          className='floor-delete-button'
                          icon={<DeleteOutlined />}
                          onClick={() => removeElevatorFloor(activeElevatorSpec.id, floor.id)}
                        />
                      </Tooltip>
                    </div>
                  ))}
                </div>

                <div className='technical-section-title'>Vị trí lắp đặt</div>
                <div className='technical-install-location'>
                  <label className='technical-note-field'>
                    <span>Địa chỉ công trình / vị trí đặt thang</span>
                    <Input.TextArea
                      rows={2}
                      value={activeElevatorSpec.installationAddress}
                      placeholder='Nhập địa chỉ nơi lắp đặt thang máy'
                      onChange={(event) => updateElevatorSpec(activeElevatorSpec.id, { installationAddress: event.target.value })}
                    />
                  </label>
                  <div className='technical-location-panel'>
                    <div>
                      <Typography.Text strong>Vị trí ghim triển khai</Typography.Text>
                      <Typography.Text type='secondary'>
                        Ghim tọa độ riêng cho thang này để kỹ thuật mở bản đồ khi khảo sát/lắp đặt.
                      </Typography.Text>
                    </div>
                    <Space wrap>
                      <Button
                        onClick={() => {
                          const contactAddress = customerFormRef.current?.getFieldValue('address')?.trim();
                          if (!contactAddress) {
                            message.warning('Chưa có địa chỉ liên hệ để sao chép.');
                            return;
                          }
                          updateElevatorSpec(activeElevatorSpec.id, { installationAddress: contactAddress });
                        }}
                      >
                        Dùng địa chỉ liên hệ
                      </Button>
                      <Button icon={<PushpinOutlined />} onClick={() => openLocationPicker(activeElevatorSpec.id)}>
                        {typeof activeElevatorSpec.latitude === 'number' && typeof activeElevatorSpec.longitude === 'number'
                          ? 'Sửa vị trí ghim'
                          : 'Ghim vị trí'}
                      </Button>
                      {typeof activeElevatorSpec.latitude === 'number' && typeof activeElevatorSpec.longitude === 'number' && (
                        <Button
                          icon={<DeleteOutlined />}
                          onClick={() => updateElevatorSpec(activeElevatorSpec.id, {
                            latitude: undefined,
                            longitude: undefined,
                            locationAccuracyMeters: undefined,
                            locationLabel: undefined,
                          })}
                        >
                          Xóa ghim
                        </Button>
                      )}
                    </Space>
                    {typeof activeElevatorSpec.latitude === 'number' && typeof activeElevatorSpec.longitude === 'number' && (
                      <div className='location-pin-summary'>
                        <EnvironmentOutlined />
                        <span>
                          {activeElevatorSpec.locationLabel || 'Đã ghim vị trí'} · {activeElevatorSpec.latitude.toFixed(6)}, {activeElevatorSpec.longitude.toFixed(6)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <label className='technical-note-field'>
                  <span>Ghi chú kỹ thuật</span>
                  <Input.TextArea
                    rows={3}
                    value={activeElevatorSpec.technicalNotes}
                    placeholder='Điểm cần lưu ý khi khảo sát, giới hạn mặt bằng, phương án đề xuất...'
                    onChange={(event) => updateElevatorSpec(activeElevatorSpec.id, { technicalNotes: event.target.value })}
                  />
                </label>
              </div>
            </>
          ) : (
            <div className='customer-empty-panel'>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description='Chưa có cấu hình kỹ thuật.' />
              <Button type='primary' icon={<PlusOutlined />} onClick={addElevatorSpec}>
                Tạo cấu hình đầu tiên
              </Button>
            </div>
          )}
        </Drawer>
        <Modal
          title='Xóa cấu hình thang?'
          open={Boolean(deleteElevatorSpecCandidate)}
          onCancel={() => setDeleteElevatorSpecCandidate(undefined)}
          okText='Xóa thang'
          cancelText='Hủy'
          okButtonProps={{ danger: true }}
          zIndex={1700}
          destroyOnHidden
          onOk={() => {
            if (!deleteElevatorSpecCandidate) return;
            removeElevatorSpec(deleteElevatorSpecCandidate.id);
            setDeleteElevatorSpecCandidate(undefined);
          }}
        >
          {deleteElevatorSpecCandidate?.name || 'Thang máy'} sẽ bị xóa khỏi hồ sơ khảo sát. Thay đổi được ghi khi bấm Lưu cấu hình.
        </Modal>
        <Modal
          title={(
            <span className='camera-capture-title'>
              <CameraOutlined />
              Chụp ảnh khảo sát
            </span>
          )}
          open={cameraModalOpen}
          onCancel={closeCameraCapture}
          width='min(720px, calc(100vw - 40px))'
          className='camera-capture-modal'
          destroyOnHidden
          footer={[
            <Button key='fallback' onClick={() => attachmentCameraInputRef.current?.click()}>
              Chọn từ camera thiết bị
            </Button>,
            <Button key='cancel' onClick={closeCameraCapture}>
              Hủy
            </Button>,
            <Button
              key='capture'
              type='primary'
              icon={<CameraOutlined />}
              loading={cameraStarting}
              disabled={Boolean(cameraError)}
              onClick={() => void captureSurveyPhoto()}
            >
              Chụp ảnh
            </Button>,
          ]}
        >
          <Typography.Text className='camera-capture-description'>
            Dùng camera để chụp ảnh hiện trường khảo sát. Ảnh sau khi chụp sẽ tự gắn vào hồ sơ với loại Ảnh khảo sát.
          </Typography.Text>
          {cameraError ? (
            <Alert
              type='warning'
              showIcon
              className='camera-capture-alert'
              message='Không mở được camera trực tiếp'
              description='Bạn có thể dùng nút Chọn từ camera thiết bị để mở camera/file picker mặc định của điện thoại.'
            />
          ) : null}
          <div className='camera-preview-frame'>
            {cameraStarting ? (
              <div className='camera-preview-placeholder'>Đang mở camera...</div>
            ) : null}
            <video ref={cameraVideoRef} className='camera-preview-video' autoPlay playsInline muted />
            <canvas ref={cameraCanvasRef} hidden />
          </div>
        </Modal>
        <Modal
          title='Thêm link tài liệu'
          open={attachmentLinkModalOpen}
          onCancel={() => setAttachmentLinkModalOpen(false)}
          onOk={addAttachmentLink}
          okText='Thêm link'
          cancelText='Hủy'
          destroyOnHidden
        >
          <Input
            value={attachmentLinkDraft}
            onChange={(event) => setAttachmentLinkDraft(event.target.value)}
            prefix={<LinkOutlined />}
            placeholder='https://...'
          />
        </Modal>
        <Modal
          title={(
            <span className='location-modal-title'>
              <EnvironmentOutlined />
              Chọn vị trí và ghim bản đồ
            </span>
          )}
          open={locationModalOpen}
          onCancel={() => {
            setLocationModalOpen(false);
            setLocationTargetElevatorSpecId(undefined);
          }}
          width='min(1080px, calc(100vw - 96px))'
          style={{ top: 48 }}
          className='location-picker-modal'
          destroyOnHidden
          footer={[
            <Button
              key='cancel'
              onClick={() => {
                setLocationModalOpen(false);
                setLocationTargetElevatorSpecId(undefined);
              }}
            >
              Hủy bỏ
            </Button>,
            <Tooltip key='confirm' title={!draftLocation ? 'Chọn vị trí trên bản đồ hoặc từ gợi ý địa chỉ để xác nhận.' : ''}>
              <span>
                <Button
                  type='primary'
                  icon={<EnvironmentOutlined />}
                  disabled={!draftLocation}
                  onClick={() => {
                    if (!draftLocation) return;
                    if (locationTargetElevatorSpecId) {
                      updateElevatorSpec(locationTargetElevatorSpecId, {
                        latitude: draftLocation.latitude,
                        longitude: draftLocation.longitude,
                        locationAccuracyMeters: draftLocation.accuracyMeters,
                        locationLabel: draftLocation.label,
                      });
                    }
                    setLocationModalOpen(false);
                    setLocationTargetElevatorSpecId(undefined);
                  }}
                >
                  Xác nhận ghim vị trí
                </Button>
              </span>
            </Tooltip>,
          ]}
        >
          <div className='location-search-sticky'>
            <Typography.Text className='location-modal-description'>
              Gõ địa chỉ để chọn gợi ý, dán link Google Maps/tọa độ để tự ghim, hoặc click trực tiếp trên bản đồ.
            </Typography.Text>
            <div className='location-search-row'>
              <AutoComplete
                className='location-autocomplete'
                value={locationSearch}
                options={locationSuggestionOptions}
                onSearch={setLocationSearch}
                onSelect={(value) => {
                  const suggestion = locationSuggestions.find((item) => item.id === value);
                  if (suggestion) void selectLocationSuggestion(suggestion);
                }}
                notFoundContent={locationSuggesting ? 'Đang tìm gợi ý...' : 'Không có gợi ý phù hợp'}
              >
                <Input
                  onPressEnter={() => void searchLocation()}
                  prefix={<SearchOutlined />}
                  placeholder='Gõ địa chỉ rồi chọn gợi ý hoặc nhấn Enter...'
                />
              </AutoComplete>
            </div>
            <div className='location-share-row'>
              <Input
                value={sharedLocationText}
                onChange={(event) => setSharedLocationText(event.target.value)}
                onPressEnter={() => void applySharedLocation()}
                prefix={<PushpinOutlined />}
                placeholder='Dán link Google Maps hoặc tọa độ, hệ thống sẽ tự đọc: 16.0610549,108.2200688'
                allowClear
              />
            </div>
          </div>
          <div className='location-gps-panel'>
            <div className='location-coordinate-strip'>
              {coordinateEditing ? (
                <>
                  <label>
                    <b>Vĩ độ</b>
                    <Input
                      size='small'
                      value={coordinateDraft.latitude}
                      onChange={(event) => setCoordinateDraft((value) => ({ ...value, latitude: event.target.value }))}
                      inputMode='decimal'
                      placeholder='VD: 19.780260'
                    />
                  </label>
                  <label>
                    <b>Kinh độ</b>
                    <Input
                      size='small'
                      value={coordinateDraft.longitude}
                      onChange={(event) => setCoordinateDraft((value) => ({ ...value, longitude: event.target.value }))}
                      inputMode='decimal'
                      placeholder='VD: 105.776450'
                    />
                  </label>
                </>
              ) : (
                <>
                  <span><b>Vĩ độ</b>{draftLocation?.latitude.toFixed(6) ?? 'Chưa chọn'}</span>
                  <span><b>Kinh độ</b>{draftLocation?.longitude.toFixed(6) ?? 'Chưa chọn'}</span>
                </>
              )}
              <Space className='location-gps-actions' size={8}>
                {coordinateEditing ? (
                  <Button icon={<CheckOutlined />} loading={locationLoading} onClick={() => void applyManualCoordinates()}>
                    Lưu tọa độ
                  </Button>
                ) : (
                  <Button icon={<EditOutlined />} onClick={beginCoordinateEdit}>
                    Sửa tọa độ
                  </Button>
                )}
                <Button icon={<AimOutlined />} loading={locationLoading} onClick={useCurrentLocation}>
                  Lấy vị trí hiện tại
                </Button>
                <Button onClick={() => {
                  setDraftLocation(undefined);
                  setCoordinateEditing(false);
                }}>
                  Xóa pin
                </Button>
              </Space>
            </div>
          </div>
          <div className='location-map-wrap'>
            {!draftLocation && (
              <div className='location-map-hint'>
                Click trên bản đồ hoặc chọn một gợi ý địa chỉ để ghim vị trí.
              </div>
            )}
            <LocationPickerMap
              center={[19.8071, 105.7763]}
              pin={draftLocation ? [draftLocation.latitude, draftLocation.longitude] : undefined}
              onPick={(latitude, longitude) => void pickLocation(latitude, longitude, 100)}
            />
          </div>
          <Alert
            className='location-clean-address'
            type='info'
            showIcon={false}
            message={draftLocation ? 'Đã ghim vị trí' : 'Chưa chọn vị trí'}
            description={draftLocation ? (
              <span>
                {draftLocation.label || 'Đã ghim vị trí'} · {draftLocation.latitude.toFixed(6)}, {draftLocation.longitude.toFixed(6)}
              </span>
            ) : 'Chọn vị trí trên bản đồ hoặc từ danh sách gợi ý để bật nút xác nhận.'}
          />
        </Modal>
    </PageContainer>
  );
}
