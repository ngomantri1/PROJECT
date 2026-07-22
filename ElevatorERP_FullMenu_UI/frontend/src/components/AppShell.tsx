'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Dropdown,
  Grid,
  Spin,
  theme as antdTheme,
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
  CloseOutlined,
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
  DownOutlined,
  LogoutOutlined,
  MoonOutlined,
  NotificationOutlined,
  ProjectOutlined,
  ReconciliationOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  SolutionOutlined,
  SunOutlined,
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
import BrandMark from '@/components/BrandMark';
import { useThemeMode } from '@/components/AppProviders';
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
        path: '/business/customers',
        name: 'Khách hàng',
        icon: <CustomerServiceOutlined />,
        permission: 'customer.view',
      },
      {
        path: '/customers',
        name: 'Hồ sơ tư vấn',
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
      { path: '/admin/catalogs', name: 'Danh mục dùng chung', icon: <FolderOpenOutlined />, permission: 'role.manage' },
      { path: '/admin/audit', name: 'Nhật ký hệ thống', icon: <AuditOutlined /> },
      { path: '/admin/settings', name: 'Cấu hình', icon: <SettingOutlined /> },
    ],
  },
];

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
  const [openMenuKeys, setOpenMenuKeys] = useState<string[]>([]);
  const pathname = usePathname();
  const router = useRouter();
  const { isDark, toggleMode } = useThemeMode();
  const { token } = antdTheme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.xs === true && !screens.sm;

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
  const topLevelMenuKeys = useMemo(
    () => new Set(menuData.filter((item) => item.path && item.children?.length).map((item) => String(item.path))),
    [menuData]
  );

  useEffect(() => {
    if (!menuData.length || collapsed) return;
    const activeGroup = menuData.find((item) =>
      item.path && item.children?.some((child) => child.path && pathname.startsWith(String(child.path)))
    );
    if (activeGroup?.path) setOpenMenuKeys([String(activeGroup.path)]);
  }, [collapsed, menuData, pathname]);

  const handleMenuOpenChange = useCallback((keys: false | string[]) => {
    if (!keys) {
      setOpenMenuKeys([]);
      return;
    }

    const latestTopLevelKey = [...keys].reverse().find((key) => topLevelMenuKeys.has(key));
    setOpenMenuKeys(latestTopLevelKey ? [latestTopLevelKey] : keys);
  }, [topLevelMenuKeys]);

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

  const primaryRole = me.roles[0] || me.department || 'Chưa phân vai trò';
  const accountToolbarStyle = {
    '--account-bg': token.colorBgContainer,
    '--account-color': token.colorText,
    '--account-secondary': token.colorTextSecondary,
    '--account-border': token.colorBorderSecondary,
    '--account-hover': token.colorBgTextHover,
    '--account-radius': `${token.borderRadiusLG}px`,
  } as CSSProperties;

  return (
    <ProLayout
      title='Thang máy Miền Trung'
      logo={<BrandMark />}
      layout='side'
      fixedHeader
      fixSiderbar
      siderWidth={276}
      collapsed={collapsed}
      onCollapse={setCollapsed}
      collapsedButtonRender={(isSiderCollapsed, defaultDom) => {
        if (!isMobile || isSiderCollapsed) return defaultDom;
        return (
          <button
            type='button'
            className='mobile-sider-close-button'
            onClick={() => setCollapsed(true)}
            aria-label='Đóng menu điều hướng'
          >
            <CloseOutlined />
          </button>
        );
      }}
      location={{ pathname }}
      route={{ path: '/', routes: menuData }}
      menu={isMobile ? { type: 'sub' } : { type: 'sub' }}
      openKeys={isMobile || collapsed ? false : openMenuKeys}
      onOpenChange={handleMenuOpenChange}
      menuDataRender={() => menuData}
      contentStyle={{ padding: 0 }}
      pageTitleRender={false}
      breadcrumbRender={false}
      footerRender={false}
      menuItemRender={(item, dom) => {
        const route = item as ErpRoute;
        if (route.children || !route.path) return dom;
        return <Link href={route.path} onClick={() => isMobile && setCollapsed(true)}>{dom}</Link>;
      }}
      token={{
        header: {
          colorBgHeader: isDark ? '#12241b' : '#ffffff',
          colorHeaderTitle: isDark ? '#f3f8f4' : '#11351f',
          heightLayoutHeader: 64,
        },
        sider: {
          colorMenuBackground: isDark ? '#082016' : '#063b2a',
          colorTextMenu: 'rgba(255,255,255,.88)',
          colorTextMenuSelected: '#ffffff',
          colorBgMenuItemSelected: '#008848',
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
      <div className='erp-content'>
        <div className='erp-account-toolbar' style={accountToolbarStyle}>
          <Tooltip title='Thông báo'>
            <Badge dot>
              <Button
                type='text'
                shape='circle'
                className='shell-icon-button notification-button'
                icon={<BellOutlined />}
                onClick={() => router.push('/notifications')}
                aria-label='Thông báo'
              />
            </Badge>
          </Tooltip>
          <Dropdown
            trigger={['click']}
            placement='bottomRight'
            menu={{
              items: [
                {
                  key: 'identity',
                  label: (
                    <div className='account-menu-summary'>
                      <Avatar size={42} className='user-avatar'>
                        {me.displayName.charAt(0)}
                      </Avatar>
                      <div className='account-menu-copy'>
                        <b>{me.displayName}</b>
                        <span>{me.department || 'Chưa phân phòng ban'}</span>
                        {me.roles.length > 0 && (
                          <small>{me.roles.join(', ')}</small>
                        )}
                      </div>
                    </div>
                  ),
                },
                { type: 'divider' },
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
                {
                  key: 'theme',
                  icon: isDark ? <SunOutlined /> : <MoonOutlined />,
                  label: isDark ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối',
                  onClick: toggleMode,
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
            <button className='account-trigger' type='button' aria-label='Mở menu tài khoản'>
              <Avatar size={36} className='user-avatar'>
                {me.displayName.charAt(0)}
              </Avatar>
              <span className='account-trigger-copy'>
                <b title={me.displayName}>{me.displayName}</b>
                <small title={primaryRole}>{primaryRole}</small>
              </span>
              <DownOutlined className='account-trigger-arrow' />
            </button>
          </Dropdown>
        </div>
        {children}
      </div>
    </ProLayout>
  );
}
