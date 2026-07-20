'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Col,
  Empty,
  List,
  Progress,
  Row,
  Space,
  Steps,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CustomerServiceOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  ProjectOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { PageContainer, ProCard, StatisticCard } from '@ant-design/pro-components';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type DashboardData = {
  totalCustomers: number;
  newCustomers: number;
  totalCare: number;
  overdueCare: number;
  upcomingCare: number;
  completedCare: number;
  sourceStats: { name: string; value: number }[];
};

const sourceColors = ['#008848', '#12a05a', '#0f766e', '#f6a21a', '#7c3aed'];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    api<DashboardData>('/dashboard')
      .then(setData)
      .catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : 'Không tải được dữ liệu tổng quan.'),
      );
  }, []);

  const completedPercent = data?.totalCare
    ? Math.round((data.completedCare / data.totalCare) * 100)
    : 0;

  const maxSource = useMemo(
    () => Math.max(...(data?.sourceStats.map((item) => item.value) ?? [1]), 1),
    [data],
  );

  return (
    <PageContainer
        className='erp-page-container'
        header={{
          title: 'Tổng quan điều hành',
          subTitle: 'Theo dõi nhanh hoạt động kinh doanh và chăm sóc khách hàng',
          breadcrumb: {},
        }}
      >
        {error && <Alert type='error' showIcon message={error} className='section-gap' />}

        <ProCard className='welcome-panel' bordered={false}>
          <div className='welcome-copy'>
            <Tag className='welcome-tag' color='processing'>ERP NỘI BỘ · THANG MÁY MIỀN TRUNG</Tag>
            <Typography.Title level={2}>Chào mừng trở lại 👋</Typography.Title>
            <Typography.Paragraph>
              Quản lý xuyên suốt từ đăng ký khách hàng, báo giá, hợp đồng, dự án, thi công,
              kiểm tra chất lượng đến bàn giao, bảo hành và bảo trì.
            </Typography.Paragraph>
            <Space wrap>
              <Button type='primary' onClick={() => router.push('/customers')}>
                Quản lý khách hàng <ArrowRightOutlined />
              </Button>
              <Button onClick={() => router.push('/care')}>Lịch chăm sóc</Button>
            </Space>
          </div>
          <div className='welcome-visual' aria-hidden='true'>
            <div className='elevator-illustration'>
              <div className='elevator-floor floor-top'>TẦNG 08</div>
              <div className='elevator-door'>
                <span />
                <span />
              </div>
              <div className='elevator-status'>ONLINE</div>
            </div>
          </div>
        </ProCard>

        <Row gutter={[16, 16]} className='section-gap dashboard-kpi-row'>
          <Col xs={12} sm={12} xl={6}>
            <StatisticCard
              className='stat-card stat-blue'
              loading={!data && !error}
              statistic={{
                title: 'Tổng khách hàng',
                value: data?.totalCustomers ?? 0,
                icon: <span className='stat-icon'><TeamOutlined /></span>,
                description: <span className='kpi-description' data-mobile='Đang quản lý'><RiseOutlined /> Dữ liệu đang quản lý</span>,
              }}
            />
          </Col>
          <Col xs={12} sm={12} xl={6}>
            <StatisticCard
              className='stat-card stat-cyan'
              loading={!data && !error}
              statistic={{
                title: 'Khách mới tháng này',
                value: data?.newCustomers ?? 0,
                icon: <span className='stat-icon'><UserAddOutlined /></span>,
                description: <span className='kpi-description' data-mobile='Cần chăm sóc'>Cần được chăm sóc đúng hạn</span>,
              }}
            />
          </Col>
          <Col xs={12} sm={12} xl={6}>
            <StatisticCard
              className='stat-card stat-violet'
              loading={!data && !error}
              statistic={{
                title: 'Lịch chăm sóc sắp tới',
                value: data?.upcomingCare ?? 0,
                icon: <span className='stat-icon'><ClockCircleOutlined /></span>,
                description: <span className='kpi-description' data-mobile='Sắp tới'>{data?.completedCare ?? 0} lịch đã hoàn thành</span>,
              }}
            />
          </Col>
          <Col xs={12} sm={12} xl={6}>
            <StatisticCard
              className='stat-card stat-orange'
              loading={!data && !error}
              statistic={{
                title: 'Công việc quá hạn',
                value: data?.overdueCare ?? 0,
                icon: <span className='stat-icon'><ExclamationCircleOutlined /></span>,
                description: <span className='kpi-description' data-mobile='Ưu tiên'>Cần ưu tiên xử lý ngay</span>,
              }}
            />
          </Col>
        </Row>

        <Row gutter={[16, 16]} className='section-gap'>
          <Col xs={24} xl={15}>
            <ProCard title='Hiệu suất chăm sóc khách hàng' extra={<Tag color='green'>Tháng hiện tại</Tag>}>
              <div className='performance-layout'>
                <div className='performance-ring'>
                  <Progress
                    type='dashboard'
                    percent={completedPercent}
                    size={176}
                    strokeWidth={10}
                    trailColor='#edf5ed'
                    format={(percent) => (
                      <div>
                        <b>{percent}%</b>
                        <small>Hoàn thành</small>
                      </div>
                    )}
                  />
                </div>
                <div className='performance-detail'>
                  {[
                    {
                      icon: <CheckCircleOutlined />,
                      label: 'Đã hoàn thành',
                      value: data?.completedCare ?? 0,
                      tone: 'success',
                    },
                    {
                      icon: <ClockCircleOutlined />,
                      label: 'Sắp tới',
                      value: data?.upcomingCare ?? 0,
                      tone: 'primary',
                    },
                    {
                      icon: <ExclamationCircleOutlined />,
                      label: 'Quá hạn',
                      value: data?.overdueCare ?? 0,
                      tone: 'danger',
                    },
                  ].map((item) => (
                    <div className={`performance-item tone-${item.tone}`} key={item.label}>
                      <span className='performance-item-icon'>{item.icon}</span>
                      <span>
                        <small>{item.label}</small>
                        <b>{item.value}</b>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </ProCard>
          </Col>

          <Col xs={24} xl={9}>
            <ProCard title='Nguồn khách hàng' extra={<Button type='link' onClick={() => router.push('/customers')}>Chi tiết</Button>}>
              {data?.sourceStats.length ? (
                <div className='source-list'>
                  {data.sourceStats.map((item, index) => (
                    <div className='source-row' key={item.name}>
                      <div className='source-row-head'>
                        <Space>
                          <Avatar
                            size={28}
                            style={{ background: sourceColors[index % sourceColors.length] }}
                          >
                            {item.name.charAt(0)}
                          </Avatar>
                          <span>{item.name}</span>
                        </Space>
                        <b>{item.value}</b>
                      </div>
                      <Progress
                        percent={Math.round((item.value / maxSource) * 100)}
                        showInfo={false}
                        strokeColor={sourceColors[index % sourceColors.length]}
                        trailColor='#edf5ed'
                        size='small'
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description='Chưa có dữ liệu nguồn khách hàng' />
              )}
            </ProCard>
          </Col>
        </Row>

        <Row gutter={[16, 16]} className='section-gap'>
          <Col xs={24} xl={15}>
            <ProCard
              title='Luồng nghiệp vụ toàn vòng đời thang máy'
              extra={<Tag color='success'>Quy trình thống nhất</Tag>}
            >
              <Steps
                className='business-flow'
                current={1}
                responsive
                items={[
                  { title: 'Hồ sơ tư vấn', description: 'Tiếp nhận nhu cầu', icon: <CustomerServiceOutlined /> },
                  { title: 'Chăm sóc', description: 'Theo dõi và khảo sát', icon: <CalendarOutlined /> },
                  { title: 'Báo giá & HĐ', description: 'Duyệt và ký kết', icon: <FileTextOutlined /> },
                  { title: 'Dự án', description: 'Điều phối thi công', icon: <ProjectOutlined /> },
                  { title: 'KCS & bàn giao', description: 'Kiểm soát chất lượng', icon: <SafetyCertificateOutlined /> },
                  { title: 'Bảo trì', description: 'Quản lý vận hành', icon: <CustomerServiceOutlined /> },
                ]}
              />
            </ProCard>
          </Col>

          <Col xs={24} xl={9}>
            <ProCard title='Việc cần chú ý'>
              <List
                className='attention-list'
                dataSource={[
                  {
                    icon: <ExclamationCircleOutlined />,
                    title: `${data?.overdueCare ?? 0} lịch chăm sóc quá hạn`,
                    description: 'Ưu tiên liên hệ và cập nhật kết quả',
                    tone: 'danger',
                  },
                  {
                    icon: <ClockCircleOutlined />,
                    title: `${data?.upcomingCare ?? 0} lịch sắp tới`,
                    description: 'Kiểm tra nội dung và người phụ trách',
                    tone: 'warning',
                  },
                  {
                    icon: <UserAddOutlined />,
                    title: `${data?.newCustomers ?? 0} khách mới tháng này`,
                    description: 'Đảm bảo không bỏ sót khách hàng mới',
                    tone: 'primary',
                  },
                ]}
                renderItem={(item) => (
                  <List.Item>
                    <div className={`attention-icon tone-${item.tone}`}>{item.icon}</div>
                    <div className='attention-copy'>
                      <b>{item.title}</b>
                      <small>{item.description}</small>
                    </div>
                    <ArrowRightOutlined className='attention-arrow' />
                  </List.Item>
                )}
              />
            </ProCard>
          </Col>
        </Row>

        <ProCard title='Truy cập nhanh theo nghiệp vụ' className='section-gap quick-module-card'>
          <Row gutter={[12, 12]}>
            {[
              { title: 'Báo giá', description: 'Phiên bản và phê duyệt', path: '/quotations', icon: <FileTextOutlined /> },
              { title: 'Dự án', description: 'Điều phối và tiến độ', path: '/projects/list', icon: <ProjectOutlined /> },
              { title: 'KCS', description: 'Checklist và lỗi chất lượng', path: '/technical/kcs', icon: <SafetyCertificateOutlined /> },
              { title: 'Bảo trì', description: 'Lịch và phiếu bảo trì', path: '/service/maintenance', icon: <CustomerServiceOutlined /> },
            ].map((item) => (
              <Col xs={24} sm={12} xl={6} key={item.path}>
                <button className='quick-module-button' onClick={() => router.push(item.path)}>
                  <span className='quick-module-icon'>{item.icon}</span>
                  <span>
                    <b>{item.title}</b>
                    <small>{item.description}</small>
                  </span>
                  <ArrowRightOutlined />
                </button>
              </Col>
            ))}
          </Row>
        </ProCard>
    </PageContainer>
  );
}
