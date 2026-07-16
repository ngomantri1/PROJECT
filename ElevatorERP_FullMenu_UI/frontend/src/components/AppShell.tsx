'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Dropdown,
  Input,
  Space,
  Spin,
  Tooltip,
} from 'antd';
import {
  AlertOutlined,
  ApartmentOutlined,
  AuditOutlined,
  BankOutlined,
  BellOutlined,
  CalendarOutlined,
  CarryOutOutlined,
  ClockCircleOutlined,
  ContactsOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FundProjectionScreenOutlined,
  HddOutlined,
  IdcardOutlined,
  LogoutOutlined,
  NotificationOutlined,
  PlusOutlined,
  ProjectOutlined,
  QuestionCircleOutlined,
  ReconciliationOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  ToolOutlined,
  UserAddOutlined,
  UserOutlined,
  VerticalAlignMiddleOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { ProLayout } from '@ant-design/pro-components';
import type { MenuDataItem } from '@ant-design/pro-components';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Me = {
  displayName: string;
  department: string;
  permissions: string[];
  roles: string[];
};

type ErpRoute = MenuDataItem & {
  permission?: string;
  children?: ErpRoute[];
};

const routeDefinitions: ErpRoute[] = [
  {
    path: '/',
    name: 'Tổng quan',
    icon: <DashboardOutlined />,
    permission: 'dashboard.view',
  },
  {
    path: '/work',
    name: 'Công việc của tôi',
    icon: <CarryOutOutlined />,
  },
  {
    path: '/notifications',
    name: 'Thông báo',
    icon: <BellOutlined />,
  },
  {
    path: '/business',
    name: 'Kinh doanh',
    icon: <CustomerServiceOutlined />,
    children: [
      {
        path: '/customers',
        name: 'Đăng ký khách hàng',
        icon: <UserAddOutlined />,
        permission: 'customer.view',
      },
      {
        path: '/care',
        name: 'Lịch chăm sóc khách hàng',
        icon: <CalendarOutlined />,
        permission: 'care.view',
      },
      { path: '/quotations', name: 'Báo giá', icon: <FileTextOutlined /> },
      { path: '/contracts', name: 'Hợp đồng', icon: <FileProtectOutlined /> },
    ],
  },
  {
    path: '/projects',
    name: 'Dự án và thang máy',
    icon: <ProjectOutlined />,
    children: [
      { path: '/projects/list', name: 'Danh sách dự án', icon: <ProjectOutlined /> },
      { path: '/elevators', name: 'Hồ sơ thang máy', icon: <VerticalAlignMiddleOutlined /> },
      { path: '/project-progress', name: 'Tiến độ dự án', icon: <FundProjectionScreenOutlined /> },
      { path: '/project-tasks', name: 'Công việc dự án', icon: <CarryOutOutlined /> },
      { path: '/site-journals', name: 'Nhật ký công trường', icon: <FileDoneOutlined /> },
      { path: '/project-members', name: 'Nhân sự dự án', icon: <TeamOutlined /> },
      { path: '/project-documents', name: 'Tài liệu dự án', icon: <FolderOpenOutlined /> },
    ],
  },
  {
    path: '/technical',
    name: 'Kỹ thuật',
    icon: <ToolOutlined />,
    children: [
      { path: '/technical/schedule', name: 'Lịch thi công', icon: <CalendarOutlined /> },
      { path: '/technical/kcs', name: 'KCS – Kiểm tra chất lượng', icon: <SafetyCertificateOutlined /> },
      { path: '/technical/inspection', name: 'Kiểm định', icon: <FileSearchOutlined /> },
      { path: '/technical/acceptance', name: 'Nghiệm thu', icon: <FileDoneOutlined /> },
      { path: '/technical/handover', name: 'Bàn giao', icon: <SolutionOutlined /> },
    ],
  },
  {
    path: '/service',
    name: 'Bảo hành và bảo trì',
    icon: <CustomerServiceOutlined />,
    children: [
      { path: '/service/elevators', name: 'Thang đang vận hành', icon: <HddOutlined /> },
      { path: '/service/plans', name: 'Kế hoạch bảo trì', icon: <CalendarOutlined /> },
      { path: '/service/schedule', name: 'Lịch bảo trì', icon: <ClockCircleOutlined /> },
      { path: '/service/maintenance', name: 'Phiếu bảo trì', icon: <ReconciliationOutlined /> },
      { path: '/service/incidents', name: 'Sự cố và sửa chữa', icon: <AlertOutlined /> },
      { path: '/service/parts', name: 'Linh kiện thay thế', icon: <ToolOutlined /> },
    ],
  },
  {
    path: '/accounting',
    name: 'Kế toán',
    icon: <DollarOutlined />,
    children: [
      { path: '/accounting/installments', name: 'Đợt thanh toán', icon: <WalletOutlined /> },
      { path: '/accounting/receivables', name: 'Công nợ phải thu', icon: <DollarOutlined /> },
      { path: '/accounting/revenue', name: 'Doanh thu', icon: <FundProjectionScreenOutlined /> },
      { path: '/accounting/costs', name: 'Chi phí dự án', icon: <FileTextOutlined /> },
      { path: '/accounting/costing', name: 'Giá thành', icon: <BankOutlined /> },
      { path: '/accounting/subcontractors', name: 'Thầu phụ', icon: <ContactsOutlined /> },
    ],
  },
  {
    path: '/hr',
    name: 'Nhân sự',
    icon: <TeamOutlined />,
    children: [
      { path: '/hr/employees', name: 'Nhân viên', icon: <UserOutlined /> },
      { path: '/hr/organization', name: 'Phòng ban và tổ công tác', icon: <ApartmentOutlined /> },
      { path: '/hr/policies', name: 'Nội quy', icon: <FileTextOutlined /> },
      { path: '/hr/training', name: 'Đào tạo', icon: <SafetyCertificateOutlined /> },
      { path: '/hr/certificates', name: 'Chứng chỉ', icon: <IdcardOutlined /> },
      { path: '/hr/payroll', name: 'Lương và chấm công', icon: <DollarOutlined /> },
    ],
  },
  {
    path: '/system',
    name: 'Hệ thống',
    icon: <SettingOutlined />,
    children: [
      {
        path: '/admin/users',
        name: 'Người dùng',
        icon: <TeamOutlined />,
        permission: 'user.manage',
      },
      { path: '/admin/roles', name: 'Vai trò và quyền', icon: <SafetyCertificateOutlined /> },
      { path: '/admin/catalogs', name: 'Danh mục dùng chung', icon: <FolderOpenOutlined /> },
      { path: '/admin/audit', name: 'Nhật ký hệ thống', icon: <AuditOutlined /> },
      { path: '/admin/settings', name: 'Cấu hình', icon: <SettingOutlined /> },
    ],
  },
];

function BrandLogo() {
  return (
    <span className='brand-logo' aria-hidden='true'>
      <VerticalAlignMiddleOutlined />
    </span>
  );
}

function filterRoutes(routes: ErpRoute[], me: Me): ErpRoute[] {
  return routes.flatMap((route) => {
    if (route.children) {
      const children = filterRoutes(route.children, me);
      return children.length > 0 ? [{ ...route, children }] : [];
    }

    if (!route.permission || me.permissions.includes(route.permission)) return [route];
    return [];
  });
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const loadCurrentUser = useCallback(() => {
    setLoadError('');
    api<Me>('/auth/me')
      .then(setMe)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Không tải được thông tin người dùng.';
        setLoadError(message);
      });
  }, []);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  const menuData = useMemo(() => (me ? filterRoutes(routeDefinitions, me) : []), [me]);

  if (loadError) {
    return (
      <div className='full-page-center'>
        <Alert
          type='error'
          showIcon
          message='Không thể tải giao diện ERP'
          description={loadError}
          action={<Button onClick={loadCurrentUser}>Thử lại</Button>}
        />
      </div>
    );
  }

  if (!me) {
    return (
      <div className='full-page-center app-loading-screen'>
        <Spin size='large' tip='Đang tải hệ thống...' />
      </div>
    );
  }

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    router.replace('/login');
  };

  return (
    <ProLayout
      title='Thang máy Miền Trung'
      logo={<BrandLogo />}
      layout='side'
      fixedHeader
      fixSiderbar
      siderWidth={276}
      collapsed={collapsed}
      onCollapse={setCollapsed}
      location={{ pathname }}
      route={{ path: '/', routes: menuData }}
      menu={{ type: 'sub' }}
      menuDataRender={() => menuData}
      contentStyle={{ padding: 0 }}
      pageTitleRender={false}
      breadcrumbRender={false}
      footerRender={false}
      menuItemRender={(item, dom) => {
        const route = item as ErpRoute;
        if (route.children || !route.path) return dom;
        return <Link href={route.path}>{dom}</Link>;
      }}
      headerContentRender={() => (
        <div className='header-search-wrap'>
          <Input
            className='global-search'
            prefix={<SearchOutlined />}
            placeholder='Tìm khách hàng, công việc, dự án...'
            onPressEnter={() => router.push('/customers')}
            suffix={<span className='search-shortcut'>Ctrl K</span>}
          />
        </div>
      )}
      actionsRender={() => [
        <Tooltip key='quick' title='Tạo nhanh đăng ký khách hàng'>
          <Button
            type='primary'
            className='header-quick-button'
            icon={<PlusOutlined />}
            onClick={() => router.push('/customers')}
          >
            Tạo nhanh
          </Button>
        </Tooltip>,
        <Tooltip key='notification' title='Thông báo'>
          <Badge dot offset={[-4, 5]}>
            <Button
              type='text'
              shape='circle'
              icon={<BellOutlined />}
              onClick={() => router.push('/notifications')}
            />
          </Badge>
        </Tooltip>,
        <Tooltip key='help' title='Trợ giúp và cấu hình'>
          <Button
            type='text'
            shape='circle'
            icon={<QuestionCircleOutlined />}
            onClick={() => router.push('/admin/settings')}
          />
        </Tooltip>,
      ]}
      avatarProps={{
        icon: <UserOutlined />,
        title: (
          <span className='avatar-title'>
            <b>{me.displayName}</b>
            <small>{me.department || 'Chưa phân phòng ban'}</small>
          </span>
        ),
        render: (_props, dom) => (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'account',
                  icon: <UserOutlined />,
                  label: 'Tài khoản của tôi',
                  onClick: () => router.push('/admin/users'),
                },
                {
                  key: 'notice',
                  icon: <NotificationOutlined />,
                  label: 'Thiết lập thông báo',
                  onClick: () => router.push('/admin/settings'),
                },
                { type: 'divider' },
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: 'Đăng xuất',
                  danger: true,
                  onClick: logout,
                },
              ],
            }}
          >
            <Space className='user-dropdown-trigger'>
              <Avatar className='user-avatar'>{me.displayName.charAt(0)}</Avatar>
              {dom}
            </Space>
          </Dropdown>
        ),
      }}
      token={{
        header: {
          colorBgHeader: '#ffffff',
          colorHeaderTitle: '#10233f',
          heightLayoutHeader: 64,
        },
        sider: {
          colorMenuBackground: '#071a32',
          colorTextMenu: 'rgba(255,255,255,.88)',
          colorTextMenuSelected: '#ffffff',
          colorBgMenuItemSelected: '#1677ff',
          colorBgMenuItemHover: 'rgba(255,255,255,.11)',
          colorMenuItemDivider: 'rgba(255,255,255,.1)',
          colorTextMenuTitle: 'rgba(255,255,255,.66)',
        },
        pageContainer: {
          paddingInlinePageContainerContent: 24,
          paddingBlockPageContainerContent: 20,
        },
      }}
    >
      <div className='erp-content'>{children}</div>
    </ProLayout>
  );
}
