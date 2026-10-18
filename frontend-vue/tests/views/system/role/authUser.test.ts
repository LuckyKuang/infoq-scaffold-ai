import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide, reactive } from 'vue';
import AuthUserView from '@/views/system/role/authUser.vue';

const authUserMocks = vi.hoisted(() => ({
  route: {
    params: {
      roleId: '200'
    }
  },
  allocatedUserList: vi.fn(),
  authUserCancel: vi.fn(),
  authUserCancelAll: vi.fn(),
  selectUserShow: vi.fn(),
  resetFields: vi.fn(),
  modalConfirm: vi.fn(() => Promise.resolve()),
  msgSuccess: vi.fn(),
  closeOpenPage: vi.fn()
}));

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
  return {
    ...actual,
    useRoute: () => authUserMocks.route
  };
});

vi.mock('@/api/system/role', () => ({
  allocatedUserList: authUserMocks.allocatedUserList,
  authUserCancel: authUserMocks.authUserCancel,
  authUserCancelAll: authUserMocks.authUserCancelAll
}));

const TABLE_DATA_SYMBOL = Symbol('auth-user-table-data');

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

const ElFormStub = defineComponent({
  name: 'ElForm',
  setup(_, { slots, expose }) {
    expose({
      resetFields: authUserMocks.resetFields
    });
    return () => h('form', { class: 'el-form-stub' }, slots.default?.());
  }
});

const SelectUserStub = defineComponent({
  name: 'SelectUser',
  emits: ['ok'],
  setup(_, { expose }) {
    expose({
      show: authUserMocks.selectUserShow
    });
    return () => h('div', { class: 'select-user-stub' });
  }
});

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    }
  });

const ElCardStub = defineComponent({
  name: 'ElCard',
  setup(_, { slots }) {
    return () => h('div', { class: 'el-card-stub' }, [slots.header?.(), slots.default?.()]);
  }
});

describe('views/system/role/authUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUserMocks.route.params.roleId = '200';
    authUserMocks.allocatedUserList.mockResolvedValue({
      rows: [
        {
          userId: 1,
          userName: 'tester',
          status: '0',
          createTime: '2026-03-07 10:00:00'
        }
      ],
      total: 1
    });
    authUserMocks.authUserCancel.mockResolvedValue(undefined);
    authUserMocks.authUserCancelAll.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(AuthUserView, {
      global: {
        config: {
          globalProperties: {
            useDict: () =>
              reactive({
                sys_normal_disable: [{ label: '正常', value: '0' }]
              }),
            animate: {
              searchAnimate: {
                enter: '',
                leave: ''
              }
            },
            $modal: {
              confirm: authUserMocks.modalConfirm,
              msgSuccess: authUserMocks.msgSuccess
            },
            $tab: {
              closeOpenPage: authUserMocks.closeOpenPage
            }
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        directives: {
          loading: {},
          hasPermi: {}
        },
        stubs: {
          transition: passthroughStub('Transition'),
          'el-form': ElFormStub,
          'el-form-item': passthroughStub('ElFormItem'),
          'el-input': true,
          'el-card': ElCardStub,
          'el-row': passthroughStub('ElRow'),
          'el-col': passthroughStub('ElCol'),
          'right-toolbar': true,
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          'el-tooltip': passthroughStub('ElTooltip'),
          'dict-tag': true,
          pagination: true,
          'select-user': SelectUserStub,
          SelectUser: SelectUserStub,
          'el-button': ElButtonStub
        }
      }
    });

  it('loads allocated users and supports opening select-user dialog and closing page', async () => {
    const wrapper = mountView();
    await flushPromises();

    expect(authUserMocks.allocatedUserList).toHaveBeenCalledWith(expect.objectContaining({ roleId: '200' }));

    const addUserButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '添加用户');
    const closeButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '关闭');
    expect(addUserButton).toBeDefined();
    expect(closeButton).toBeDefined();

    await addUserButton!.trigger('click');
    expect(authUserMocks.selectUserShow).toHaveBeenCalledTimes(1);

    await closeButton!.trigger('click');
    expect(authUserMocks.closeOpenPage).toHaveBeenCalledWith(expect.objectContaining({ path: '/system/role' }));
  });

  it('cancels authorization in batch after selecting users', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.selection-first').trigger('click');

    const batchCancelButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '批量取消授权');
    expect(batchCancelButton).toBeDefined();

    await batchCancelButton!.trigger('click');
    await flushPromises();

    expect(authUserMocks.modalConfirm).toHaveBeenCalledWith('是否取消选中用户授权数据项?');
    expect(authUserMocks.authUserCancelAll).toHaveBeenCalledWith({
      roleId: '200',
      userIds: '1'
    });
    expect(authUserMocks.msgSuccess).toHaveBeenCalledWith('取消授权成功');
  });

  it('covers query/reset helpers and single-user cancel authorization', async () => {
    const wrapper = mountView();
    await flushPromises();
    const vm = wrapper.vm as unknown as {
      handleQuery: () => void;
      resetQuery: () => void;
      cancelAuthUser: (row: { userId: number; userName: string }) => Promise<void>;
    };

    vm.handleQuery();
    await flushPromises();

    vm.resetQuery();
    await flushPromises();

    await vm.cancelAuthUser({ userId: 1, userName: 'tester' });
    await flushPromises();

    expect(authUserMocks.modalConfirm).toHaveBeenCalledWith('确认要取消该用户"tester"角色吗？');
    expect(authUserMocks.authUserCancel).toHaveBeenCalledWith({
      userId: 1,
      roleId: '200'
    });
    expect(authUserMocks.msgSuccess).toHaveBeenCalledWith('取消授权成功');
  });
});
