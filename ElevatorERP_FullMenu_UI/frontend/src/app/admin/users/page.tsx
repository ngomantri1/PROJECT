'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Card,
  Col,
  Descriptions,
  List,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { api } from '@/lib/api';

type UserRow = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  isActive: boolean;
  department: string;
  roles: string[];
};

type RoleRow = {
  id: string;
  name: string;
};

export default function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [userData, roleData] = await Promise.all([
        api<UserRow[]>('/admin/users'),
        api<RoleRow[]>('/admin/roles'),
      ]);
      setUsers(userData);
      setRoles(roleData);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được người dùng và vai trò.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const assign = async (id: string, roleIds: string[]) => {
    try {
      await api(`/admin/users/${id}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ roleIds }),
      });
      message.success('Đã cập nhật vai trò');
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không cập nhật được vai trò.');
    }
  };

  const summary = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.isActive).length,
      departments: new Set(users.map((user) => user.department).filter(Boolean)).size,
      roles: roles.length,
    }),
    [users, roles],
  );

  const roleSelector = (user: UserRow) => (
    <Select
      mode='multiple'
      maxTagCount='responsive'
      className='role-selector'
      value={roles.filter((role) => user.roles.includes(role.name)).map((role) => role.id)}
      options={roles.map((role) => ({ value: role.id, label: role.name }))}
      onChange={(value) => void assign(user.id, value)}
    />
  );

  const columns: ProColumns<UserRow>[] = [
    {
      title: 'Người dùng',
      dataIndex: 'displayName',
      width: 260,
      render: (_, user) => (
        <Space>
          <Avatar className='user-table-avatar'>{user.displayName.charAt(0)}</Avatar>
          <span>
            <b className='table-primary-text'>{user.displayName}</b>
            <small className='table-secondary-text'>{user.username}</small>
          </span>
        </Space>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      width: 230,
      render: (value) => String(value || '—'),
    },
    {
      title: 'Phòng ban',
      dataIndex: 'department',
      width: 190,
      render: (value) => <span><ApartmentOutlined /> {String(value || 'Chưa phân phòng')}</span>,
    },
    {
      title: 'Vai trò hiệu lực',
      dataIndex: 'roles',
      minWidth: 320,
      render: (_, user) => roleSelector(user),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      width: 130,
      render: (_, user) => (
        <Tag color={user.isActive ? 'green' : 'red'} icon={user.isActive ? <CheckCircleOutlined /> : <LockOutlined />}>
          {user.isActive ? 'Hoạt động' : 'Đã khóa'}
        </Tag>
      ),
    },
  ];

  return (
    <PageContainer
        className='erp-page-container'
        header={{
          title: 'Người dùng và vai trò',
          subTitle: 'Một tài khoản có thể được gán nhiều vai trò; quyền hiệu lực là tổng quyền',
          breadcrumb: {},
        }}
      >
        <Row gutter={[16, 16]}>
          {[
            { label: 'Tổng tài khoản', value: summary.total, icon: <TeamOutlined />, tone: 'blue' },
            { label: 'Đang hoạt động', value: summary.active, icon: <CheckCircleOutlined />, tone: 'green' },
            { label: 'Phòng ban', value: summary.departments, icon: <ApartmentOutlined />, tone: 'cyan' },
            { label: 'Vai trò', value: summary.roles, icon: <SafetyCertificateOutlined />, tone: 'violet' },
          ].map((item) => (
            <Col xs={12} lg={6} key={item.label}>
              <ProCard className={`mini-stat mini-stat-${item.tone}`}>
                <span className='mini-stat-icon'>{item.icon}</span>
                <span>
                  <small>{item.label}</small>
                  <b>{item.value}</b>
                </span>
              </ProCard>
            </Col>
          ))}
        </Row>

        <AlertPanel />

        <div className='desktop-table section-gap'>
          <ProTable<UserRow>
            rowKey='id'
            loading={loading}
            dataSource={users}
            columns={columns}
            search={false}
            cardBordered
            headerTitle='Danh sách tài khoản'
            options={{ density: true, fullScreen: true, reload: () => void load() }}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${total} tài khoản` }}
            scroll={{ x: 1200 }}
          />
        </div>

        <div className='mobile-card-list section-gap'>
          <List
            loading={loading}
            dataSource={users}
            locale={{ emptyText: 'Chưa có người dùng' }}
            renderItem={(user) => (
              <List.Item>
                <Card className='mobile-record-card'>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }} align='start'>
                    <Space align='start'>
                      <Avatar className='user-table-avatar'>{user.displayName.charAt(0)}</Avatar>
                      <div>
                        <Typography.Text strong>{user.displayName}</Typography.Text>
                        <div className='muted-text'>{user.username}</div>
                      </div>
                    </Space>
                    <Tag color={user.isActive ? 'green' : 'red'}>
                      {user.isActive ? 'Hoạt động' : 'Đã khóa'}
                    </Tag>
                  </Space>
                  <Descriptions size='small' column={1} className='mobile-descriptions'>
                    <Descriptions.Item label='Phòng ban'>{user.department || '—'}</Descriptions.Item>
                    <Descriptions.Item label='Email'>{user.email || '—'}</Descriptions.Item>
                    <Descriptions.Item label='Vai trò'>{roleSelector(user)}</Descriptions.Item>
                  </Descriptions>
                </Card>
              </List.Item>
            )}
          />
        </div>
    </PageContainer>
  );
}

function AlertPanel() {
  return (
    <ProCard className='section-gap permission-note'>
      <Space align='start'>
        <div className='permission-note-icon'><UserOutlined /></div>
        <div>
          <Typography.Text strong>Nguyên tắc phân quyền đang áp dụng</Typography.Text>
          <Typography.Paragraph type='secondary' style={{ margin: '4px 0 0' }}>
            Hệ thống cộng dồn quyền từ nhiều vai trò. Menu chỉ hỗ trợ hiển thị theo quyền;
            backend vẫn kiểm tra bắt buộc và trả 403 khi tài khoản không đủ quyền.
          </Typography.Paragraph>
        </div>
      </Space>
    </ProCard>
  );
}
