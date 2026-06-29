import {DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined,} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Table,
  Tooltip,
  Tree,
  TreeSelect,
} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import type {DataNode} from 'antd/es/tree';
import {useCallback, useState} from 'react';
import {addMenu, cascadeDelMenu, delMenu, getMenu, listMenu, updateMenu,} from '@/api/system/menu';
import type {MenuForm, MenuQuery, MenuVO} from '@/api/system/menu/types';
import DictTag from '@/components/DictTag';
import RightToolbar from '@/components/RightToolbar';
import SvgIcon from '@/components/SvgIcon';
import useInitialLoadEffect from '@/hooks/useInitialLoadEffect';
import useDictOptions from '@/hooks/useDictOptions';
import modal from '@/utils/modal';
import {handleTree} from '@/utils/scaffold';

type MenuNode = MenuVO;

const initialQuery: MenuQuery = {
  keywords: '',
  menuName: '',
  status: '',
};

const initialForm: MenuForm = {
  menuId: undefined,
  parentId: 0,
  menuName: '',
  orderNum: 1,
  path: '',
  component: '',
  queryParam: '',
  isFrame: '1',
  isCache: '0',
  menuType: 'M' as never,
  visible: '0',
  status: '0',
  icon: '',
  remark: '',
  query: '',
  perms: '',
};

const toTreeSelectData = (nodes: MenuVO[]): DataNode[] =>
  nodes.map((node) => ({
    key: String(node.menuId),
    value: node.menuId,
    title: node.menuName,
    children: node.children?.length
      ? toTreeSelectData(node.children)
      : undefined,
  }));

export default function MenuPage() {
  const [query, setQuery] = useState<MenuQuery>(initialQuery);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(true);
  const [list, setList] = useState<MenuVO[]>([]);
  const [menuOptions, setMenuOptions] = useState<MenuVO[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [checkedMenuIds, setCheckedMenuIds] = useState<Array<string | number>>(
    [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<MenuForm>();
  const menuId = Form.useWatch('menuId', form);
  const dict = useDictOptions('sys_show_hide', 'sys_normal_disable');

  const loadList = useCallback(async (nextQuery: MenuQuery) => {
    setLoading(true);
    try {
      const response = await listMenu(nextQuery);
      const data = handleTree<MenuNode>(response.data, 'menuId');
      setList(data);
      setMenuOptions(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useInitialLoadEffect(() => {
    loadList(initialQuery);
  }, [loadList], {dedupeKey: 'system-menu-initial-list'});

  const columns: ColumnsType<MenuVO> = [
    { title: '菜单名称', dataIndex: 'menuName', width: 160, ellipsis: true },
    {
      title: '图标',
      dataIndex: 'icon',
      width: 120,
      align: 'center',
      render: (value: string) =>
        value && value !== '#' ? <SvgIcon iconClass={value} size={16} /> : '-',
    },
    { title: '排序', dataIndex: 'orderNum', width: 60, align: 'center' },
    { title: '权限标识', dataIndex: 'perms' },
    { title: '组件路径', dataIndex: 'component' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      align: 'center',
      render: (value: string) => (
        <DictTag options={dict.sys_normal_disable || []} value={value} />
      ),
    },
    { title: '创建时间', dataIndex: 'createTime', width: 160, align: 'center' },
    {
      title: '操作',
      key: 'action',
      width: 180,
      align: 'center',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="修改">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record.menuId)}
            />
          </Tooltip>
          <Tooltip title="新增">
            <Button
              type="link"
              icon={<PlusOutlined />}
              onClick={() => handleAdd(record.menuId)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              danger
              type="link"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.menuId, record.menuName)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleAdd = async (parentId?: string | number) => {
    const response = await listMenu();
    const data = handleTree<MenuVO>(response.data, 'menuId');
    setMenuOptions(data);
    form.setFieldsValue({
      ...initialForm,
      parentId: parentId ?? 0,
    });
    setDialogOpen(true);
  };

  const handleEdit = async (menuId?: string | number) => {
    if (!menuId) {
      return;
    }
    const allResponse = await listMenu();
    setMenuOptions(handleTree<MenuVO>(allResponse.data, 'menuId'));
    const detailResponse = await getMenu(menuId);
    form.setFieldsValue({ ...initialForm, ...detailResponse.data } as MenuForm);
    setDialogOpen(true);
  };

  const handleDelete = async (menuId?: string | number, menuName?: string) => {
    if (!menuId) {
      return;
    }
    const confirmed = await modal.confirm(
      `是否确认删除名称为 "${menuName || menuId}" 的数据项？`,
    );
    if (!confirmed) {
      return;
    }
    await delMenu(menuId);
    modal.msgSuccess('删除成功');
    loadList(query);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (values.menuId) {
        await updateMenu(values);
      } else {
        await addMenu(values);
      }
      modal.msgSuccess('操作成功');
      setDialogOpen(false);
      loadList(query);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {showSearch && (
        <Card>
          <Form layout="inline" className="query-form">
            <Row gutter={16} style={{ width: '100%' }}>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="菜单名称"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Input
                    allowClear
                    placeholder="请输入菜单名称"
                    value={query.menuName}
                    onChange={(event) =>
                      setQuery((prev) => ({
                        ...prev,
                        menuName: event.target.value,
                      }))
                    }
                    onPressEnter={() => loadList(query)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item
                  label="状态"
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <Select
                    allowClear
                    style={{ width: '100%' }}
                    placeholder="菜单状态"
                    value={query.status || undefined}
                    options={(dict.sys_normal_disable || []).map((item) => ({
                      label: item.label,
                      value: item.value,
                    }))}
                    onChange={(value) =>
                      setQuery((prev) => ({ ...prev, status: value || '' }))
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Form.Item style={{ marginBottom: 12 }}>
                  <Space>
                    <Button
                      type="primary"
                      icon={<SearchOutlined />}
                      onClick={() => loadList(query)}
                    >
                      搜索
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => {
                        setQuery(initialQuery);
                        loadList(initialQuery);
                      }}
                    >
                      重置
                    </Button>
                  </Space>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>
      )}

      <Card>
        <div className="table-toolbar">
          <Space wrap className="toolbar-buttons">
            <Button
              className="btn-plain-primary"
              icon={<PlusOutlined />}
              onClick={() => handleAdd()}
            >
              新增
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => setDeleteOpen(true)}
              style={{ borderColor: '#ffccc7' }}
            >
              级联删除
            </Button>
          </Space>
          <div className="right-toolbar-wrap">
            <RightToolbar
              showSearch={showSearch}
              onShowSearchChange={setShowSearch}
              onQueryTable={() => loadList(query)}
            />
          </div>
        </div>

        <Table<MenuVO>
          rowKey="menuId"
          bordered
          loading={loading}
          columns={columns}
          dataSource={list}
          pagination={false}
          expandable={{
            rowExpandable: (record) =>
              Array.isArray(record.children) && record.children.length > 0,
          }}
        />
      </Card>

      <Modal
        width={860}
        open={dialogOpen}
        title={menuId ? '修改菜单' : '新增菜单'}
        confirmLoading={submitting}
        onCancel={() => setDialogOpen(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical" initialValues={initialForm}>
          <Form.Item label="上级菜单" name="parentId">
            <TreeSelect
              treeData={toTreeSelectData(menuOptions)}
              placeholder="选择上级菜单"
              allowClear
              treeDefaultExpandAll
            />
          </Form.Item>
          <Form.Item label="菜单类型" name="menuType">
            <Radio.Group
              options={[
                { label: '目录', value: 'M' },
                { label: '菜单', value: 'C' },
                { label: '按钮', value: 'F' },
              ]}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="菜单名称"
                name="menuName"
                rules={[{ required: true, message: '菜单名称不能为空' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="显示排序"
                name="orderNum"
                rules={[{ required: true, message: '菜单顺序不能为空' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="是否外链" name="isFrame">
                <Radio.Group
                  options={[
                    { label: '是', value: '0' },
                    { label: '否', value: '1' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="路由地址"
                name="path"
                rules={[{ required: true, message: '路由地址不能为空' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="组件路径" name="component">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="权限字符" name="perms">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="路由参数" name="queryParam">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="是否缓存" name="isCache">
                <Radio.Group
                  options={[
                    { label: '缓存', value: '0' },
                    { label: '不缓存', value: '1' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="显示状态" name="visible">
                <Radio.Group
                  options={(dict.sys_show_hide || []).map((item) => ({
                    label: item.label,
                    value: item.value,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="菜单状态" name="status">
                <Radio.Group
                  options={(dict.sys_normal_disable || []).map((item) => ({
                    label: item.label,
                    value: item.value,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="图标" name="icon">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="激活路由" name="remark">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        open={deleteOpen}
        title="级联删除菜单"
        onCancel={() => setDeleteOpen(false)}
        onOk={async () => {
          if (checkedMenuIds.length === 0) {
            modal.msgWarning('请选择要删除的菜单');
            return;
          }
          await cascadeDelMenu(checkedMenuIds);
          modal.msgSuccess('删除成功');
          setDeleteOpen(false);
          setCheckedMenuIds([]);
          loadList(query);
        }}
      >
        <Tree
          checkable
          defaultExpandAll
          treeData={toTreeSelectData(menuOptions)}
          checkedKeys={checkedMenuIds.map(String)}
          onCheck={(keys) => {
            const nextKeys = Array.isArray(keys) ? keys : keys.checked;
            setCheckedMenuIds(nextKeys as Array<string | number>);
          }}
        />
      </Modal>
    </Space>
  );
}
