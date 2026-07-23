import type { TechnicalConfigurationValues } from '@/components/TechnicalConfigurationForm';

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function technicalConfigurationErrors(configuration: TechnicalConfigurationValues) {
  const errors: string[] = [];
  const requiredNumbers: Array<[unknown, string]> = [
    [configuration.floors, 'Số tầng'],
    [configuration.capacityKg, 'Tải trọng'],
    [configuration.shaftWidthMm, 'Rộng thông thủy'],
    [configuration.shaftDepthMm, 'Sâu thông thủy'],
    [configuration.pitDepthMm, 'Hố pit'],
    [configuration.machineRoomHeightMm, 'Chiều cao phòng máy'],
    [configuration.overheadHeightMm, 'Chiều cao OH'],
  ];

  if (!configuration.name?.trim()) errors.push('Tên cấu hình thang máy');
  if (!configuration.elevatorType) errors.push('Loại thang máy');
  if (!configuration.counterweightPosition) errors.push('Vị trí đối trọng');
  requiredNumbers.forEach(([value, label]) => {
    if (!isPositiveNumber(value)) errors.push(label);
  });
  if (!configuration.installationAddress?.trim()) errors.push('Địa chỉ lắp đặt');
  if (typeof configuration.latitude !== 'number' || typeof configuration.longitude !== 'number') {
    errors.push('Vị trí ghim triển khai');
  }

  const floors = configuration.floorHeights ?? [];
  if (!isPositiveNumber(configuration.floors) || floors.length !== configuration.floors) {
    errors.push('Chiều cao từng tầng');
  } else {
    floors.forEach((floor, index) => {
      if (!floor.floorName?.trim()) errors.push(`Tên tầng ${index + 1}`);
      if (!isPositiveNumber(floor.heightMm)) errors.push(`Chiều cao tầng ${index + 1}`);
    });
  }

  return errors;
}

export function parseConsultationConfigurations(raw?: string): TechnicalConfigurationValues[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((item): item is TechnicalConfigurationValues => Boolean(item) && typeof item === 'object')
      : [];
  } catch {
    return [];
  }
}

export function cloneConsultationConfiguration(
  configuration: TechnicalConfigurationValues,
  id: string,
): TechnicalConfigurationValues {
  return {
    ...configuration,
    id,
    name: `${configuration.name || 'Thang máy'} - Bản sao`,
    floorHeights: configuration.floorHeights?.map((floor, index) => ({
      ...floor,
      id: `${id}-floor-${index + 1}`,
    })),
    // Tài liệu khảo sát thuộc vị trí/thang thực tế, không nhân bản sang thang mới.
    attachments: [],
  };
}
