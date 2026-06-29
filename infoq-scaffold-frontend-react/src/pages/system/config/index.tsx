import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EditOutlined, PlusOutlined, ReloadOutlined, SaveOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Card, Drawer, Empty, Form, Input, InputNumber, Select, Space, Spin, Switch, Table, Tabs, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { addConfig, getConfigPanel, refreshCache, reorderConfig, resetConfigByKey, updateConfig, updateConfigByKey } from '@/api/system/config';
import type { ConfigForm, ConfigPanel, ConfigPanelGroup, ConfigPanelItem, ConfigReorderForm, ConfigValueType } from '@/api/system/config/types';
import Pagination from '@/components/Pagination';
import modal from '@/utils/modal';
import { download } from '@/utils/request';
import { useUserStore } from '@/store/modules/user';
import './index.css';

const { Text, Title } = Typography;

const supportedValueTypes = [
  { label: '开关', value: 'switch' },
  { label: '下拉选择', value: 'select' },
  { label: '文本', value: 'text' },
  { label: '密码', value: 'password' }
];

const initialPanel: ConfigPanel = { groups: [] };

const initialForm: ConfigForm = {
  configId: undefined,
  configName: '',
  configKey: '',
  configValue: '',
  valueType: 'text',
  defaultValue: null,
  groupKey: 'advanced',
  displayOrder: 0,
  optionsJson: null,
  uiPropsJson: null,
  configType: 'N',
  remark: ''
};

const getAllItems = (panel: ConfigPanel) => panel.groups.flatMap((group) => group.items);
const maskValue = (value?: string) => (value ? '•'.repeat(Math.min(Math.max(value.length, 6), 12)) : '未设置');
const hasDefaultValue = (item: ConfigPanelItem) => item.defaultValue !== null && item.defaultValue !== undefined;
const toBooleanString = (checked: boolean) => (checked ? 'true' : 'false');
const defaultPageSize = 5;

const assertConfigPanel = (value: unknown): ConfigPanel => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('配置面板响应 data 必须是对象');
  }
  if (!Array.isArray((value as ConfigPanel).groups)) {
    throw new Error('配置面板响应 data.groups 必须是数组');
  }
  return value as ConfigPanel;
};

export default function ConfigPage() {
  const [panel, setPanel] = useState<ConfigPanel>(initialPanel);
  const [loading, setLoading] = useState(false);
  const [activeGroupKey, setActiveGroupKey] = useState('all');
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
  const [editingKeys, setEditingKeys] = useState<Record<string, boolean>>({});
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [listPagination, setListPagination] = useState({ page: 1, limit: defaultPageSize });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderRows, setOrderRows] = useState<ConfigReorderForm[]>([]);
  const [form] = Form.useForm<ConfigForm>();
  const roles = useUserStore((state) => state.roles);
  const isSuperAdmin = roles.includes('superadmin');
  const watchedValueType = Form.useWatch('valueType', form) as ConfigValueType | undefined;
  const groupOptions = useMemo(() => panel.groups.map((group) => ({ label: group.groupName, value: group.groupKey })), [panel.groups]);

  const loadPanel = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getConfigPanel();
      const nextPanel = assertConfigPanel(response.data);
      setPanel(nextPanel);
      setOrderRows(
        getAllItems(nextPanel).map((item) => ({
          configId: item.configId,
          groupKey: item.groupKey,
          displayOrder: item.displayOrder ?? 0
        }))
      );
    } catch (error) {
      modal.msgError(error instanceof Error ? error.message : '配置面板加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPanel();
  }, [loadPanel]);

  const filteredGroups = useMemo(() => {
    return panel.groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          return activeGroupKey === 'all' || item.groupKey === activeGroupKey;
        })
      }))
      .filter((group) => group.items.length > 0 || activeGroupKey === group.groupKey);
  }, [activeGroupKey, panel.groups]);

  const filteredItemTotal = useMemo(() => filteredGroups.reduce((total, group) => total + group.items.length, 0), [filteredGroups]);

  const pagedGroups = useMemo(() => {
    const start = (listPagination.page - 1) * listPagination.limit;
    const end = start + listPagination.limit;
    const pagedItems = filteredGroups.flatMap((group) => group.items.map((item) => ({ groupKey: group.groupKey, item }))).slice(start, end);
    return filteredGroups
      .map((group) => {
        const items = pagedItems.filter((entry) => entry.groupKey === group.groupKey).map((entry) => entry.item);
        return { ...group, items };
      })
      .filter((group) => group.items.length > 0);
  }, [filteredGroups, listPagination.limit, listPagination.page]);

  useEffect(() => {
    setListPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [activeGroupKey]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredItemTotal / listPagination.limit));
    if (listPagination.page > maxPage) {
      setListPagination((prev) => ({ ...prev, page: maxPage }));
    }
  }, [filteredItemTotal, listPagination.limit, listPagination.page]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activeGroupKey, listPagination.limit, listPagination.page]);

  const updatePanelItemValue = (configKey: string, configValue: string) => {
    setPanel((prev) => ({
      groups: prev.groups.map((group) => ({
        ...group,
        items: group.items.map((item) => (item.configKey === configKey ? { ...item, configValue } : item))
      }))
    }));
  };

  const setItemSaving = (configKey: string, saving: boolean) => {
    setSavingKeys((prev) => ({ ...prev, [configKey]: saving }));
  };

  const saveItemValue = async (item: ConfigPanelItem, nextValue: string | boolean) => {
    const previousValue = item.configValue;
    const normalizedValue = typeof nextValue === 'boolean' ? toBooleanString(nextValue) : nextValue;
    updatePanelItemValue(item.configKey, normalizedValue);
    setItemSaving(item.configKey, true);
    try {
      await updateConfigByKey(item.configKey, nextValue);
      await loadPanel();
      modal.msgSuccess('保存成功');
    } catch {
      updatePanelItemValue(item.configKey, previousValue);
    } finally {
      setItemSaving(item.configKey, false);
    }
  };

  const restoreDefault = async (item: ConfigPanelItem) => {
    if (!hasDefaultValue(item)) {
      modal.msgWarning('该参数没有默认值');
      return;
    }
    const previousValue = item.configValue;
    setItemSaving(item.configKey, true);
    try {
      const response = await resetConfigByKey(item.configKey);
      updatePanelItemValue(item.configKey, response.data);
      await loadPanel();
      modal.msgSuccess('已恢复默认');
    } catch {
      updatePanelItemValue(item.configKey, previousValue);
    } finally {
      setItemSaving(item.configKey, false);
    }
  };

  const startEdit = (item: ConfigPanelItem) => {
    setEditingKeys((prev) => ({ ...prev, [item.configKey]: true }));
    setEditingValues((prev) => ({ ...prev, [item.configKey]: item.configValue || '' }));
  };

  const cancelEdit = (item: ConfigPanelItem) => {
    setEditingKeys((prev) => ({ ...prev, [item.configKey]: false }));
    setEditingValues((prev) => {
      const next = { ...prev };
      delete next[item.configKey];
      return next;
    });
  };

  const submitTextEdit = async (item: ConfigPanelItem) => {
    await saveItemValue(item, editingValues[item.configKey] ?? '');
    cancelEdit(item);
  };

  const openAddDrawer = () => {
    form.setFieldsValue(initialForm);
    setDrawerOpen(true);
  };

  const openEditDrawer = (item: ConfigPanelItem) => {
    form.setFieldsValue({
      configId: item.configId,
      configName: item.configName,
      configKey: item.configKey,
      configValue: item.configValue,
      valueType: item.valueType,
      defaultValue: item.defaultValue ?? null,
      groupKey: item.groupKey,
      displayOrder: item.displayOrder ?? 0,
      optionsJson: item.options ? JSON.stringify(item.options) : null,
      uiPropsJson: item.uiProps && Object.keys(item.uiProps).length > 0 ? JSON.stringify(item.uiProps) : null,
      configType: item.configType,
      remark: item.remark || ''
    });
    setDrawerOpen(true);
  };

  const submitDefinition = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (values.configId) {
        await updateConfig(values);
      } else {
        await addConfig(values);
      }
      modal.msgSuccess('配置定义已保存');
      form.setFieldsValue(initialForm);
      await loadPanel();
    } finally {
      setSubmitting(false);
    }
  };

  const saveOrder = async () => {
    setSubmitting(true);
    try {
      await reorderConfig(orderRows);
      modal.msgSuccess('显示顺序已保存');
      await loadPanel();
    } finally {
      setSubmitting(false);
    }
  };

  const renderValueControl = (item: ConfigPanelItem) => {
    const saving = savingKeys[item.configKey];
    const disabled = !item.editable || saving;
    if (item.valueType === 'switch') {
      return (
        <Switch
          aria-label={item.configName}
          checked={item.configValue === 'true'}
          disabled={disabled}
          loading={saving}
          checkedChildren="开启"
          unCheckedChildren="关闭"
          onChange={(checked) => saveItemValue(item, checked)}
        />
      );
    }
    if (item.valueType === 'select') {
      return (
        <Select
          value={item.configValue}
          disabled={disabled}
          loading={saving}
          style={{ minWidth: 190 }}
          options={(item.options || []).map((option) => ({ label: option.label, value: option.value }))}
          onChange={(value) => saveItemValue(item, value)}
        />
      );
    }
    if (item.valueType === 'text' || item.valueType === 'password') {
      const editing = editingKeys[item.configKey];
      if (editing) {
        const inputProps = {
          value: editingValues[item.configKey] ?? '',
          onChange: (event: ChangeEvent<HTMLInputElement>) => setEditingValues((prev) => ({ ...prev, [item.configKey]: event.target.value })),
          onPressEnter: () => submitTextEdit(item),
          disabled: saving
        };
        return (
          <Space wrap className="config-edit-row">
            {item.valueType === 'password' ? <Input.Password {...inputProps} /> : <Input {...inputProps} />}
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => submitTextEdit(item)}>
              保存
            </Button>
            <Button onClick={() => cancelEdit(item)}>取消</Button>
          </Space>
        );
      }
      return (
        <Space wrap className="config-edit-row">
          <Text code>{item.valueType === 'password' ? maskValue(item.configValue) : item.configValue || '未设置'}</Text>
          <Tooltip title={item.editable ? '编辑当前值' : item.editableReason || '不可编辑'}>
            <Button icon={<EditOutlined />} disabled={!item.editable} onClick={() => startEdit(item)}>
              编辑
            </Button>
          </Tooltip>
        </Space>
      );
    }
    return <Tag color="default">{item.valueType || 'text'} 类型暂不支持面板编辑</Tag>;
  };

  const renderConfigCard = (item: ConfigPanelItem) => (
    <Card key={item.configKey} className="config-center-card config-setting-row" size="small">
      <div className={`config-card-main ${editingKeys[item.configKey] ? 'config-card-main-editing' : ''}`}>
        <div className="config-card-copy">
          <Space size={8} wrap className="config-card-heading">
            <Text strong>{item.configName}</Text>
            <Tag color={item.configType === 'Y' ? 'blue' : 'default'}>{item.configType === 'Y' ? '系统内置' : '用户自定义'}</Tag>
            <Tag>{item.valueType}</Tag>
          </Space>
          <div className="config-card-key">{item.configKey}</div>
          {item.remark && <div className="config-card-desc">{item.remark}</div>}
          {!item.editable && <div className="config-card-warning">{item.editableReason || '该配置不可编辑'}</div>}
        </div>
        <div className="config-card-control">{renderValueControl(item)}</div>
      </div>
      <div className="config-card-footer">
        <Text type="secondary">
          默认值：
          {hasDefaultValue(item)
            ? item.valueType === 'password'
              ? maskValue(item.defaultValue || '')
              : item.defaultValue || '空字符串'
            : '无默认值'}
        </Text>
        <Space className="config-card-actions" wrap>
          {isSuperAdmin && (
            <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => openEditDrawer(item)}>
              定义
            </Button>
          )}
          <Tooltip title={!item.editable ? item.editableReason || '不可编辑' : !hasDefaultValue(item) ? '没有默认值' : '恢复为后端默认值'}>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={savingKeys[item.configKey]}
              disabled={!item.editable || !hasDefaultValue(item)}
              onClick={() => restoreDefault(item)}
            >
              恢复默认
            </Button>
          </Tooltip>
        </Space>
      </div>
    </Card>
  );

  const orderColumns: ColumnsType<ConfigReorderForm> = [
    {
      title: '配置项',
      dataIndex: 'configId',
      render: (value) => getAllItems(panel).find((item) => item.configId === value)?.configName || value
    },
    {
      title: '分组',
      dataIndex: 'groupKey',
      width: 150,
      render: (value, row) => (
        <Select
          value={value}
          options={groupOptions}
          style={{ width: '100%' }}
          onChange={(nextGroupKey) =>
            setOrderRows((prev) => prev.map((item) => (item.configId === row.configId ? { ...item, groupKey: nextGroupKey } : item)))
          }
        />
      )
    },
    {
      title: '显示顺序',
      dataIndex: 'displayOrder',
      width: 130,
      render: (value, row) => (
        <InputNumber
          value={value}
          min={0}
          precision={0}
          onChange={(nextOrder) =>
            setOrderRows((prev) => prev.map((item) => (item.configId === row.configId ? { ...item, displayOrder: Number(nextOrder ?? 0) } : item)))
          }
        />
      )
    }
  ];

  return (
    <div className="config-center-page">
      <Card className="config-center-hero">
        <div className="config-hero-content">
          <div>
            <Title level={5} className="config-title">
              参数设置
            </Title>
            <Text type="secondary" className="config-subtitle">
              按类型直接修改配置，恢复默认由后端读取 default_value 执行，旧配置缺元数据时归入高级配置。
            </Text>
          </div>
          <Space wrap className="config-hero-actions">
            <Button
              onClick={async () => {
                await refreshCache();
                modal.msgSuccess('刷新缓存成功');
              }}
            >
              刷新缓存
            </Button>
            <Button onClick={() => download('/system/config/export', {}, `config_${Date.now()}.xlsx`)}>导出</Button>
            {isSuperAdmin && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openAddDrawer}>
                管理配置定义
              </Button>
            )}
          </Space>
        </div>
      </Card>

      <div className="config-center-layout">
        <Card className="config-group-nav" size="small">
          <Button block type={activeGroupKey === 'all' ? 'primary' : 'text'} onClick={() => setActiveGroupKey('all')}>
            全部配置
          </Button>
          {panel.groups.map((group) => (
            <Button
              key={group.groupKey}
              block
              type={activeGroupKey === group.groupKey ? 'primary' : 'text'}
              onClick={() => setActiveGroupKey(group.groupKey)}
            >
              {group.groupName} ({group.items.length})
            </Button>
          ))}
        </Card>

        <div className="config-mobile-group">
          <Select
            value={activeGroupKey}
            style={{ width: '100%' }}
            options={[{ label: '全部配置', value: 'all' }, ...panel.groups.map((group) => ({ label: group.groupName, value: group.groupKey }))]}
            onChange={setActiveGroupKey}
          />
        </div>

        <div className="config-list-panel">
          <Spin spinning={loading} classNames={{ root: 'config-list-spin' }}>
            <div className="config-list-scroll">
              <div className="config-group-list">
                {filteredItemTotal === 0 ? (
                  <Card>
                    <Empty description="没有匹配的配置项" />
                  </Card>
                ) : (
                  pagedGroups.map((group: ConfigPanelGroup) => (
                    <section key={group.groupKey} className="config-group-section">
                      <div className="config-section-title">
                        <Text strong className="config-section-heading">
                          {group.groupName}
                        </Text>
                        <Text type="secondary">{group.items.length} 项配置</Text>
                      </div>
                      <div className="config-card-list">{group.items.map(renderConfigCard)}</div>
                    </section>
                  ))
                )}
              </div>
            </div>
          </Spin>
          <div className="config-list-pagination">
            <Pagination
              total={filteredItemTotal}
              page={listPagination.page}
              limit={listPagination.limit}
              hidden={filteredItemTotal === 0}
              onPageChange={({ page, limit }) => setListPagination({ page, limit })}
            />
          </div>
        </div>
      </div>

      <Drawer size="large" open={drawerOpen} title="配置定义管理" onClose={() => setDrawerOpen(false)} destroyOnHidden>
        <Tabs
          items={[
            {
              key: 'definition',
              label: '新增 / 编辑',
              children: (
                <Form form={form} layout="vertical" initialValues={initialForm}>
                  <Form.Item label="参数主键" name="configId" hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item label="参数名称" name="configName" rules={[{ required: true, message: '参数名称不能为空' }]}>
                    <Input placeholder="例如：账号自助-是否开启用户注册功能" />
                  </Form.Item>
                  <Form.Item label="参数键名" name="configKey" rules={[{ required: true, message: '参数键名不能为空' }]}>
                    <Input placeholder="例如：sys.account.registerUser" />
                  </Form.Item>
                  <Form.Item label="参数类型" name="valueType" rules={[{ required: true, message: '参数类型不能为空' }]}>
                    <Select options={supportedValueTypes} />
                  </Form.Item>
                  <Form.Item label="当前值" name="configValue" rules={[{ required: true, message: '参数键值不能为空' }]}>
                    {watchedValueType === 'switch' ? (
                      <Select
                        options={[
                          { label: '开启 true', value: 'true' },
                          { label: '关闭 false', value: 'false' }
                        ]}
                      />
                    ) : watchedValueType === 'password' ? (
                      <Input.Password />
                    ) : (
                      <Input />
                    )}
                  </Form.Item>
                  <Form.Item label="默认值" name="defaultValue" tooltip="留空提交时表示无默认值；空字符串默认值后续由高级模式处理。">
                    {watchedValueType === 'switch' ? (
                      <Select
                        allowClear
                        options={[
                          { label: '开启 true', value: 'true' },
                          { label: '关闭 false', value: 'false' }
                        ]}
                      />
                    ) : (
                      <Input />
                    )}
                  </Form.Item>
                  <Form.Item label="分组" name="groupKey" rules={[{ required: true, message: '分组不能为空' }]}>
                    <Select options={groupOptions} />
                  </Form.Item>
                  <Form.Item label="显示顺序" name="displayOrder">
                    <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                  </Form.Item>
                  {watchedValueType === 'select' && (
                    <Form.Item label="下拉选项 JSON" name="optionsJson" rules={[{ required: true, message: '下拉类型必须配置选项' }]}>
                      <Input.TextArea rows={4} placeholder='[{"label":"浅色主题","value":"theme-light"}]' />
                    </Form.Item>
                  )}
                  <Form.Item label="UI 属性 JSON" name="uiPropsJson">
                    <Input.TextArea rows={3} placeholder='例如：{"placeholder":"请输入"}' />
                  </Form.Item>
                  <Form.Item label="系统内置" name="configType">
                    <Select
                      options={[
                        { label: '是', value: 'Y' },
                        { label: '否', value: 'N' }
                      ]}
                    />
                  </Form.Item>
                  <Form.Item label="备注" name="remark">
                    <Input.TextArea rows={3} />
                  </Form.Item>
                  <Space>
                    <Button type="primary" loading={submitting} onClick={submitDefinition}>
                      保存定义
                    </Button>
                    <Button onClick={() => form.setFieldsValue(initialForm)}>清空表单</Button>
                  </Space>
                </Form>
              )
            },
            {
              key: 'order',
              label: '显示顺序',
              children: (
                <Space orientation="vertical" style={{ width: '100%' }} size={12}>
                  <Table rowKey="configId" size="small" pagination={false} columns={orderColumns} dataSource={orderRows} />
                  <Button type="primary" loading={submitting} onClick={saveOrder}>
                    保存显示顺序
                  </Button>
                </Space>
              )
            }
          ]}
        />
      </Drawer>
    </div>
  );
}
