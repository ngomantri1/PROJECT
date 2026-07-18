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
  Input,
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
  CheckOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EllipsisOutlined,
  EnvironmentOutlined,
  EditOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  FilterOutlined,
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
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exportCsv';

const LocationPickerMap = dynamic(() => import('@/components/LocationPickerMap'), { ssr: false });

type CustomerRow = {
  id: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  area?: string;
  elevatorType?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracyMeters?: number;
  locationLabel?: string;
  customerType: 'PERSONAL' | 'BUSINESS';
  notes?: string;
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
  elevatorType?: string;
  source: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracyMeters?: number;
  locationLabel?: string;
  notes?: string;
  status: string;
};

type CustomerLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  label?: string;
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
const fallbackCustomerTypeOptions: CatalogOption[] = [
  { code: 'PERSONAL', label: 'Cá nhân', color: 'green' },
  { code: 'BUSINESS', label: 'Doanh nghiệp', color: 'blue' },
];
const fallbackElevatorTypeOptions: CatalogOption[] = [
  { code: 'BUILT', label: 'Thang xây', color: 'green' },
  { code: 'GLASS', label: 'Thang kính', color: 'blue' },
];

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

export default function Customers() {
  const router = useRouter();
  const customerFormRef = useRef<ProFormInstance<CustomerForm> | undefined>(undefined);
  const [data, setData] = useState<CustomerRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow>();
  const [customerLocation, setCustomerLocation] = useState<CustomerLocation>();
  const [locationModalOpen, setLocationModalOpen] = useState(false);
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
      setData(await api<CustomerRow[]>(`/customers${query ? `?${query}` : ''}`));
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh sách khách hàng.');
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
    exportCsv(`danh-sach-khach-hang-${dayjs().format('YYYYMMDD-HHmm')}`, data, [
      { header: 'Mã KH', value: (item) => item.code },
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

  const openCreateDrawer = () => {
    setEditingCustomer(undefined);
    setCustomerLocation(undefined);
    setOpen(true);
  };

  const openEditDrawer = (customer: CustomerRow) => {
    setEditingCustomer(customer);
    setCustomerLocation(
      typeof customer.latitude === 'number' && typeof customer.longitude === 'number'
        ? {
          latitude: customer.latitude,
          longitude: customer.longitude,
          accuracyMeters: customer.locationAccuracyMeters,
          label: customer.locationLabel,
        }
        : undefined,
    );
    setOpen(true);
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

  const openLocationPicker = () => {
    setDraftLocation(customerLocation);
    setLocationSearch(customerLocation?.label ?? '');
    setSharedLocationText('');
    setLastResolvedSharedLocation('');
    setCoordinateEditing(false);
    setCoordinateDraft({
      latitude: customerLocation?.latitude.toFixed(6) ?? '',
      longitude: customerLocation?.longitude.toFixed(6) ?? '',
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
      await api(`/customers/${customer.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      message.success('Đã cập nhật trạng thái khách hàng');
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
    const hasLocation = typeof customer.latitude === 'number' && typeof customer.longitude === 'number';
    const locationText = customer.locationLabel
      || (hasLocation ? `${customer.latitude?.toFixed(6)}, ${customer.longitude?.toFixed(6)}` : undefined);
    const mapUrl = hasLocation
      ? `https://www.google.com/maps/search/?api=1&query=${customer.latitude},${customer.longitude}`
      : undefined;

    return displayAddress ? (
      <Tooltip title={displayAddress}>
        <span className='table-address-cell'>
          <span className='table-cell-inline'>
            <EnvironmentOutlined />
            <span className='table-cell-inline-text table-cell-clamp'>{displayAddress}</span>
          </span>
          {hasLocation && mapUrl && (
            <Tooltip title={`Mở Google Maps: ${locationText}`}>
              <a
                href={mapUrl}
                target='_blank'
                rel='noreferrer'
                className='table-address-pin'
                onClick={(event) => event.stopPropagation()}
              >
                <PushpinOutlined />
              </a>
            </Tooltip>
          )}
        </span>
      </Tooltip>
    ) : <Typography.Text type='secondary'>—</Typography.Text>;
  };

  const columns: ProColumns<CustomerRow>[] = [
    {
      title: 'Mã KH',
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
            <Tooltip title='Thao tác khác'>
              <Button type='text' className='table-action-button' icon={<EllipsisOutlined />} />
            </Tooltip>
          </Dropdown>
        </Space>,
      ],
    },
  ];

  const save = async (values: CustomerForm) => {
    const payload = {
      ...values,
      latitude: customerLocation?.latitude ?? null,
      longitude: customerLocation?.longitude ?? null,
      locationAccuracyMeters: customerLocation?.accuracyMeters ?? null,
      locationLabel: customerLocation?.label ?? null,
    };
    try {
      if (editingCustomer) {
        await api(`/customers/${editingCustomer.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        message.success('Đã cập nhật đăng ký khách hàng');
      } else {
        await api('/customers', { method: 'POST', body: JSON.stringify(payload) });
        message.success('Đã tạo đăng ký khách hàng');
      }
      setOpen(false);
      setEditingCustomer(undefined);
      setCustomerLocation(undefined);
      await load();
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không lưu được khách hàng.');
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
            <Button type='primary' icon={<PlusOutlined />} onClick={openCreateDrawer}>
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
          <div className='customer-search-row'>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              prefix={<SearchOutlined />}
              placeholder='Tìm tên, SĐT, email hoặc mã KH...'
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
            <Typography.Text className='filter-result-count'>{data.length} khách hàng</Typography.Text>
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
            Áp dụng nhiều điều kiện cùng lúc cho danh sách khách hàng hiện tại.
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
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${total} khách hàng` }}
            scroll={{ x: 1510 }}
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
                    <Descriptions.Item label='Địa chỉ'>{customer.address || customer.area || '—'}</Descriptions.Item>
                    <Descriptions.Item label='Vị trí'>
                      {typeof customer.latitude === 'number' && typeof customer.longitude === 'number' ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${customer.latitude},${customer.longitude}`}
                          target='_blank'
                          rel='noreferrer'
                        >
                          Đã ghim vị trí
                        </a>
                      ) : 'Chưa ghim'}
                    </Descriptions.Item>
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
          key={editingCustomer?.id ?? 'create-customer'}
          formRef={customerFormRef}
          title={editingCustomer ? 'Sửa đăng ký khách hàng' : 'Thêm đăng ký khách hàng'}
          open={open}
          onOpenChange={(visible) => {
            setOpen(visible);
            if (!visible) {
              setEditingCustomer(undefined);
              setCustomerLocation(undefined);
            }
          }}
          width={760}
          initialValues={editingCustomer ? {
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
          } : { customerType: 'PERSONAL', source: 'Marketing', status: 'NEW' }}
          onFinish={save}
          drawerProps={{ destroyOnClose: true, className: 'customer-form-drawer' }}
          submitter={{ searchConfig: { submitText: editingCustomer ? 'Lưu thay đổi' : 'Lưu đăng ký', resetText: 'Hủy' } }}
        >
          <div className='form-section-heading'>Thông tin khách hàng</div>
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
            label='Địa chỉ công trình'
            placeholder='Nhập địa chỉ dự kiến lắp đặt thang máy'
            fieldProps={{ rows: 2 }}
          />
          <div className='location-pin-panel'>
            <div>
              <Typography.Text strong>Vị trí triển khai</Typography.Text>
              <Typography.Text type='secondary'>
                Ghim tọa độ để kỹ thuật có thể mở bản đồ khi khảo sát/lắp đặt.
              </Typography.Text>
            </div>
            <Space wrap>
              <Button icon={<PushpinOutlined />} onClick={openLocationPicker}>
                {customerLocation ? 'Sửa vị trí ghim' : 'Ghim vị trí'}
              </Button>
              {customerLocation && (
                <Button icon={<DeleteOutlined />} onClick={() => setCustomerLocation(undefined)}>
                  Xóa ghim
                </Button>
              )}
            </Space>
            {customerLocation && (
              <div className='location-pin-summary'>
                <EnvironmentOutlined />
                <span>
                  {customerLocation.label || 'Đã ghim vị trí'} · {customerLocation.latitude.toFixed(6)}, {customerLocation.longitude.toFixed(6)}
                </span>
              </div>
            )}
          </div>
          <ProFormTextArea
            name='notes'
            label='Yêu cầu / Ghi chú ban đầu'
            placeholder='Loại thang, số tầng, tải trọng, thời gian dự kiến...'
            fieldProps={{ rows: 3 }}
          />
          <ProFormText name='status' hidden />
        </DrawerForm>
        <Modal
          title={(
            <span className='location-modal-title'>
              <EnvironmentOutlined />
              Chọn vị trí và ghim bản đồ
            </span>
          )}
          open={locationModalOpen}
          onCancel={() => setLocationModalOpen(false)}
          width='min(1080px, calc(100vw - 96px))'
          style={{ top: 48 }}
          className='location-picker-modal'
          destroyOnHidden
          footer={[
            <Button key='cancel' onClick={() => setLocationModalOpen(false)}>
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
                    setCustomerLocation(draftLocation);
                    if (draftLocation.label) {
                      customerFormRef.current?.setFieldsValue({ address: draftLocation.label });
                    }
                    setLocationModalOpen(false);
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
