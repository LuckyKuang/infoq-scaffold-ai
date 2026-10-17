import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide } from 'vue';
import AuthRoleView from '@/views/system/user/authRole.vue';

const authRoleMocks = vi.hoisted(() => ({
  route: {
    params: {
      userId: '100'
    }
  },
  getAuthRole: vi.fn(),
  updateAuthRole: vi.fn(),
  toggleRowSelection: vi.fn(),
  msgSuccess: vi.fn(),
  closeOpenPage: vi.fn()
}));

const TABLE_DATA_SYMBOL = Symbol('auth-role-table-data');

vi.mock('vue-router', () => ({
  useRoute: () => authRoleMocks.route
}));

vi.mock('@/api/system/user', () => ({
  getAuthRole: authRoleMocks.getAuthRole,
  updateAuthRole: authRoleMocks.updateAuthRole
}));

const ElTableStub = defineComponent({
  name: 'ElTable',
  props: {
    data: {
      type: Array,
      default: () => []
    }
  },
  emits: ['row-click', 'selection-change'],
  setup(props, { slots, emit, expose }) {
    provide(
      TABLE_DATA_SYMBOL,
      computed(() => props.data as unknown[])
    );
    expose({
      toggleRowSelection: authRoleMocks.toggleRowSelection
    });

    return () =>
      h('div', { class: 'el-table-stub' }, [
        h(
          'button',
          {
            class: 'row-click-first',
            onClick: () => emit('row-click', (props.data as unknown[])[0])
          },
          'row-click-first'
        ),
        h(
          'button',
          {
            class: 'row-click-second',
            onClick: () => emit('row-click', (props.data as unknown[])[1])
          },
          'row-click-second'
        ),
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
    return () =>
      h('div', { class: 'el-table-column-stub' }, (slots.default && slots.default({ row: rows.value[0] || { createTime: '' }, $index: 0 })) || []);
  }
});

const ElButtonStub = defineComponent({
  name: 'ElButton',
  emits: ['click'],
  setup(_, { slots, emit }) {
    return () =>
      h(
        'button',
        {
          class: 'el-button-stub',
          onClick: (e: MouseEvent) => emit('click', e)
        },
        slots.default?.()
      );
  }
});

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    }
  });

describe('views/system/user/authRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authRoleMocks.route.params.userId = '100';
    authRoleMocks.getAuthRole.mockResolvedValue({
      data: {
        user: {
          userId: '100',
          nickName: '测试用户',
          userName: 'tester'
        },
        roles: [
          {
            roleId: 1,
            roleName: '管理员',
            roleKey: 'admin',
            status: '0',
            flag: true
          },
          {
            roleId: 2,
            roleName: '访客',
            roleKey: 'guest',
            status: '1',
            flag: false
          }
        ]
      }
    });
    authRoleMocks.updateAuthRole.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(AuthRoleView, {
      global: {
        config: {
          globalProperties: {
            parseTime: (value: string) => value,
            $modal: {
              msgSuccess: authRoleMocks.msgSuccess
            },
            $tab: {
              closeOpenPage: authRoleMocks.closeOpenPage
            }
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        directives: {
          loading: {}
        },
        stubs: {
          'el-form': passthroughStub('ElForm'),
          'el-form-item': passthroughStub('ElFormItem'),
          'el-row': passthroughStub('ElRow'),
          'el-col': passthroughStub('ElCol'),
          'el-input': true,
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          pagination: true,
          'el-button': ElButtonStub
        }
      }
    });

  it('loads auth roles and preselects flagged role', async () => {
    mountView();
    await flushPromises();

    expect(authRoleMocks.getAuthRole).toHaveBeenCalledTimes(1);
    expect(authRoleMocks.getAuthRole).toHaveBeenCalledWith('100');
    expect(authRoleMocks.toggleRowSelection).toHaveBeenCalledWith(expect.objectContaining({ roleId: 1 }), true);
  });

  it('submits selected roles and navigates back', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.selection-first').trigger('click');

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '提交');
    expect(submitButton).toBeDefined();

    await submitButton!.trigger('click');
    await flushPromises();

    expect(authRoleMocks.updateAuthRole).toHaveBeenCalledTimes(1);
    expect(authRoleMocks.updateAuthRole).toHaveBeenCalledWith({
      userId: '100',
      roleIds: '1'
    });
    expect(authRoleMocks.msgSuccess).toHaveBeenCalledWith('授权成功');
    expect(authRoleMocks.closeOpenPage).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/system/user'
      })
    );
  });

  it('covers row-key/selectable helpers and non-selectable row click branch', async () => {
    const wrapper = mountView();
    await flushPromises();
    const vm = wrapper.vm as unknown as {
      getRowKey: (row: { roleId: number }) => string;
      checkSelectable: (row: { status: string }) => boolean;
    };

    expect(vm.getRowKey({ roleId: 99 })).toBe('99');
    expect(vm.checkSelectable({ status: '0' })).toBe(true);
    expect(vm.checkSelectable({ status: '1' })).toBe(false);

    authRoleMocks.toggleRowSelection.mockClear();
    await wrapper.find('button.row-click-first').trigger('click');
    expect(authRoleMocks.toggleRowSelection).toHaveBeenCalledWith(expect.objectContaining({ roleId: 1, flag: false }), false);

    authRoleMocks.toggleRowSelection.mockClear();
    await wrapper.find('button.row-click-second').trigger('click');
    expect(authRoleMocks.toggleRowSelection).not.toHaveBeenCalled();
  });
});
