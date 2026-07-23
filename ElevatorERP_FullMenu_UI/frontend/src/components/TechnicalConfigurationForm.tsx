'use client';

import type { ReactNode } from 'react';
import { CopyOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Badge, Button, Input, InputNumber, Select, Typography } from 'antd';

export type TechnicalFloorHeight = { id?: string; floorName?: string; heightMm?: number };

export type TechnicalConfigurationValues = {
  id?: string;
  name?: string;
  elevatorType?: string;
  floors?: number;
  capacityKg?: number;
  counterweightPosition?: string;
  shaftWidthMm?: number;
  shaftDepthMm?: number;
  pitDepthMm?: number;
  machineRoomHeightMm?: number;
  overheadHeightMm?: number;
  installationAddress?: string;
  installationWard?: string;
  installationProvince?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  attachments?: object[];
  technicalNotes?: string;
  floorHeights?: TechnicalFloorHeight[];
  [key: string]: unknown;
};

type Props = {
  value: TechnicalConfigurationValues;
  onChange: (nextValue: TechnicalConfigurationValues) => void;
  locationExtra?: ReactNode;
  attachmentsExtra?: ReactNode;
  contactAddress?: string;
  disabled?: boolean;
};

const elevatorTypes = [
  { value: 'BUILT', label: 'Thang xây' },
  { value: 'GLASS', label: 'Thang kính' },
];

const counterweightPositions = [
  { value: 'BACK', label: 'Sau' },
  { value: 'SIDE', label: 'Hông' },
  { value: 'NONE', label: 'Không đối trọng' },
];

function floorId(index: number) {
  return `floor-${Date.now()}-${index}`;
}

export default function TechnicalConfigurationForm({ value, onChange, locationExtra, attachmentsExtra, contactAddress, disabled = false }: Props) {
  const patch = (next: Partial<TechnicalConfigurationValues>) => onChange({ ...value, ...next });
  const floors = value.floorHeights ?? [];

  const changeFloorCount = (nextFloors: number | null) => {
    const count = nextFloors ?? undefined;
    const nextFloorHeights = count && count > 0
      ? Array.from({ length: count }, (_, index) => floors[index] ?? { id: floorId(index), floorName: `Tầng ${index + 1}`, heightMm: 3600 })
      : floors;
    patch({ floors: count, floorHeights: nextFloorHeights });
  };

  const updateFloor = (index: number, floorPatch: Partial<TechnicalFloorHeight>) => {
    patch({ floorHeights: floors.map((floor, floorIndex) => floorIndex === index ? { ...floor, ...floorPatch } : floor) });
  };

  return (
    <div className='technical-config-body technical-configuration-form'>
      <div className='technical-grid five-columns'>
        <label><span>Tên cấu hình thang máy <b className='required-marker'>*</b></span><Input disabled={disabled} value={value.name} onChange={(event) => patch({ name: event.target.value })} /></label>
        <label><span>Số tầng <b className='required-marker'>*</b></span><InputNumber disabled={disabled} min={1} max={200} value={value.floors} onChange={changeFloorCount} /></label>
        <label><span>Tải trọng (kg) <b className='required-marker'>*</b></span><InputNumber disabled={disabled} min={100} step={50} value={value.capacityKg} onChange={(capacityKg) => patch({ capacityKg: capacityKg ?? undefined })} /></label>
        <label><span>Loại thang máy <b className='required-marker'>*</b></span><Select disabled={disabled} value={value.elevatorType} options={elevatorTypes} onChange={(elevatorType) => patch({ elevatorType })} /></label>
        <label><span>Vị trí đối trọng <b className='required-marker'>*</b></span><Select disabled={disabled} value={value.counterweightPosition} options={counterweightPositions} onChange={(counterweightPosition) => patch({ counterweightPosition })} /></label>
      </div>

      <div className='technical-section-title'>Thông tin hố thang</div>
      <div className='technical-grid five-columns'>
        <label><span>Rộng thông thủy (mm) <b className='required-marker'>*</b></span><InputNumber disabled={disabled} min={1} value={value.shaftWidthMm} onChange={(shaftWidthMm) => patch({ shaftWidthMm: shaftWidthMm ?? undefined })} /></label>
        <label><span>Sâu thông thủy (mm) <b className='required-marker'>*</b></span><InputNumber disabled={disabled} min={1} value={value.shaftDepthMm} onChange={(shaftDepthMm) => patch({ shaftDepthMm: shaftDepthMm ?? undefined })} /></label>
        <label><span>Hố pit (mm) <b className='required-marker'>*</b></span><InputNumber disabled={disabled} min={1} value={value.pitDepthMm} onChange={(pitDepthMm) => patch({ pitDepthMm: pitDepthMm ?? undefined })} /></label>
        <label><span>Chiều cao phòng máy (mm) <b className='required-marker'>*</b></span><InputNumber disabled={disabled} min={1} value={value.machineRoomHeightMm} onChange={(machineRoomHeightMm) => patch({ machineRoomHeightMm: machineRoomHeightMm ?? undefined })} /></label>
        <label><span>Chiều cao OH (mm) <b className='required-marker'>*</b></span><InputNumber disabled={disabled} min={1} value={value.overheadHeightMm} onChange={(overheadHeightMm) => patch({ overheadHeightMm: overheadHeightMm ?? undefined })} /></label>
      </div>

      <div className='technical-table-heading'>
        <span>Chiều cao từng tầng thực tế <b className='required-marker'>*</b></span>
        <Button disabled={disabled} icon={<PlusOutlined />} onClick={() => patch({ floorHeights: [...floors, { id: floorId(floors.length), floorName: `Tầng ${floors.length + 1}`, heightMm: 3600 }], floors: Math.max(value.floors ?? 0, floors.length + 1) })}>Thêm tầng</Button>
      </div>
      <div className='floor-height-table'>
        <div className='floor-height-row head'><span>Tên tầng <b className='required-marker'>*</b></span><span>Chiều cao (mm) <b className='required-marker'>*</b></span><span>Xóa</span></div>
        {floors.map((floor, index) => (
          <div key={floor.id ?? index} className='floor-height-row'>
            <Input disabled={disabled} value={floor.floorName} onChange={(event) => updateFloor(index, { floorName: event.target.value })} />
            <InputNumber disabled={disabled} min={1} value={floor.heightMm} onChange={(heightMm) => updateFloor(index, { heightMm: heightMm ?? undefined })} />
            <Button disabled={disabled} type='text' danger icon={<DeleteOutlined />} onClick={() => patch({ floorHeights: floors.filter((_, floorIndex) => floorIndex !== index), floors: Math.max(0, (value.floors ?? floors.length) - 1) })} />
          </div>
        ))}
      </div>

      <div className='technical-section-title'>Vị trí lắp đặt</div>
      <div className='technical-grid'>
        <label>
          <span className='technical-installation-address-head'><span>Địa chỉ công trình / vị trí đặt thang <b className='required-marker'>*</b></span>{contactAddress && <Button className='technical-copy-contact-button' disabled={disabled} size='small' icon={<CopyOutlined />} onClick={() => patch({ installationAddress: contactAddress })}>Dùng địa chỉ liên hệ</Button>}</span>
          <Input disabled={disabled} value={value.installationAddress} onChange={(event) => patch({ installationAddress: event.target.value })} />
        </label>
        {locationExtra}
      </div>

      <div className='technical-section-title'>Tài liệu / Ảnh khảo sát <Badge count={value.attachments?.length ?? 0} showZero size='small' className='section-count-badge' /></div>
      {attachmentsExtra ?? <Typography.Text type='secondary'>Tài liệu khảo sát được quản lý tại đăng ký tư vấn.</Typography.Text>}

      <label className='technical-note-field'><span>Ghi chú kỹ thuật</span><Input.TextArea disabled={disabled} rows={3} value={value.technicalNotes} onChange={(event) => patch({ technicalNotes: event.target.value })} /></label>
    </div>
  );
}
