'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Calendar,
  Card,
  Col,
  Descriptions,
  Input,
  List,
  Modal,
  Row,
  Segmented,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  LeftOutlined,
  PlusOutlined,
  RightOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import {
  DrawerForm,
  PageContainer,
  ProCard,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import dayjs, { Dayjs } from 'dayjs';
import { useRouter, useSearchParams } from 'next/navigation';
import AppStatusTag from '@/components/AppStatusTag';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exportCsv';

type CareRow = {
  id: string;
  customerId: string;
  customer: string;
  phone: string;
  assignee: string;
  careType: string;
  scheduledAt: string;
  content: string;
  result?: string;
  status: string;
  nextCareAt?: string;
};

type CustomerOption = {
  id: string;
  code: string;
  name: string;
};

type CareForm = {
  customerId: string;
  careType: string;
  scheduledAt: string;
  content: string;
};

const textSorter = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

const careTypeLabels: Record<string, string> = {
  CALL: 'Gọi điện',
  MESSAGE: 'Nhắn tin',
  MEETING: 'Hẹn gặp',
  SURVEY: 'Khảo sát công trình',
  SEND_QUOTE: 'Gửi báo giá',
  FOLLOW_UP: 'Nhắc phản hồi báo giá',
  SIGN_CONTRACT: 'Nhắc ký hợp đồng',
  PAYMENT: 'Nhắc thanh toán',
  OTHER: 'Công việc khác',
};

const statusLabels: Record<string, { label: string; color: string }> = {
  OVERDUE: { label: 'Quá hạn', color: 'red' },
  DONE: { label: 'Hoàn thành', color: 'green' },
  UPCOMING: { label: 'Sắp tới', color: 'blue' },
};

function CareStatus({ value }: { value: string }) {
  const status = statusLabels[value] ?? { label: value, color: 'default' };
  return <AppStatusTag value={value} label={status.label} color={status.color} />;
}

export default function Care() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<CareRow[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [open, setOpen] = useState(false);
  const [prefilledCustomerId, setPrefilledCustomerId] = useState<string>();
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [loading, setLoading] = useState(false);
  const [completeItem, setCompleteItem] = useState<CareRow | null>(null);
  const [completeResult, setCompleteResult] = useState('');
  const [completing, setCompleting] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Dayjs>(dayjs());
  const [calendarMode, setCalendarMode] = useState<'month' | 'year'>('month');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<CareRow[]>('/care-activities'));
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được lịch chăm sóc.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    api<CustomerOption[]>('/customers')
      .then(setCustomers)
      .catch((error: unknown) =>
        message.error(error instanceof Error ? error.message : 'Không tải được danh sách khách hàng.'),
      );
  }, [load]);

  useEffect(() => {
    const requestedCustomerId = searchParams.get('customerId');
    if (!requestedCustomerId || open || !customers.some((customer) => customer.id === requestedCustomerId)) return;
    setPrefilledCustomerId(requestedCustomerId);
    setOpen(true);
    router.replace('/care');
  }, [customers, open, router, searchParams]);

  const summary = useMemo(
    () => ({
      total: data.length,
      upcoming: data.filter((item) => item.status === 'UPCOMING').length,
      overdue: data.filter((item) => item.status === 'OVERDUE').length,
      done: data.filter((item) => item.status === 'DONE').length,
    }),
    [data],
  );

  const save = async (values: CareForm) => {
    try {
      await api('/care-activities', {
        method: 'POST',
        body: JSON.stringify({ ...values, scheduledAt: dayjs(values.scheduledAt).toISOString() }),
      });
      message.success('Đã tạo lịch chăm sóc');
      setOpen(false);
      await load();
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tạo được lịch chăm sóc.');
      return false;
    }
  };

  const complete = async () => {
    if (!completeItem || !completeResult.trim()) {
      message.warning('Vui lòng nhập kết quả chăm sóc.');
      return;
    }
    setCompleting(true);
    try {
      await api(`/care-activities/${completeItem.id}/complete`, {
        method: 'PUT',
        body: JSON.stringify({ result: completeResult.trim(), nextCareAt: null }),
      });
      message.success('Đã hoàn thành lịch chăm sóc');
      setCompleteItem(null);
      setCompleteResult('');
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể hoàn thành lịch chăm sóc.');
    } finally {
      setCompleting(false);
    }
  };

  const calendarCell = (date: Dayjs) => {
    const dayItems = data.filter((item) => dayjs(item.scheduledAt).isSame(date, 'day'));
    const items = dayItems.slice(0, 3);
    return (
      <ul className='calendar-event-list'>
        {items.map((item) => (
          <li key={item.id}>
            <Badge
              status={item.status === 'OVERDUE' ? 'error' : item.status === 'DONE' ? 'success' : 'processing'}
              text={<span title={item.customer}>{item.customer}</span>}
            />
          </li>
        ))}
        {dayItems.length > 3 && (
          <li className='calendar-more'>+{dayItems.length - 3} lịch khác</li>
        )}
      </ul>
    );
  };

  const columns: ProColumns<CareRow>[] = [
    {
      title: 'Thời gian',
      dataIndex: 'scheduledAt',
      width: 165,
      defaultSortOrder: 'ascend',
      sorter: (a, b) => dayjs(a.scheduledAt).valueOf() - dayjs(b.scheduledAt).valueOf(),
      render: (_, item) => (
        <span>
          <b className='table-primary-text'>{dayjs(item.scheduledAt).format('DD/MM/YYYY')}</b>
          <small className='table-secondary-text'>{dayjs(item.scheduledAt).format('HH:mm')}</small>
        </span>
      ),
    },
    {
      title: 'Khách hàng',
      dataIndex: 'customer',
      width: 220,
      sorter: (a, b) => textSorter.compare(a.customer, b.customer),
      render: (_, item) => (
        <Space>
          <Avatar className='customer-avatar'>{item.customer.charAt(0)}</Avatar>
          <span>
            <b className='table-primary-text'>{item.customer}</b>
            <small className='table-secondary-text'>{item.phone}</small>
          </span>
        </Space>
      ),
    },
    {
      title: 'Loại chăm sóc',
      dataIndex: 'careType',
      width: 180,
      sorter: (a, b) => textSorter.compare(
        careTypeLabels[a.careType] ?? a.careType,
        careTypeLabels[b.careType] ?? b.careType,
      ),
      render: (_, item) => careTypeLabels[item.careType] ?? item.careType,
    },
    { title: 'Nội dung', dataIndex: 'content', ellipsis: true },
    { title: 'Phụ trách', dataIndex: 'assignee', width: 180, sorter: (a, b) => textSorter.compare(a.assignee, b.assignee) },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      sorter: (a, b) => textSorter.compare(
        statusLabels[a.status]?.label ?? a.status,
        statusLabels[b.status]?.label ?? b.status,
      ),
      render: (_, item) => <CareStatus value={item.status} />,
    },
    {
      title: 'Thao tác',
      valueType: 'option',
      width: 130,
      align: 'center',
      render: (_, item) =>
        item.status !== 'DONE' ? [
          <Space key='actions' size={2} className='table-actions table-actions-center'>
            <Button type='link' size='small' onClick={() => setCompleteItem(item)}>
              <CheckCircleOutlined /> Hoàn thành
            </Button>
          </Space>,
        ] : [
          <Space key='actions' size={2} className='table-actions table-actions-center'>
            <Typography.Text type='secondary'>Đã xử lý</Typography.Text>
          </Space>,
        ],
    },
  ];

  const exportCareActivities = () => {
    exportCsv(`lich-cham-soc-${dayjs().format('YYYYMMDD-HHmm')}`, data, [
      { header: 'Thời gian', value: (item) => dayjs(item.scheduledAt).format('DD/MM/YYYY HH:mm') },
      { header: 'Khách hàng', value: (item) => item.customer },
      { header: 'Số điện thoại', value: (item) => item.phone },
      { header: 'Loại chăm sóc', value: (item) => careTypeLabels[item.careType] ?? item.careType },
      { header: 'Nội dung', value: (item) => item.content },
      { header: 'Phụ trách', value: (item) => item.assignee },
      { header: 'Trạng thái', value: (item) => statusLabels[item.status]?.label ?? item.status },
      { header: 'Kết quả', value: (item) => item.result },
    ]);
  };

  return (
    <PageContainer
        className='erp-page-container'
        header={{
          title: (
            <div className='page-title-stack'>
              <Typography.Title level={3}>Lịch chăm sóc</Typography.Title>
              <Typography.Text>Lập lịch, theo dõi và ghi nhận kết quả chăm sóc</Typography.Text>
            </div>
          ),
          extra: (
            <Button type='primary' icon={<PlusOutlined />} onClick={() => {
              setPrefilledCustomerId(undefined);
              setOpen(true);
            }}>
              Thêm lịch
            </Button>
          ),
          breadcrumb: {},
        }}
      >
        <Row gutter={[16, 16]} className='erp-kpi-row'>
          {[
            { label: 'Tổng lịch', value: summary.total, icon: <CalendarOutlined />, tone: 'blue' },
            { label: 'Sắp tới', value: summary.upcoming, icon: <ClockCircleOutlined />, tone: 'cyan' },
            { label: 'Quá hạn', value: summary.overdue, icon: <ExclamationCircleOutlined />, tone: 'orange' },
            { label: 'Đã hoàn thành', value: summary.done, icon: <CheckCircleOutlined />, tone: 'green' },
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

        <ProCard
          className='section-gap care-toolbar-card'
          bodyStyle={{ padding: 12 }}
        >
          <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <Segmented
              value={view}
              onChange={(value) => setView(value as 'calendar' | 'list')}
              options={[
                { label: 'Lịch tháng', value: 'calendar', icon: <CalendarOutlined /> },
                { label: 'Danh sách', value: 'list', icon: <UnorderedListOutlined /> },
              ]}
            />
            <Space wrap>
              <Tag color='blue'>Sắp tới: {summary.upcoming}</Tag>
              <Tag color='red'>Quá hạn: {summary.overdue}</Tag>
              <Tag color='green'>Hoàn thành: {summary.done}</Tag>
              <Button icon={<DownloadOutlined />} onClick={exportCareActivities}>
                Xuất CSV
              </Button>
            </Space>
          </Space>
        </ProCard>

        {view === 'calendar' ? (
          <ProCard className='section-gap calendar-card' loading={loading}>
            <div className='calendar-toolbar'>
              <Space>
                <Button icon={<LeftOutlined />} onClick={() => setCalendarDate((value) => value.subtract(1, calendarMode))} />
                <Button onClick={() => setCalendarDate(dayjs())}>Hôm nay</Button>
                <Button icon={<RightOutlined />} onClick={() => setCalendarDate((value) => value.add(1, calendarMode))} />
              </Space>
              <Typography.Text strong>
                {calendarMode === 'month'
                  ? `Tháng ${calendarDate.format('MM/YYYY')}`
                  : `Năm ${calendarDate.format('YYYY')}`}
              </Typography.Text>
              <Segmented
                value={calendarMode}
                onChange={(value) => setCalendarMode(value as 'month' | 'year')}
                options={[
                  { label: 'Tháng', value: 'month' },
                  { label: 'Năm', value: 'year' },
                ]}
              />
            </div>
            <Calendar
              value={calendarDate}
              mode={calendarMode}
              onChange={setCalendarDate}
              onPanelChange={(value, mode) => {
                setCalendarDate(value);
                setCalendarMode(mode);
              }}
              headerRender={() => null}
              cellRender={calendarCell}
            />
          </ProCard>
        ) : (
          <>
            <div className='desktop-table section-gap'>
              <ProTable<CareRow>
                rowKey='id'
                loading={loading}
                dataSource={data}
                columns={columns}
                search={false}
                cardBordered
                headerTitle='Danh sách lịch chăm sóc'
                options={{ density: true, fullScreen: true, reload: () => void load() }}
                pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${total} lịch` }}
                scroll={{ x: 1150 }}
              />
            </div>

            <div className='mobile-card-list section-gap'>
              <List
                loading={loading}
                dataSource={data}
                locale={{ emptyText: 'Chưa có lịch chăm sóc' }}
                renderItem={(item) => (
                  <List.Item>
                    <Card className='mobile-record-card'>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }} align='start'>
                        <Space align='start'>
                          <Avatar className='customer-avatar'>{item.customer.charAt(0)}</Avatar>
                          <div>
                            <Typography.Text strong>{item.customer}</Typography.Text>
                            <div className='muted-text'>{dayjs(item.scheduledAt).format('DD/MM/YYYY HH:mm')}</div>
                          </div>
                        </Space>
                        <CareStatus value={item.status} />
                      </Space>
                      <Descriptions size='small' column={1} className='mobile-descriptions'>
                        <Descriptions.Item label='Loại'>{careTypeLabels[item.careType] ?? item.careType}</Descriptions.Item>
                        <Descriptions.Item label='Phụ trách'>{item.assignee}</Descriptions.Item>
                        <Descriptions.Item label='Nội dung'>{item.content}</Descriptions.Item>
                      </Descriptions>
                      {item.status !== 'DONE' && (
                        <Button block icon={<CheckCircleOutlined />} onClick={() => setCompleteItem(item)}>Ghi nhận hoàn thành</Button>
                      )}
                    </Card>
                  </List.Item>
                )}
              />
            </div>
          </>
        )}

        <DrawerForm<CareForm>
          key={prefilledCustomerId ?? 'new-care'}
          title='Tạo lịch chăm sóc khách hàng'
          open={open}
          onOpenChange={setOpen}
          width='min(640px, calc(100vw - 40px))'
          onFinish={save}
          initialValues={{ customerId: prefilledCustomerId }}
          drawerProps={{ destroyOnClose: true, className: 'business-form-drawer' }}
          submitter={{ searchConfig: { submitText: 'Lưu lịch', resetText: 'Hủy' } }}
        >
          <div className='form-section-heading'>Thông tin lịch chăm sóc</div>
          <ProFormSelect
            name='customerId'
            label='Khách hàng'
            showSearch
            rules={[{ required: true, message: 'Vui lòng chọn khách hàng' }]}
            fieldProps={{ optionFilterProp: 'label' }}
            options={customers.map((customer) => ({
              value: customer.id,
              label: `${customer.code} - ${customer.name}`,
            }))}
          />
          <ProFormSelect
            name='careType'
            label='Loại chăm sóc'
            rules={[{ required: true, message: 'Vui lòng chọn loại chăm sóc' }]}
            options={Object.entries(careTypeLabels).map(([value, label]) => ({ value, label }))}
          />
          <ProFormDateTimePicker
            name='scheduledAt'
            label='Thời gian dự kiến'
            rules={[{ required: true, message: 'Vui lòng chọn thời gian' }]}
            fieldProps={{ style: { width: '100%' }, format: 'DD/MM/YYYY HH:mm' }}
          />
          <ProFormTextArea
            name='content'
            label='Nội dung cần thực hiện'
            rules={[{ required: true, message: 'Vui lòng nhập nội dung' }]}
            fieldProps={{ rows: 5 }}
            placeholder='Ví dụ: Gọi xác nhận lịch khảo sát và nhu cầu tải trọng...'
          />
        </DrawerForm>

        <Modal
          title='Ghi nhận kết quả chăm sóc'
          open={Boolean(completeItem)}
          onCancel={() => {
            setCompleteItem(null);
            setCompleteResult('');
          }}
          onOk={() => void complete()}
          confirmLoading={completing}
          okText='Xác nhận hoàn thành'
          cancelText='Hủy'
          className='business-result-modal'
        >
          <Typography.Paragraph type='secondary'>
            Khách hàng: <b>{completeItem?.customer}</b>
          </Typography.Paragraph>
          <Typography.Text strong>Kết quả thực hiện</Typography.Text>
          <Input.TextArea
            rows={5}
            value={completeResult}
            onChange={(event) => setCompleteResult(event.target.value)}
            placeholder='Nhập kết quả trao đổi, phản hồi của khách hàng...'
          />
        </Modal>
    </PageContainer>
  );
}
