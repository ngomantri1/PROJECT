'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { AimOutlined, CheckOutlined, EditOutlined, EnvironmentOutlined, PushpinOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, AutoComplete, Button, Input, Modal, Space, Tag, Tooltip, Typography, message } from 'antd';
import { api } from '@/lib/api';

const LocationPickerMap = dynamic(() => import('@/components/LocationPickerMap'), { ssr: false });

export type DeploymentLocationValue = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  label?: string;
  ward?: string;
  province?: string;
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

type Props = {
  open: boolean;
  value?: DeploymentLocationValue;
  searchSeed?: string;
  onCancel: () => void;
  onConfirm: (location: DeploymentLocationValue) => void;
};

async function reverseLookupLocation(latitude: number, longitude: number) {
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
    const result = await response.json() as { display_name?: string; address?: Record<string, string | undefined> };
    const addressParts = result.display_name?.split(',').map((part) => part.trim()).filter(Boolean) ?? [];
    return {
      label: result.display_name,
      ward: addressParts.find((part) => /^(Phường|Xã|Thị trấn)(?=\s|$)/i.test(part))
        || result.address?.city_district
        || result.address?.suburb
        || result.address?.quarter
        || result.address?.village
        || result.address?.town,
      province: addressParts.find((part) => /^(Tỉnh|Thành phố)(?=\s|$)/i.test(part))
        || result.address?.province
        || result.address?.state
        || result.address?.city,
    };
  } catch {
    return undefined;
  }
}

export default function DeploymentLocationPickerModal({ open, value, searchSeed, onCancel, onConfirm }: Props) {
  const [draftLocation, setDraftLocation] = useState<DeploymentLocationValue>();
  const [locationSearch, setLocationSearch] = useState('');
  const [sharedLocationText, setSharedLocationText] = useState('');
  const [lastResolvedSharedLocation, setLastResolvedSharedLocation] = useState('');
  const [coordinateEditing, setCoordinateEditing] = useState(false);
  const [coordinateDraft, setCoordinateDraft] = useState({ latitude: '', longitude: '' });
  const [locationSuggestions, setLocationSuggestions] = useState<GeoLocationSuggestion[]>([]);
  const [locationSuggesting, setLocationSuggesting] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraftLocation(value);
    setLocationSearch(searchSeed?.trim() || value?.label || '');
    setSharedLocationText('');
    setLastResolvedSharedLocation('');
    setCoordinateEditing(false);
    setCoordinateDraft({
      latitude: value?.latitude.toFixed(6) ?? '',
      longitude: value?.longitude.toFixed(6) ?? '',
    });
    if (value) {
      void reverseLookupLocation(value.latitude, value.longitude).then((resolved) => {
        if (!resolved) return;
        setDraftLocation((current) => current ? {
          ...current,
          label: resolved.label ?? current.label,
          ward: resolved.ward ?? current.ward,
          province: resolved.province ?? current.province,
        } : current);
      });
    }
  }, [open, searchSeed, value]);

  useEffect(() => {
    const query = locationSearch.trim();
    if (!open || query.length < 2) {
      setLocationSuggestions([]);
      setLocationSuggesting(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLocationSuggesting(true);
      try {
        const params = new URLSearchParams({ q: query });
        setLocationSuggestions(await api<GeoLocationSuggestion[]>(`/geo/search?${params.toString()}`, { signal: controller.signal }));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setLocationSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLocationSuggesting(false);
      }
    }, 450);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [locationSearch, open]);

  const locationSuggestionOptions = useMemo(() => locationSuggestions.map((item) => ({
    value: item.id,
    label: <div className='location-suggestion-option'><div><Typography.Text strong>{item.title}</Typography.Text><Typography.Text type='secondary'>{item.subtitle || item.label}</Typography.Text></div><Tag>{item.provider === 'google' ? 'Google' : item.type}</Tag></div>,
  })), [locationSuggestions]);

  const pickLocation = async (latitude: number, longitude: number, accuracyMeters?: number) => {
    setCoordinateEditing(false);
    setDraftLocation({ latitude, longitude, accuracyMeters, label: 'Đang xác định địa chỉ...' });
    const resolved = await reverseLookupLocation(latitude, longitude);
    const next = { latitude, longitude, accuracyMeters, label: resolved?.label, ward: resolved?.ward, province: resolved?.province };
    setDraftLocation(next);
    setLocationSearch(resolved?.label ?? '');
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
    await pickLocation(selected.latitude, selected.longitude, 100);
  };

  const searchLocation = async () => {
    if (!locationSearch.trim()) return;
    setLocationLoading(true);
    try {
      const params = new URLSearchParams({ q: locationSearch.trim() });
      const results = await api<GeoLocationSuggestion[]>(`/geo/search?${params.toString()}`);
      if (!results[0]) {
        message.warning('Không tìm thấy địa điểm phù hợp.');
        return;
      }
      await selectLocationSuggestion(results[0]);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tìm được vị trí.');
    } finally {
      setLocationLoading(false);
    }
  };

  const beginCoordinateEdit = () => {
    setCoordinateDraft({ latitude: draftLocation?.latitude.toFixed(6) ?? '', longitude: draftLocation?.longitude.toFixed(6) ?? '' });
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
    setLocationLoading(true);
    try {
      await pickLocation(latitude, longitude, draftLocation?.accuracyMeters ?? 100);
      setCoordinateEditing(false);
      message.success('Đã cập nhật tọa độ.');
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
      const result = await api<GeoLocationSuggestion>('/geo/resolve-link', { method: 'POST', body: JSON.stringify({ text }) });
      if (result.latitude === undefined || result.longitude === undefined) {
        if (!options?.silent) message.warning('Không đọc được tọa độ từ nội dung đã nhập.');
        return;
      }
      await pickLocation(result.latitude, result.longitude, 100);
      setLastResolvedSharedLocation(text);
      if (!options?.silent) message.success('Đã đọc tọa độ và ghim lên bản đồ.');
    } catch (error) {
      if (!options?.silent) message.error(error instanceof Error ? error.message : 'Không đọc được link hoặc tọa độ.');
    } finally {
      setLocationLoading(false);
    }
  }, [sharedLocationText]);

  useEffect(() => {
    const text = sharedLocationText.trim();
    if (!open || text.length < 8 || text === lastResolvedSharedLocation) return;
    const timer = window.setTimeout(() => void applySharedLocation({ silent: true }), 700);
    return () => window.clearTimeout(timer);
  }, [applySharedLocation, lastResolvedSharedLocation, open, sharedLocationText]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      message.warning('Trình duyệt không hỗ trợ lấy vị trí hiện tại.');
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => void pickLocation(position.coords.latitude, position.coords.longitude, Math.round(position.coords.accuracy)).finally(() => setLocationLoading(false)),
      () => {
        setLocationLoading(false);
        message.error('Không lấy được vị trí hiện tại. Vui lòng cấp quyền vị trí hoặc ghim trên bản đồ.');
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  return <Modal
    title={<span className='location-modal-title'><EnvironmentOutlined /> Chọn vị trí và ghim bản đồ</span>}
    open={open}
    onCancel={onCancel}
    width='min(1080px, calc(100vw - 96px))'
    style={{ top: 48 }}
    zIndex={9000}
    rootClassName='deployment-location-picker-root'
    className='location-picker-modal'
    destroyOnHidden
    footer={[<Button key='cancel' onClick={onCancel}>Hủy bỏ</Button>, <Tooltip key='confirm' title={!draftLocation ? 'Chọn vị trí trên bản đồ hoặc từ gợi ý địa chỉ để xác nhận.' : ''}><span><Button type='primary' icon={<EnvironmentOutlined />} disabled={!draftLocation} onClick={() => draftLocation && onConfirm(draftLocation)}>Xác nhận ghim vị trí</Button></span></Tooltip>]}
  >
    <div className='location-search-sticky'>
      <Typography.Text className='location-modal-description'>Gõ địa chỉ để chọn gợi ý, dán link Google Maps/tọa độ để tự ghim, hoặc click trực tiếp trên bản đồ.</Typography.Text>
      <div className='location-search-row'><AutoComplete className='location-autocomplete' value={locationSearch} options={locationSuggestionOptions} onSearch={setLocationSearch} onSelect={(selectedId) => { const suggestion = locationSuggestions.find((item) => item.id === selectedId); if (suggestion) void selectLocationSuggestion(suggestion); }} notFoundContent={locationSuggesting ? 'Đang tìm gợi ý...' : 'Không có gợi ý phù hợp'}><Input onPressEnter={() => void searchLocation()} prefix={<SearchOutlined />} placeholder='Gõ địa chỉ rồi chọn gợi ý hoặc nhấn Enter...' /></AutoComplete></div>
      <div className='location-share-row'><Input value={sharedLocationText} onChange={(event) => setSharedLocationText(event.target.value)} onPressEnter={() => void applySharedLocation()} prefix={<PushpinOutlined />} placeholder='Dán link Google Maps hoặc tọa độ, hệ thống sẽ tự đọc: 16.0610549,108.2200688' allowClear /></div>
    </div>
    <div className='location-gps-panel'><div className='location-coordinate-strip'>
      {coordinateEditing ? <><label><b>Vĩ độ</b><Input size='small' value={coordinateDraft.latitude} onChange={(event) => setCoordinateDraft((current) => ({ ...current, latitude: event.target.value }))} inputMode='decimal' placeholder='VD: 19.780260' /></label><label><b>Kinh độ</b><Input size='small' value={coordinateDraft.longitude} onChange={(event) => setCoordinateDraft((current) => ({ ...current, longitude: event.target.value }))} inputMode='decimal' placeholder='VD: 105.776450' /></label></> : <><span><b>Vĩ độ</b>{draftLocation?.latitude.toFixed(6) ?? 'Chưa chọn'}</span><span><b>Kinh độ</b>{draftLocation?.longitude.toFixed(6) ?? 'Chưa chọn'}</span></>}
      <Space className='location-gps-actions' size={8}>{coordinateEditing ? <Button icon={<CheckOutlined />} loading={locationLoading} onClick={() => void applyManualCoordinates()}>Lưu tọa độ</Button> : <Button icon={<EditOutlined />} onClick={beginCoordinateEdit}>Sửa tọa độ</Button>}<Button icon={<AimOutlined />} loading={locationLoading} onClick={useCurrentLocation}>Lấy vị trí hiện tại</Button><Button onClick={() => { setDraftLocation(undefined); setCoordinateEditing(false); }}>Xóa pin</Button></Space>
    </div></div>
    <div className='location-map-wrap'>{!draftLocation && <div className='location-map-hint'>Click trên bản đồ hoặc chọn một gợi ý địa chỉ để ghim vị trí.</div>}<LocationPickerMap center={draftLocation ? [draftLocation.latitude, draftLocation.longitude] : [19.8071, 105.7763]} pin={draftLocation ? [draftLocation.latitude, draftLocation.longitude] : undefined} onPick={(latitude, longitude) => void pickLocation(latitude, longitude, 100)} /></div>
    <Alert className='location-clean-address' type='info' showIcon={false} message={draftLocation ? 'Đã ghim vị trí' : 'Chưa chọn vị trí'} description={draftLocation ? <span>{draftLocation.label || 'Đã ghim vị trí'} · {draftLocation.latitude.toFixed(6)}, {draftLocation.longitude.toFixed(6)}</span> : 'Chọn vị trí trên bản đồ hoặc từ danh sách gợi ý để bật nút xác nhận.'} />
  </Modal>;
}
