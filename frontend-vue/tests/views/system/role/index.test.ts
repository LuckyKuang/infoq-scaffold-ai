import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide, reactive } from 'vue';
import RoleView from '@/views/system/role/index.vue';

const roleMocks = vi.hoisted(() => ({
  listRole: vi.fn(),
  addRole: vi.fn(),
  updateRole: vi.fn(),
  getRole: vi.fn(),
  delRole: vi.fn(),
  changeRoleStatus: vi.fn(),
  dataScope: vi.fn(),
  deptTreeSelect: vi.fn(),
  menuTreeselect: vi.fn(),
  roleMenuTreeselect: vi.fn(),
  routerPush: vi.fn(),
  modalConfirm: vi.fn(() => Promise.resolve()),
  msgSuccess: vi.fn(),
  download: vi.fn(),
  rows: [
    {
      roleId: 2,
      roleName: '测试角色',
      roleKey: 'tester',
      roleSort: 1,
      status: '0',
      createTime: '2026-03-07 10:00:00'
    }
  ] as Array<Record<string, unknown>>
}));

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
  return {
    ...actual,
    useRouter: () => ({
      push: roleMocks.routerPush
    })
  };
});

vi.mock('@/api/system/role', () => ({
  addRole: roleMocks.addRole,
  changeRoleStatus: roleMocks.changeRoleStatus,
  dataScope: roleMocks.dataScope,
  delRole: roleMocks.delRole,
  getRole: roleMocks.getRole,
  listRole: roleMocks.listRole,
  updateRole: roleMocks.updateRole,
  deptTreeSelect: roleMocks.deptTreeSelect
}));

vi.mock('@/api/system/menu/index', () => ({
  treeselect: roleMocks.menuTreeselect,
  roleMenuTreeselect: roleMocks.roleMenuTreeselect
}));

const TABLE_DATA_SYMBOL = Symbol('role-index-table-data');

const ElCardStub = defineComponent({
  name: 'ElCard',
  setup(_, { slots }) {
    return () => h('div', { class: 'el-card-stub' }, [slots.header?.(), slots.default?.()]);
  }
});

const ElDialogStub = defineComponent({
  name: 'ElDialog',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue'],
  setup(props, { slots }) {
    return () =>
      props.modelValue ? h('div', { class: 'el-dialog-stub', 'data-title': props.title }, [slots.default?.(), slots.footer?.()]) : h('div');
  }
});

const ElFormStub = defineComponent({
  name: 'ElForm',
  setup(_, { slots, expose }) {
    expose({
      resetFields: vi.fn(),
      validate: (cb: (valid: boolean) => void) => cb(true)
    });
    return () => h('form', { class: 'el-form-stub' }, slots.default?.());
  }
});

const ElButtonStub = defineComponent({
  name: 'ElButton',
  props: {
    icon: {
      type: String,
      default: ''
    }
  },
  emits: ['click'],
  setup(props, { slots, emit }) {
    return () =>
      h(
        'button',
        {
          class: 'el-button-stub',
          'data-icon': props.icon,
          onClick: (e: MouseEvent) => emit('click', e)
        },
        slots.default?.()
      );
  }
});

const ElSwitchStub = defineComponent({
  name: 'ElSwitch',
  props: {
    modelValue: {
      type: String,
      default: '0'
    }
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    return () =>
      h(
        'button',
        {
          class: 'el-switch-stub',
          'data-status': props.modelValue,
          onClick: () => {
            const nextValue = props.modelValue === '0' ? '1' : '0';
            emit('update:modelValue', nextValue);
            emit('change', nextValue);
          }
        },
        'switch'
      );
  }
});

const ElTreeStub = defineComponent({
  name: 'ElTree',
  setup(_, { expose }) {
    expose({
      setCheckedKeys: vi.fn(),
      setCheckedNodes: vi.fn(),
      setChecked: vi.fn(),
      getCheckedKeys: () => [101],
      getHalfCheckedKeys: () => [102],
      store: {
        nodesMap: {
          101: { expanded: false },
          102: { expanded: false }
        }
      }
    });
    return () => h('div', { class: 'el-tree-stub' });
  }
});

const ElTableStub = defineComponent({
  name: 'ElTable',
  props: {
    data: {
      type: Array,
      default: () => []
    }
  },
  emits: ['selection-change'],
  setup(props, { slots, emit }) {
    provide(
      TABLE_DATA_SYMBOL,
      computed(() => props.data as unknown[])
    );
    return () =>
      h('div', { class: 'el-table-stub' }, [
        h(
          'button',
          {
            class: 'selection-first',
            onClick: () => emit('selection-change', [(props.data as unknown[])[0]])
          },
          'selection-first'
        ),
        slots.default?.()
      ]);
  }
});

const ElTableColumnStub = defineComponent({
  name: 'ElTableColumn',
  setup(_, { slots }) {
    const rows = inject(
      TABLE_DATA_SYMBOL,
      computed(() => [] as unknown[])
    );
    return () => h('div', { class: 'el-table-column-stub' }, (slots.default && slots.default({ row: rows.value[0] || {}, $index: 0 })) || []);
  }
});

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    }
  });

describe('views/system/role/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    roleMocks.rows = [
      {
        roleId: 2,
        roleName: '测试角色',
        roleKey: 'tester',
        roleSort: 1,
        status: '0',
        createTime: '2026-03-07 10:00:00'
      }
    ];
    roleMocks.listRole.mockImplementation(() =>
      Promise.resolve({
        rows: roleMocks.rows,
        total: roleMocks.rows.length
      })
    );
    roleMocks.menuTreeselect.mockResolvedValue({
      data: [{ id: 101, label: '系统管理' }]
    });
    roleMocks.roleMenuTreeselect.mockResolvedValue({
      data: { menus: [], checkedKeys: [] }
    });
    roleMocks.getRole.mockResolvedValue({
      data: {
        roleId: 2,
        roleName: '测试角色',
        roleKey: 'tester',
        roleSort: 1,
        status: '0'
      }
    });
    roleMocks.addRole.mockResolvedValue(undefined);
    roleMocks.updateRole.mockResolvedValue(undefined);
    roleMocks.changeRoleStatus.mockResolvedValue(undefined);
    roleMocks.delRole.mockResolvedValue(undefined);
    roleMocks.deptTreeSelect.mockResolvedValue({
      data: { checkedKeys: [], depts: [] }
    });
    roleMocks.dataScope.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(RoleView, {
      global: {
        config: {
          globalProperties: {
            useDict: () =>
              reactive({
                sys_normal_disable: [
                  { label: '正常', value: '0' },
                  { label: '停用', value: '1' }
                ]
              }),
            animate: {
              searchAnimate: {
                enter: '',
                leave: ''
              }
            },
            parseTime: (value: string) => value,
            addDateRange: (query: Record<string, unknown>, range: string[]) => ({ ...query, range }),
            $modal: {
              confirm: roleMocks.modalConfirm,
              msgSuccess: roleMocks.msgSuccess
            },
            download: roleMocks.download
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        directives: {
          loading: {},
          hasPermi: {}
        },
        stubs: {
          transition: passthroughStub('Transition'),
          'el-card': ElCardStub,
          'el-dialog': ElDialogStub,
          'el-row': passthroughStub('ElRow'),
          'el-col': passthroughStub('ElCol'),
          'el-form': ElFormStub,
          'el-form-item': passthroughStub('ElFormItem'),
          'el-input': true,
          'el-select': passthroughStub('ElSelect'),
          'el-option': passthroughStub('ElOption'),
          'el-date-picker': true,
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          'el-switch': ElSwitchStub,
          'el-tooltip': passthroughStub('ElTooltip'),
          pagination: true,
          'right-toolbar': true,
          'el-input-number': true,
          'el-radio-group': passthroughStub('ElRadioGroup'),
          'el-radio': passthroughStub('ElRadio'),
          'el-checkbox': true,
          'el-tree': ElTreeStub,
          'el-icon': passthroughStub('ElIcon'),
          'question-filled': true,
          'i-ep-question-filled': true,
          'el-button': ElButtonStub
        }
      }
    });

  it('loads role list on mount', async () => {
    mountView();
    await flushPromises();

    expect(roleMocks.listRole).toHaveBeenCalledTimes(1);
    expect(roleMocks.listRole).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      })
    );
  });

  it('changes role status and calls status api', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.el-switch-stub').trigger('click');
    await flushPromises();

    expect(roleMocks.modalConfirm).toHaveBeenCalledWith('确认要"停用""测试角色"角色吗?');
    expect(roleMocks.changeRoleStatus).toHaveBeenCalledWith(2, '1');
    expect(roleMocks.msgSuccess).toHaveBeenCalledWith('停用成功');
  });

  it('rolls back status when confirm is rejected', async () => {
    roleMocks.modalConfirm.mockRejectedValueOnce(new Error('cancel'));
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.el-switch-stub').trigger('click');
    await flushPromises();

    expect(roleMocks.rows[0].status).toBe('0');
    expect(roleMocks.changeRoleStatus).not.toHaveBeenCalled();
  });

  it('opens add dialog and submits new role', async () => {
    const wrapper = mountView();
    await flushPromises();

    const addButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '新增');
    expect(addButton).toBeDefined();
    await addButton!.trigger('click');
    await flushPromises();

    expect(roleMocks.menuTreeselect).toHaveBeenCalledTimes(1);

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    expect(roleMocks.addRole).toHaveBeenCalledTimes(1);
    expect(roleMocks.addRole).toHaveBeenCalledWith(
      expect.objectContaining({
        menuIds: [101, 102]
      })
    );
    expect(roleMocks.msgSuccess).toHaveBeenCalledWith('操作成功');
  });

  it('supports query/reset/delete/export and selection branches', async () => {
    const wrapper = mountView();
    await flushPromises();

    const searchButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '搜索');
    const resetButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '重置');
    const toolbarDeleteButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '删除');
    const exportButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '导出');

    expect(searchButton).toBeDefined();
    expect(resetButton).toBeDefined();
    expect(toolbarDeleteButton).toBeDefined();
    expect(exportButton).toBeDefined();

    await searchButton!.trigger('click');
    await flushPromises();

    await resetButton!.trigger('click');
    await flushPromises();

    await wrapper.find('button.selection-first').trigger('click');
    await flushPromises();

    await toolbarDeleteButton!.trigger('click');
    await flushPromises();
    expect(roleMocks.delRole).toHaveBeenCalledWith([2]);
    expect(roleMocks.msgSuccess).toHaveBeenCalledWith('删除成功');

    await exportButton!.trigger('click');
    expect(roleMocks.download).toHaveBeenCalledWith(
      'system/role/export',
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      }),
      expect.stringMatching(/^role_\d+\.xlsx$/)
    );
  });

  it('updates role and covers data-scope/tree helper branches', async () => {
    roleMocks.roleMenuTreeselect.mockResolvedValueOnce({
      data: { menus: [{ id: 101, label: '系统管理' }], checkedKeys: [101] }
    });
    roleMocks.deptTreeSelect.mockResolvedValueOnce({
      data: { checkedKeys: [101], depts: [{ id: 101, label: '研发部' }] }
    });

    const wrapper = mountView();
    await flushPromises();

    const rowEditButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'Edit' && button.text().trim() === '');
    expect(rowEditButton).toBeDefined();
    await rowEditButton!.trigger('click');
    await flushPromises();

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();
    expect(roleMocks.updateRole).toHaveBeenCalledTimes(1);

    const vm = wrapper.vm as unknown as {
      handleAdd: () => void;
      handleCheckedTreeExpand: (checked: boolean, type: 'menu' | 'dept') => void;
      handleCheckedTreeNodeAll: (checked: boolean, type: 'menu' | 'dept') => void;
      handleCheckedTreeConnect: (checked: boolean, type: 'menu' | 'dept') => void;
      cancel: () => void;
      dataScopeSelectChange: (value: string) => void;
      submitDataScope: () => Promise<void>;
      cancelDataScope: () => void;
    };
    vm.handleAdd();
    await flushPromises();
    vm.handleCheckedTreeExpand(true, 'menu');
    vm.handleCheckedTreeNodeAll(true, 'menu');
    vm.handleCheckedTreeConnect(false, 'menu');
    vm.cancel();
    await flushPromises();

    const rowDataScopeButton = wrapper.findAll('button.el-button-stub').find((button) => button.attributes('data-icon') === 'CircleCheck');
    expect(rowDataScopeButton).toBeDefined();
    await rowDataScopeButton!.trigger('click');
    await flushPromises();

    vm.handleCheckedTreeExpand(true, 'dept');
    vm.handleCheckedTreeNodeAll(true, 'dept');
    vm.handleCheckedTreeConnect(false, 'dept');
    vm.dataScopeSelectChange('1');
    await vm.submitDataScope();
    vm.cancelDataScope();
    vm.cancel();
    await flushPromises();

    expect(roleMocks.dataScope).toHaveBeenCalledTimes(1);
    expect(roleMocks.msgSuccess).toHaveBeenCalledWith('修改成功');
  });

  it('navigates to auth-user page from operation button', async () => {
    const wrapper = mountView();
    await flushPromises();

    const authUserButton = wrapper.findAll('button.el-button-stub').find((button) => button.attributes('data-icon') === 'User');
    expect(authUserButton).toBeDefined();

    await authUserButton!.trigger('click');
    expect(roleMocks.routerPush).toHaveBeenCalledWith('/system/role-auth/user/2');
  });
});
