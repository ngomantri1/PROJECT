'use client';

import type { ReactNode } from 'react';
import { EditOutlined, EllipsisOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Dropdown, Space, Tooltip } from 'antd';
import type { MenuProps } from 'antd';

type Props = {
  onView: () => void;
  onEdit?: () => void;
  moreItems?: MenuProps['items'];
  viewLabel?: string;
  editLabel?: string;
  extra?: ReactNode;
};

export default function Customer360TableActions({
  onView,
  onEdit,
  moreItems,
  viewLabel = 'Xem chi tiết',
  editLabel = 'Sửa',
  extra,
}: Props) {
  return (
    <Space size={2} className='customer-360-table-actions'>
      <Tooltip title={viewLabel}><Button type='text' className='table-action-button' aria-label={viewLabel} icon={<EyeOutlined />} onClick={onView} /></Tooltip>
      {onEdit && <Tooltip title={editLabel}><Button type='text' className='table-action-button' aria-label={editLabel} icon={<EditOutlined />} onClick={onEdit} /></Tooltip>}
      {extra}
      {moreItems?.length ? (
        <Dropdown menu={{ items: moreItems }} trigger={['click']}>
          <Tooltip title='Thao tác khác'><Button type='text' className='table-action-button' aria-label='Thao tác khác' icon={<EllipsisOutlined />} /></Tooltip>
        </Dropdown>
      ) : null}
    </Space>
  );
}
