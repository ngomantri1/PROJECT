import { Tag } from 'antd';
import type { TagProps } from 'antd';

export type AppStatusMeta = {
  label: string;
  color: TagProps['color'];
};

const statusRegistry: Record<string, AppStatusMeta> = {
  ACTIVE: { label: 'Đang hoạt động', color: 'success' },
  INACTIVE: { label: 'Ngừng hoạt động', color: 'error' },
  NEW: { label: 'Mới tạo', color: 'blue' },
  DRAFT: { label: 'Nháp', color: 'default' },
  PREPARING: { label: 'Chuẩn bị', color: 'blue' },
  OPEN: { label: 'Mới tiếp nhận', color: 'error' },
  ASSIGNED: { label: 'Đã phân công', color: 'blue' },
  UPCOMING: { label: 'Sắp đến hạn', color: 'blue' },
  DUE: { label: 'Đến hạn', color: 'warning' },
  WAITING: { label: 'Chờ xử lý', color: 'warning' },
  PENDING: { label: 'Chờ duyệt', color: 'warning' },
  PENDING_APPROVAL: { label: 'Chờ duyệt', color: 'warning' },
  IN_PROGRESS: { label: 'Đang thực hiện', color: 'processing' },
  PROCESSING: { label: 'Đang xử lý', color: 'processing' },
  EXECUTING: { label: 'Đang triển khai', color: 'processing' },
  BLOCKED: { label: 'Đang vướng', color: 'orange' },
  APPROVED: { label: 'Đã duyệt', color: 'success' },
  SENT: { label: 'Đã gửi', color: 'blue' },
  ACCEPTED: { label: 'Khách đồng ý', color: 'success' },
  PAID: { label: 'Đã xác nhận', color: 'success' },
  DONE: { label: 'Hoàn thành', color: 'success' },
  COMPLETED: { label: 'Hoàn thành', color: 'success' },
  CLOSED: { label: 'Đã khôi phục', color: 'success' },
  OVERDUE: { label: 'Quá hạn', color: 'error' },
  REJECTED: { label: 'Từ chối', color: 'error' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
};

export function getAppStatusMeta(value: string, fallback?: Partial<AppStatusMeta>): AppStatusMeta {
  const shared = statusRegistry[value];
  return {
    label: fallback?.label ?? shared?.label ?? value,
    color: shared?.color ?? fallback?.color ?? 'default',
  };
}

type AppStatusTagProps = Omit<TagProps, 'children'> & {
  value: string;
  label?: string;
};

export default function AppStatusTag({ value, label, color, ...tagProps }: AppStatusTagProps) {
  const status = getAppStatusMeta(value, { label, color });
  return (
    <Tag color={status.color} {...tagProps}>
      {status.label}
    </Tag>
  );
}
