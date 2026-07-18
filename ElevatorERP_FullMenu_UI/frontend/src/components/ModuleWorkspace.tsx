'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Col,
  Descriptions,
  Drawer,
  Dropdown,
  Input,
  Popconfirm,
  Progress,
  Result,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EllipsisOutlined,
  EyeOutlined,
  FileTextOutlined,
  FilterOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  DrawerForm,
  PageContainer,
  ProCard,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import dayjs from 'dayjs';
import { usePathname, useRouter } from 'next/navigation';
import { exportCsv } from '@/lib/exportCsv';

type StatusOption = {
  value: string;
  label: string;
  color: string;
};

type WorkspaceConfig = {
  title: string;
  subtitle: string;
  entity: string;
  prefix: string;
  statuses: StatusOption[];
  showAmount?: boolean;
  showProgress?: boolean;
  createEnabled?: boolean;
};

type WorkspaceRow = {
  id: string;
  code: string;
  title: string;
  related: string;
  owner: string;
  status: string;
  date: string;
  amount?: number;
  progress?: number;
  priority: string;
  notes?: string;
};

type WorkspaceForm = Omit<WorkspaceRow, 'id'>;

const textSorter = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
const priorityRank: Record<string, number> = {
  Cao: 1,
  'Trung bình': 2,
  Thấp: 3,
};

const basicStatuses: StatusOption[] = [
  { value: 'NEW', label: 'Mới tạo', color: 'blue' },
  { value: 'IN_PROGRESS', label: 'Đang thực hiện', color: 'processing' },
  { value: 'WAITING', label: 'Chờ xử lý', color: 'gold' },
  { value: 'COMPLETED', label: 'Hoàn thành', color: 'green' },
];

const approvalStatuses: StatusOption[] = [
  { value: 'DRAFT', label: 'Nháp', color: 'default' },
  { value: 'PENDING', label: 'Chờ duyệt', color: 'gold' },
  { value: 'APPROVED', label: 'Đã duyệt', color: 'green' },
  { value: 'REJECTED', label: 'Từ chối', color: 'red' },
];

const projectStatuses: StatusOption[] = [
  { value: 'PREPARING', label: 'Chuẩn bị', color: 'blue' },
  { value: 'EXECUTING', label: 'Đang triển khai', color: 'processing' },
  { value: 'BLOCKED', label: 'Đang vướng', color: 'orange' },
  { value: 'COMPLETED', label: 'Hoàn thành', color: 'green' },
];

const incidentStatuses: StatusOption[] = [
  { value: 'OPEN', label: 'Mới tiếp nhận', color: 'red' },
  { value: 'ASSIGNED', label: 'Đã phân công', color: 'blue' },
  { value: 'PROCESSING', label: 'Đang xử lý', color: 'processing' },
  { value: 'CLOSED', label: 'Đã khôi phục', color: 'green' },
];

const financeStatuses: StatusOption[] = [
  { value: 'UPCOMING', label: 'Sắp đến hạn', color: 'blue' },
  { value: 'DUE', label: 'Đến hạn', color: 'gold' },
  { value: 'OVERDUE', label: 'Quá hạn', color: 'red' },
  { value: 'PAID', label: 'Đã xác nhận', color: 'green' },
];

const makeConfig = (
  title: string,
  subtitle: string,
  entity: string,
  prefix: string,
  statuses: StatusOption[] = basicStatuses,
  extra: Partial<WorkspaceConfig> = {},
): WorkspaceConfig => ({ title, subtitle, entity, prefix, statuses, createEnabled: true, ...extra });

const workspaceConfigs: Record<string, WorkspaceConfig> = {
  '/work': makeConfig('Công việc của tôi', 'Theo dõi công việc được giao, hạn hoàn thành và mức độ ưu tiên', 'công việc', 'CV', projectStatuses, { showProgress: true }),
  '/notifications': makeConfig('Thông báo', 'Tập trung các cảnh báo, nhắc việc và thay đổi quan trọng trong hệ thống', 'thông báo', 'TB', basicStatuses),

  '/quotations': makeConfig('Báo giá', 'Quản lý báo giá nhiều phiên bản, chiết khấu và quy trình phê duyệt', 'báo giá', 'BG', approvalStatuses, { showAmount: true }),
  '/contracts': makeConfig('Hợp đồng', 'Theo dõi hợp đồng, phụ lục, giá trị và trạng thái thực hiện', 'hợp đồng', 'HD', approvalStatuses, { showAmount: true }),

  '/projects/list': makeConfig('Danh sách dự án', 'Quản lý dự án trung tâm từ hợp đồng đến bàn giao', 'dự án', 'DA', projectStatuses, { showAmount: true, showProgress: true }),
  '/elevators': makeConfig('Hồ sơ thang máy', 'Quản lý hồ sơ nhận dạng, thông số và vòng đời từng thiết bị', 'thang máy', 'TM', projectStatuses, { showProgress: true }),
  '/project-progress': makeConfig('Tiến độ dự án', 'Theo dõi tiến độ theo giai đoạn và trọng số cấu hình', 'tiến độ', 'TD', projectStatuses, { showProgress: true }),
  '/project-tasks': makeConfig('Công việc dự án', 'Giao việc, phối hợp, kiểm tra và xác nhận kết quả', 'công việc', 'CVDA', projectStatuses, { showProgress: true }),
  '/site-journals': makeConfig('Nhật ký công trường', 'Ghi nhận nhân sự, khối lượng, vật tư và hình ảnh thi công', 'nhật ký', 'NK', approvalStatuses),
  '/project-members': makeConfig('Nhân sự dự án', 'Quản lý thành viên, vai trò và thời gian tham gia dự án', 'phân công', 'NSDA', basicStatuses),
  '/project-documents': makeConfig('Tài liệu dự án', 'Tập trung hợp đồng, bản vẽ, biên bản và hồ sơ kỹ thuật', 'tài liệu', 'TL', approvalStatuses),

  '/technical/schedule': makeConfig('Lịch thi công', 'Theo dõi lịch theo dự án, tổ kỹ thuật và nhân viên', 'lịch thi công', 'LTC', projectStatuses),
  '/technical/kcs': makeConfig('KCS – Kiểm tra chất lượng', 'Quản lý checklist, lỗi chất lượng và kết quả kiểm tra lại', 'phiếu KCS', 'KCS', approvalStatuses, { showProgress: true }),
  '/technical/inspection': makeConfig('Kiểm định', 'Quản lý lịch đăng ký, kết quả và chứng nhận kiểm định', 'hồ sơ kiểm định', 'KD', approvalStatuses),
  '/technical/acceptance': makeConfig('Nghiệm thu', 'Theo dõi nghiệm thu nội bộ, khách hàng và các tồn tại', 'biên bản nghiệm thu', 'NT', approvalStatuses),
  '/technical/handover': makeConfig('Bàn giao', 'Quản lý hồ sơ bàn giao, kích hoạt bảo hành và vận hành', 'hồ sơ bàn giao', 'BGIAO', approvalStatuses),

  '/service/elevators': makeConfig('Thang đang vận hành', 'Theo dõi tình trạng vận hành, bảo hành và chu kỳ bảo trì', 'thang vận hành', 'TVH', projectStatuses),
  '/service/plans': makeConfig('Kế hoạch bảo trì', 'Thiết lập chu kỳ, tổ phụ trách và checklist bảo trì', 'kế hoạch', 'KHBT', basicStatuses),
  '/service/schedule': makeConfig('Lịch bảo trì', 'Quản lý lịch bảo trì định kỳ và tình trạng thực hiện', 'lịch bảo trì', 'LBT', projectStatuses),
  '/service/maintenance': makeConfig('Phiếu bảo trì', 'Ghi nhận checklist, hiện trạng, linh kiện và xác nhận khách hàng', 'phiếu bảo trì', 'PBT', approvalStatuses),
  '/service/incidents': makeConfig('Sự cố và sửa chữa', 'Tiếp nhận, phân công, xử lý và xác nhận khôi phục sự cố', 'sự cố', 'SC', incidentStatuses),
  '/service/parts': makeConfig('Linh kiện thay thế', 'Theo dõi linh kiện sử dụng, nguồn cấp và lịch sử thay thế', 'linh kiện', 'LK', basicStatuses, { showAmount: true }),

  '/accounting/installments': makeConfig('Đợt thanh toán', 'Quản lý điều kiện, thời hạn và xác nhận từng đợt thanh toán', 'đợt thanh toán', 'DTT', financeStatuses, { showAmount: true }),
  '/accounting/receivables': makeConfig('Công nợ phải thu', 'Theo dõi phải thu, đã thu, còn lại và công nợ quá hạn', 'khoản phải thu', 'PT', financeStatuses, { showAmount: true }),
  '/accounting/revenue': makeConfig('Doanh thu', 'Tổng hợp doanh thu đã xác nhận theo hợp đồng và thời gian', 'khoản doanh thu', 'DT', financeStatuses, { showAmount: true }),
  '/accounting/costs': makeConfig('Chi phí dự án', 'Theo dõi chi phí cơ bản, chứng từ và người phê duyệt', 'chi phí', 'CP', approvalStatuses, { showAmount: true }),
  '/accounting/costing': makeConfig('Giá thành', 'Tổng hợp giá thành theo dự án và từng thang máy', 'bảng giá thành', 'GT', approvalStatuses, { showAmount: true }),
  '/accounting/subcontractors': makeConfig('Thầu phụ', 'Quản lý đơn vị thầu phụ, phạm vi công việc và thanh toán', 'thầu phụ', 'TP', approvalStatuses, { showAmount: true }),

  '/hr/employees': makeConfig('Nhân viên', 'Quản lý hồ sơ nhân viên, vị trí, phòng ban và trạng thái làm việc', 'nhân viên', 'NV', basicStatuses),
  '/hr/organization': makeConfig('Phòng ban và tổ công tác', 'Quản lý cơ cấu tổ chức và người phụ trách', 'đơn vị', 'DV', basicStatuses),
  '/hr/policies': makeConfig('Nội quy', 'Quản lý nội quy, quy trình và tài liệu áp dụng nội bộ', 'nội quy', 'NQ', approvalStatuses),
  '/hr/training': makeConfig('Đào tạo', 'Theo dõi kế hoạch, khóa học và kết quả đào tạo', 'khóa đào tạo', 'DTao', basicStatuses),
  '/hr/certificates': makeConfig('Chứng chỉ', 'Quản lý chứng chỉ chuyên môn và thời hạn hiệu lực', 'chứng chỉ', 'CC', basicStatuses),
  '/hr/payroll': makeConfig('Lương và chấm công', 'Tổng hợp kỳ công, dữ liệu lương và trạng thái phê duyệt', 'bảng lương', 'BL', approvalStatuses, { showAmount: true }),

  '/admin/roles': makeConfig('Vai trò và quyền', 'Cấu hình vai trò, quyền chức năng và phạm vi dữ liệu', 'vai trò', 'ROLE', approvalStatuses),
  '/admin/catalogs': makeConfig('Danh mục dùng chung', 'Quản lý loại thang, trạng thái, nguồn khách và danh mục hệ thống', 'danh mục', 'DM', basicStatuses),
  '/admin/audit': makeConfig('Nhật ký hệ thống', 'Tra cứu thao tác, người thực hiện và dữ liệu thay đổi', 'nhật ký hệ thống', 'AUD', basicStatuses, { createEnabled: false }),
  '/admin/settings': makeConfig('Cấu hình', 'Thiết lập tham số vận hành, thông báo và cấu hình chung', 'cấu hình', 'CFG', approvalStatuses),
};

const companyNames = ['Công ty Phú Gia', 'Công ty Hòa Bình', 'Khách sạn Lam Sơn', 'Tòa nhà Minh Anh', 'Trung tâm Hoàng Gia', 'Chung cư An Phát'];
const projectNames = ['Dự án Phú Gia Tower', 'Dự án Khách sạn Lam Sơn', 'Dự án Bệnh viện An Việt', 'Dự án Chung cư An Phát', 'Dự án Nhà máy Đông Sơn', 'Dự án Trung tâm Hoàng Gia'];
const elevatorNames = ['Thang khách TM-001', 'Thang tải hàng TM-002', 'Thang bệnh viện TM-003', 'Thang gia đình TM-004', 'Thang khách TM-005', 'Thang thực phẩm TM-006'];
const peopleNames = ['Lê Văn Hoàng', 'Lưu Sỹ Dương', 'Nguyễn Văn Nam', 'Trần Minh Đức', 'Phạm Anh Tuấn', 'Hoàng Thị Lan'];
const owners = ['Lê Văn Hoàng', 'Lưu Sỹ Dương', 'Nguyễn Văn Nam', 'Trần Minh Đức'];

function seedRows(pathname: string, config: WorkspaceConfig): WorkspaceRow[] {
  let titles = companyNames;
  if (pathname.includes('/projects') || pathname.includes('project-')) titles = projectNames;
  if (pathname.includes('elevator') || pathname.includes('/technical') || pathname.includes('/service')) titles = elevatorNames;
  if (pathname.includes('/hr/')) titles = peopleNames;

  return titles.map((name, index) => ({
    id: `${config.prefix}-${index + 1}`,
    code: `${config.prefix}-2026-${String(index + 1).padStart(4, '0')}`,
    title: pathname.includes('/hr/employees') ? name : `${config.entity.charAt(0).toUpperCase()}${config.entity.slice(1)} · ${name}`,
    related: pathname.includes('/projects') ? companyNames[index] : projectNames[index],
    owner: owners[index % owners.length],
    status: config.statuses[index % config.statuses.length].value,
    date: dayjs().add(index - 2, 'day').format('YYYY-MM-DD'),
    amount: config.showAmount ? 120_000_000 + index * 85_000_000 : undefined,
    progress: config.showProgress ? 18 + index * 14 : undefined,
    priority: index % 3 === 0 ? 'Cao' : index % 3 === 1 ? 'Trung bình' : 'Thấp',
    notes: 'Dữ liệu phục vụ kiểm thử luồng nghiệp vụ trên máy lập trình.',
  }));
}

function statusMeta(config: WorkspaceConfig, value: string) {
  return config.statuses.find((item) => item.value === value) ?? { value, label: value, color: 'default' };
}

function formatMoney(value?: number) {
  if (value === undefined) return '—';
  return `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
}

export default function ModuleWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const config = workspaceConfigs[pathname];
  const [rows, setRows] = useState<WorkspaceRow[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>();
  const [selected, setSelected] = useState<WorkspaceRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [showDemoBanner, setShowDemoBanner] = useState(false);

  const storageKey = `elevator-erp:workspace:${pathname}`;

  useEffect(() => {
    if (!config) return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try {
        setRows(JSON.parse(stored) as WorkspaceRow[]);
        return;
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
    setRows(seedRows(pathname, config));
  }, [config, pathname, storageKey]);

  useEffect(() => {
    if (!config || process.env.NODE_ENV === 'production') return;
    setShowDemoBanner(window.sessionStorage.getItem('elevator-erp:hide-demo-banner') !== '1');
  }, [config]);

  const persist = (nextRows: WorkspaceRow[]) => {
    setRows(nextRows);
    window.localStorage.setItem(storageKey, JSON.stringify(nextRows));
  };

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    return rows.filter((item) => {
      const matchesSearch = !query || [item.code, item.title, item.related, item.owner]
        .some((value) => value.toLocaleLowerCase('vi').includes(query));
      const matchesStatus = !status || item.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, status]);

  if (!config) {
    return (
      <Result
        status='404'
        title='Không tìm thấy chức năng'
        subTitle='Đường dẫn này chưa được đăng ký trong cấu hình menu ERP.'
        extra={<Button type='primary' onClick={() => router.push('/')}>Về tổng quan</Button>}
      />
    );
  }

  const completedValues = new Set(['COMPLETED', 'APPROVED', 'PAID', 'CLOSED']);
  const waitingValues = new Set(['WAITING', 'PENDING', 'DUE', 'OVERDUE', 'BLOCKED', 'OPEN']);
  const completed = rows.filter((item) => completedValues.has(item.status)).length;
  const waiting = rows.filter((item) => waitingValues.has(item.status)).length;
  const inProgress = Math.max(rows.length - completed - waiting, 0);

  const removeRow = (id: string) => {
    persist(rows.filter((item) => item.id !== id));
    message.success(`Đã xóa ${config.entity}`);
  };

  const createRow = async (values: WorkspaceForm) => {
    const next: WorkspaceRow = {
      ...values,
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
      code: values.code || `${config.prefix}-2026-${String(rows.length + 1).padStart(4, '0')}`,
      date: dayjs(values.date).format('YYYY-MM-DD'),
      amount: config.showAmount ? Number(values.amount ?? 0) : undefined,
      progress: config.showProgress ? Number(values.progress ?? 0) : undefined,
    };
    persist([next, ...rows]);
    message.success(`Đã tạo ${config.entity}`);
    setCreateOpen(false);
    return true;
  };

  const resetData = () => {
    const seeded = seedRows(pathname, config);
    persist(seeded);
    setSearch('');
    setStatus(undefined);
    message.success('Đã khôi phục dữ liệu mẫu');
  };

  const resetFilters = () => {
    setSearch('');
    setStatus(undefined);
  };

  const hideDemoBanner = () => {
    setShowDemoBanner(false);
    window.sessionStorage.setItem('elevator-erp:hide-demo-banner', '1');
  };

  const exportRows = () => {
    exportCsv(`${config.prefix.toLowerCase()}-danh-sach-${dayjs().format('YYYYMMDD-HHmm')}`, filteredRows, [
      { header: 'Mã', value: (item) => item.code },
      { header: config.entity.charAt(0).toUpperCase() + config.entity.slice(1), value: (item) => item.title },
      { header: 'Khách hàng / Dự án liên quan', value: (item) => item.related },
      { header: 'Phụ trách', value: (item) => item.owner },
      { header: 'Trạng thái', value: (item) => statusMeta(config, item.status).label },
      { header: 'Ưu tiên', value: (item) => item.priority },
      { header: 'Ngày dự kiến', value: (item) => dayjs(item.date).format('DD/MM/YYYY') },
      { header: 'Giá trị', value: (item) => config.showAmount ? item.amount : undefined },
      { header: 'Tiến độ', value: (item) => config.showProgress ? `${item.progress ?? 0}%` : undefined },
      { header: 'Ghi chú', value: (item) => item.notes },
    ]);
  };

  const columns: ProColumns<WorkspaceRow>[] = [
    {
      title: 'Mã',
      dataIndex: 'code',
      width: 145,
      fixed: 'left',
      sorter: (a, b) => textSorter.compare(a.code, b.code),
      render: (value) => <Typography.Text copyable={{ text: String(value) }} strong>{String(value)}</Typography.Text>,
    },
    {
      title: config.entity.charAt(0).toUpperCase() + config.entity.slice(1),
      dataIndex: 'title',
      width: 280,
      sorter: (a, b) => textSorter.compare(a.title, b.title),
      render: (_, item) => (
        <Space>
          <Avatar className='customer-avatar'>{item.title.charAt(0)}</Avatar>
          <span>
            <b className='table-primary-text'>{item.title}</b>
            <small className='table-secondary-text'>{item.related}</small>
          </span>
        </Space>
      ),
    },
    { title: 'Phụ trách', dataIndex: 'owner', width: 170, sorter: (a, b) => textSorter.compare(a.owner, b.owner) },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 150,
      sorter: (a, b) => textSorter.compare(
        statusMeta(config, a.status).label,
        statusMeta(config, b.status).label,
      ),
      render: (_, item) => {
        const meta = statusMeta(config, item.status);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: 'Ưu tiên',
      dataIndex: 'priority',
      width: 110,
      sorter: (a, b) => (priorityRank[a.priority] ?? 99) - (priorityRank[b.priority] ?? 99),
      render: (value) => {
        const text = String(value);
        return <Tag color={text === 'Cao' ? 'red' : text === 'Trung bình' ? 'gold' : 'default'}>{text}</Tag>;
      },
    },
    {
      title: 'Ngày dự kiến',
      dataIndex: 'date',
      width: 130,
      sorter: (a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf(),
      render: (value) => dayjs(String(value)).format('DD/MM/YYYY'),
    },
  ];

  if (config.showAmount) {
    columns.push({
      title: 'Giá trị',
      dataIndex: 'amount',
      width: 170,
      align: 'right',
      sorter: (a, b) => Number(a.amount ?? 0) - Number(b.amount ?? 0),
      render: (value) => <b>{formatMoney(Number(value))}</b>,
    });
  }

  if (config.showProgress) {
    columns.push({
      title: 'Tiến độ',
      dataIndex: 'progress',
      width: 170,
      sorter: (a, b) => Number(a.progress ?? 0) - Number(b.progress ?? 0),
      render: (value) => <Progress percent={Number(value ?? 0)} size='small' />,
    });
  }

  columns.push({
    title: 'Thao tác',
    valueType: 'option',
    width: 90,
    align: 'center',
    render: (_, item) => [
      <Space key='actions' size={2} className='table-actions table-actions-center'>
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              {
                key: 'view',
                icon: <EyeOutlined />,
                label: 'Xem chi tiết',
                onClick: () => setSelected(item),
              },
              {
                key: 'complete',
                icon: <CheckCircleOutlined />,
                label: 'Đánh dấu hoàn thành',
                onClick: () => {
                  const finalStatus = config.statuses.find((option) => completedValues.has(option.value))
                    ?? config.statuses[config.statuses.length - 1];
                  persist(rows.map((row) => row.id === item.id ? { ...row, status: finalStatus.value, progress: config.showProgress ? 100 : row.progress } : row));
                  message.success('Đã cập nhật trạng thái');
                },
              },
              { type: 'divider' },
              {
                key: 'delete',
                danger: true,
                icon: <DeleteOutlined />,
                label: (
                  <Popconfirm
                    title={`Xóa ${config.entity}?`}
                    description='Thao tác này chỉ ảnh hưởng dữ liệu trên máy lập trình.'
                    onConfirm={() => removeRow(item.id)}
                    okText='Xóa'
                    cancelText='Hủy'
                  >
                    <span onClick={(event) => event.stopPropagation()}>Xóa</span>
                  </Popconfirm>
                ),
              },
            ],
          }}
        >
          <Button type='text' className='table-action-button' icon={<EllipsisOutlined />} />
        </Dropdown>
      </Space>,
    ],
  });

  return (
    <PageContainer
        className='erp-page-container'
        header={{
          title: (
            <div className='page-title-stack'>
              <Typography.Title level={3}>{config.title}</Typography.Title>
              <Typography.Text>{config.subtitle}</Typography.Text>
            </div>
          ),
          extra: config.createEnabled ? (
            <Button type='primary' icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              Thêm {config.entity}
            </Button>
          ) : undefined,
          breadcrumb: {},
        }}
      >
        {showDemoBanner && (
          <Alert
            className='section-gap demo-data-banner'
            type='warning'
            showIcon
            closable
            onClose={hideDemoBanner}
            message='Đang sử dụng dữ liệu mô phỏng - dữ liệu chưa được lưu vào PostgreSQL.'
          />
        )}

        <Row gutter={[16, 16]}>
          {[
            { label: `Tổng ${config.entity}`, value: rows.length, icon: <FileTextOutlined />, tone: 'blue' },
            { label: 'Đang xử lý', value: inProgress, icon: <ClockCircleOutlined />, tone: 'cyan' },
            { label: 'Cần chú ý', value: waiting, icon: <FilterOutlined />, tone: 'orange' },
            { label: 'Hoàn thành', value: completed, icon: <CheckCircleOutlined />, tone: 'green' },
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

        <ProCard className='section-gap filter-card'>
          <div className='filter-row'>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              prefix={<SearchOutlined />}
              placeholder={`Tìm mã, tên ${config.entity}, khách hàng hoặc người phụ trách...`}
              allowClear
              className='filter-search'
            />
            <Select
              value={status}
              onChange={setStatus}
              allowClear
              placeholder='Tất cả trạng thái'
              className='filter-select'
              options={config.statuses}
            />
            <Button onClick={resetFilters}>Đặt lại</Button>
            <Button type='primary' icon={<FilterOutlined />}>Áp dụng</Button>
            <Button icon={<DownloadOutlined />} onClick={exportRows}>Xuất CSV</Button>
          </div>
        </ProCard>

        <div className='desktop-table section-gap'>
          <ProTable<WorkspaceRow>
            rowKey='id'
            dataSource={filteredRows}
            columns={columns}
            search={false}
            cardBordered
            headerTitle={`Danh sách ${config.entity}`}
            options={{ density: true, fullScreen: true, reload: resetData }}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${total} bản ghi` }}
            scroll={{ x: 1180 }}
            onRow={(record) => ({ onDoubleClick: () => setSelected(record) })}
          />
        </div>

        <div className='mobile-card-list section-gap'>
          <Space direction='vertical' size={12} style={{ width: '100%' }}>
            {filteredRows.map((item) => {
              const meta = statusMeta(config, item.status);
              return (
                <ProCard key={item.id} className='mobile-record-card' onClick={() => setSelected(item)}>
                  <Space align='start' style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space align='start'>
                      <Avatar className='customer-avatar'>{item.title.charAt(0)}</Avatar>
                      <span>
                        <b className='table-primary-text'>{item.title}</b>
                        <small className='table-secondary-text'>{item.code}</small>
                      </span>
                    </Space>
                    <Tag color={meta.color}>{meta.label}</Tag>
                  </Space>
                  <Descriptions size='small' column={1} className='mobile-descriptions'>
                    <Descriptions.Item label='Liên quan'>{item.related}</Descriptions.Item>
                    <Descriptions.Item label='Phụ trách'>{item.owner}</Descriptions.Item>
                    <Descriptions.Item label='Ngày'>{dayjs(item.date).format('DD/MM/YYYY')}</Descriptions.Item>
                    {config.showAmount && <Descriptions.Item label='Giá trị'>{formatMoney(item.amount)}</Descriptions.Item>}
                  </Descriptions>
                </ProCard>
              );
            })}
          </Space>
        </div>

        {config.createEnabled && (
          <DrawerForm<WorkspaceForm>
            title={`Thêm ${config.entity}`}
            width={560}
            open={createOpen}
            onOpenChange={setCreateOpen}
            onFinish={createRow}
            initialValues={{
              status: config.statuses[0].value,
              owner: owners[0],
              date: dayjs().format('YYYY-MM-DD'),
              priority: 'Trung bình',
              progress: 0,
            }}
            drawerProps={{ destroyOnClose: true }}
          >
            <ProFormText
              name='code'
              label='Mã hồ sơ'
              placeholder='Để trống để hệ thống tự sinh mã'
            />
            <ProFormText
              name='title'
              label={`Tên ${config.entity}`}
              rules={[{ required: true, message: `Nhập tên ${config.entity}` }]}
            />
            <ProFormText name='related' label='Khách hàng / Dự án liên quan' rules={[{ required: true }]} />
            <Row gutter={16}>
              <Col span={12}>
                <ProFormSelect
                  name='owner'
                  label='Người phụ trách'
                  options={owners.map((owner) => ({ value: owner, label: owner }))}
                  rules={[{ required: true }]}
                />
              </Col>
              <Col span={12}>
                <ProFormSelect
                  name='status'
                  label='Trạng thái'
                  options={config.statuses}
                  rules={[{ required: true }]}
                />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <ProFormDatePicker name='date' label='Ngày dự kiến' width='md' rules={[{ required: true }]} />
              </Col>
              <Col span={12}>
                <ProFormSelect
                  name='priority'
                  label='Mức ưu tiên'
                  options={['Cao', 'Trung bình', 'Thấp'].map((value) => ({ value, label: value }))}
                  rules={[{ required: true }]}
                />
              </Col>
            </Row>
            {config.showAmount && (
              <ProFormDigit name='amount' label='Giá trị' min={0} fieldProps={{ addonAfter: 'VNĐ' }} />
            )}
            {config.showProgress && (
              <ProFormDigit name='progress' label='Tiến độ' min={0} max={100} fieldProps={{ addonAfter: '%' }} />
            )}
            <ProFormTextArea name='notes' label='Ghi chú' fieldProps={{ rows: 4 }} />
          </DrawerForm>
        )}

        <Drawer
          title={selected ? `${selected.code} · ${selected.title}` : 'Chi tiết'}
          width={560}
          open={Boolean(selected)}
          onClose={() => setSelected(null)}
          extra={<Button icon={<EditOutlined />}>Chỉnh sửa</Button>}
        >
          {selected && (
            <>
              <Descriptions bordered column={1} size='middle'>
                <Descriptions.Item label='Mã'>{selected.code}</Descriptions.Item>
                <Descriptions.Item label={`Tên ${config.entity}`}>{selected.title}</Descriptions.Item>
                <Descriptions.Item label='Khách hàng / Dự án'>{selected.related}</Descriptions.Item>
                <Descriptions.Item label='Người phụ trách'>{selected.owner}</Descriptions.Item>
                <Descriptions.Item label='Trạng thái'>
                  <Tag color={statusMeta(config, selected.status).color}>{statusMeta(config, selected.status).label}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label='Mức ưu tiên'>{selected.priority}</Descriptions.Item>
                <Descriptions.Item label='Ngày dự kiến'>{dayjs(selected.date).format('DD/MM/YYYY')}</Descriptions.Item>
                {config.showAmount && <Descriptions.Item label='Giá trị'>{formatMoney(selected.amount)}</Descriptions.Item>}
                {config.showProgress && <Descriptions.Item label='Tiến độ'><Progress percent={selected.progress ?? 0} /></Descriptions.Item>}
              </Descriptions>
              <ProCard title='Ghi chú' className='section-gap'>
                <Typography.Paragraph>{selected.notes || 'Chưa có ghi chú.'}</Typography.Paragraph>
              </ProCard>
            </>
          )}
        </Drawer>
    </PageContainer>
  );
}
