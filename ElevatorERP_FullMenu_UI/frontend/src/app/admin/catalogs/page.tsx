'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Col,
  Drawer,
  Form,
  Input,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  EditOutlined,
  DownloadOutlined,
  PlusOutlined,
  SearchOutlined,
  StopOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { api } from '@/lib/api';
import { exportCsv } from '@/lib/exportCsv';

type CatalogCategory = {
  id: string;
  code: string;
  name: string;
  module: string;
  description?: string;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  optionCount: number;
};

type CatalogOption = {
  id: string;
  categoryCode: string;
  code: string;
  label: string;
  description?: string;
  color?: string;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
};

type CatalogOptionForm = {
  code: string;
  label: string;
  description?: string;
  color?: string;
  sortOrder: number;
};

const moduleLabels: Record<string, string> = {
  Customers: 'Khách hàng & Bán hàng',
  Care: 'Chăm sóc khách hàng',
  Contracts: 'Hợp đồng & Báo giá',
  Projects: 'Dự án & Thiết bị',
  Administration: 'Quản trị hệ thống',
};

const colorOptions = [
  { value: 'default', label: 'Không màu' },
  { value: 'blue', label: 'Xanh dương' },
  { value: 'cyan', label: 'Xanh ngọc' },
  { value: 'green', label: 'Xanh lá' },
  { value: 'gold', label: 'Vàng' },
  { value: 'orange', label: 'Cam' },
  { value: 'purple', label: 'Tím' },
  { value: 'geekblue', label: 'Xanh chàm' },
  { value: 'red', label: 'Đỏ' },
];

const textSorter = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

export default function CatalogsPage() {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [options, setOptions] = useState<CatalogOption[]>([]);
  const [selectedCode, setSelectedCode] = useState('customer_status');
  const [search, setSearch] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [updatingOptionIds, setUpdatingOptionIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<CatalogOption | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm<CatalogOptionForm>();

  const selectedCategory = categories.find((item) => item.code === selectedCode);
  const optionPositions = useMemo(
    () => new Map(options.map((option, index) => [option.id, index + 1])),
    [options],
  );
  const positionOptions = useMemo(
    () => options.map((_, index) => ({ value: index + 1, label: `Vị trí ${index + 1}` })),
    [options],
  );

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const data = await api<CatalogCategory[]>(`/catalogs/categories?_=${Date.now()}`);
      setCategories(data);
      setSelectedCode((current) => data.some((item) => item.code === current) ? current : data[0]?.code ?? '');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được danh mục.');
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    if (!selectedCode) return;
    setLoadingOptions(true);
    try {
      setOptions(await api<CatalogOption[]>(`/catalogs/categories/${selectedCode}/options?_=${Date.now()}`));
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không tải được tùy chọn danh mục.');
    } finally {
      setLoadingOptions(false);
    }
  }, [selectedCode]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const groupedCategories = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    return categories
      .filter((item) =>
        !query ||
        item.name.toLocaleLowerCase('vi').includes(query) ||
        item.code.toLocaleLowerCase('vi').includes(query),
      )
      .reduce<Record<string, CatalogCategory[]>>((groups, item) => {
        const key = item.module || 'Administration';
        groups[key] = [...(groups[key] ?? []), item];
        return groups;
      }, {});
  }, [categories, search]);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({ code: '', label: '', description: '', color: 'default', sortOrder: 0 });
    setDrawerOpen(true);
  };

  const openEdit = (option: CatalogOption) => {
    setEditing(option);
    form.setFieldsValue({
      code: option.code,
      label: option.label,
      description: option.description,
      color: option.color ?? 'default',
      sortOrder: optionPositions.get(option.id) ?? 1,
    });
    setDrawerOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields();
    const payload = { ...values, sortOrder: editing ? values.sortOrder : 0 };
    try {
      if (editing) {
        await api(`/catalogs/options/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        message.success('Đã cập nhật tùy chọn');
      } else {
        await api(`/catalogs/categories/${selectedCode}/options`, { method: 'POST', body: JSON.stringify(payload) });
        setCategories((current) =>
          current.map((category) =>
            category.code === selectedCode ? { ...category, optionCount: category.optionCount + 1 } : category,
          ),
        );
        message.success('Đã thêm tùy chọn');
      }
      setDrawerOpen(false);
      await loadOptions();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không lưu được tùy chọn.');
    }
  };

  const toggleActive = async (option: CatalogOption, isActive: boolean) => {
    setUpdatingOptionIds((current) => current.includes(option.id) ? current : [...current, option.id]);
    try {
      await api(`/catalogs/options/${option.id}/active`, {
        method: 'PUT',
        body: JSON.stringify({ isActive }),
      });
      setOptions((current) =>
        current.map((item) => item.id === option.id ? { ...item, isActive } : item),
      );
      setCategories((current) =>
        current.map((category) =>
          category.code === option.categoryCode
            ? { ...category, optionCount: Math.max(0, category.optionCount + (isActive ? 1 : -1)) }
            : category,
        ),
      );
      message.success(isActive ? 'Đã kích hoạt tùy chọn' : 'Đã ngừng dùng tùy chọn');
      await loadOptions();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không cập nhật được trạng thái tùy chọn.');
    } finally {
      setUpdatingOptionIds((current) => current.filter((id) => id !== option.id));
    }
  };

  const exportCatalogOptions = () => {
    exportCsv(`danh-muc-${selectedCode}`, options, [
      { header: 'Vị trí', value: (option) => optionPositions.get(option.id) },
      { header: 'Mã tùy chọn', value: (option) => option.code },
      { header: 'Tên hiển thị', value: (option) => option.label },
      { header: 'Mô tả', value: (option) => option.description },
      { header: 'Màu badge', value: (option) => option.color },
      { header: 'Loại', value: (option) => option.isSystem ? 'Hệ thống' : 'Tùy biến' },
      { header: 'Đang dùng', value: (option) => option.isActive ? 'Có' : 'Không' },
    ]);
  };

  const columns: ProColumns<CatalogOption>[] = [
    {
      title: 'Vị trí',
      dataIndex: 'sortOrder',
      width: 90,
      sorter: (a, b) => a.sortOrder - b.sortOrder,
      render: (_, option) => optionPositions.get(option.id) ?? '-',
    },
    {
      title: 'Mã tùy chọn',
      dataIndex: 'code',
      width: 210,
      sorter: (a, b) => textSorter.compare(a.code, b.code),
      render: (_, option) => <Typography.Text code>{option.code}</Typography.Text>,
    },
    {
      title: 'Tên hiển thị',
      dataIndex: 'label',
      width: 230,
      sorter: (a, b) => textSorter.compare(a.label, b.label),
      render: (_, option) => (
        <span>
          <b className='table-primary-text'>{option.label}</b>
          {option.description && <small className='table-secondary-text'>{option.description}</small>}
        </span>
      ),
    },
    {
      title: 'Tông màu',
      dataIndex: 'color',
      width: 150,
      render: (_, option) => option.color && option.color !== 'default'
        ? <Tag color={option.color}>{option.label}</Tag>
        : <Typography.Text type='secondary'>Không màu</Typography.Text>,
    },
    {
      title: 'Loại',
      dataIndex: 'isSystem',
      width: 120,
      render: (_, option) => (
        <Tag color={option.isSystem ? 'blue' : 'green'}>{option.isSystem ? 'Hệ thống' : 'Tùy biến'}</Tag>
      ),
    },
    {
      title: 'Đang dùng',
      dataIndex: 'isActive',
      width: 120,
      render: (_, option) => {
        const isUpdating = updatingOptionIds.includes(option.id);
        return (
          <Switch
            checked={option.isActive}
            disabled={isUpdating}
            loading={isUpdating}
            onChange={(checked) => void toggleActive(option, checked)}
          />
        );
      },
    },
    {
      title: 'Thao tác',
      valueType: 'option',
      width: 110,
      align: 'center',
      render: (_, option) => [
        <Space key='actions' size={2} className='table-actions table-actions-center'>
          <Button type='link' size='small' icon={<EditOutlined />} onClick={() => openEdit(option)}>
            Sửa
          </Button>
        </Space>,
      ],
    },
  ];

  return (
    <PageContainer
      className='erp-page-container'
      header={{
        title: 'Cấu hình danh mục',
        subTitle: 'Quản lý các danh mục tùy chọn trong toàn hệ thống ERP',
        breadcrumb: {},
      }}
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={7} xl={6}>
          <ProCard
            title='Danh sách danh mục'
            loading={loadingCategories}
            className='catalog-sidebar-card'
            extra={<TagsOutlined />}
          >
            <Input
              prefix={<SearchOutlined />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder='Tìm danh mục...'
              allowClear
            />
            <div className='catalog-category-list'>
              {Object.entries(groupedCategories).map(([module, items]) => (
                <div className='catalog-category-group' key={module}>
                  <Typography.Text type='secondary'>{moduleLabels[module] ?? module}</Typography.Text>
                  {items.map((item) => (
                    <button
                      className={`catalog-category-button${item.code === selectedCode ? ' active' : ''}`}
                      key={item.code}
                      type='button'
                      onClick={() => setSelectedCode(item.code)}
                    >
                      <span>
                        <b>{item.name}</b>
                        <small>{item.code}</small>
                      </span>
                      <Tag>{item.optionCount}</Tag>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </ProCard>
        </Col>
        <Col xs={24} lg={17} xl={18}>
          <ProCard
            className='catalog-options-card'
            title={selectedCategory ? `Danh sách: ${selectedCategory.name}` : 'Danh sách tùy chọn'}
            extra={(
              <Space>
                {selectedCategory && <Tag color='green'>{selectedCategory.code}</Tag>}
                <Button icon={<DownloadOutlined />} onClick={exportCatalogOptions}>
                  Xuất CSV
                </Button>
                <Button type='primary' icon={<PlusOutlined />} onClick={openCreate}>
                  Thêm tùy chọn
                </Button>
              </Space>
            )}
          >
            {selectedCategory && (
              <Typography.Paragraph type='secondary' className='catalog-description'>
                {selectedCategory.description}
              </Typography.Paragraph>
            )}
            <ProTable<CatalogOption>
              rowKey='id'
              loading={loadingOptions}
              dataSource={options}
              columns={columns}
              search={false}
              options={{ reload: () => void loadOptions(), density: true, fullScreen: true }}
              pagination={false}
              scroll={{ x: 980 }}
            />
          </ProCard>
        </Col>
      </Row>

      <Drawer
        title={editing ? 'Sửa tùy chọn danh mục' : 'Thêm tùy chọn danh mục'}
        width={560}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={(
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Hủy</Button>
            <Button type='primary' onClick={() => void save()}>Lưu</Button>
          </Space>
        )}
      >
        <Form<CatalogOptionForm> form={form} layout='vertical' requiredMark={false}>
          <Form.Item
            name='code'
            label='Mã tùy chọn'
            rules={[{ required: true, message: 'Nhập mã tùy chọn' }]}
          >
            <Input placeholder='VD: WAITING_RESPONSE' />
          </Form.Item>
          <Form.Item
            name='label'
            label='Tên hiển thị'
            rules={[{ required: true, message: 'Nhập tên hiển thị' }]}
          >
            <Input placeholder='VD: Chờ phản hồi' />
          </Form.Item>
          <Form.Item name='description' label='Mô tả'>
            <Input.TextArea rows={3} placeholder='Ghi chú cách dùng tùy chọn này...' />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name='color' label='Màu badge'>
                <Select options={colorOptions} />
              </Form.Item>
            </Col>
            {editing && (
              <Col span={12}>
                <Form.Item name='sortOrder' label='Vị trí hiển thị' rules={[{ required: true }]}>
                  <Select options={positionOptions} />
                </Form.Item>
              </Col>
            )}
          </Row>
          <ProCard className='catalog-form-note'>
            <Space>
              <StopOutlined />
              <Typography.Text type='secondary'>
                Tùy chọn đã phát sinh dữ liệu nên ngừng dùng thay vì xóa cứng.
              </Typography.Text>
            </Space>
          </ProCard>
        </Form>
      </Drawer>
    </PageContainer>
  );
}
