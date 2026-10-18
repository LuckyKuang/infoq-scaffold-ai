import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide, reactive } from 'vue';
import SelectUserView from '@/views/system/role/selectUser.vue';

const selectUserMocks = vi.hoisted(() => ({
  unallocatedUserList: vi.fn(),
  authUserSelectAll: vi.fn(),
  toggleRowSelection: vi.fn(),
  resetFields: vi.fn(),
  msgSuccess: vi.fn(),
  msgError: vi.fn()
}));

vi.mock('@/api/system/role', () => ({
  unallocatedUserList: selectUserMocks.unallocatedUserList,
  authUserSelectAll: selectUserMocks.authUserSelectAll
}));

const TABLE_DATA_SYMBOL = Symbol('select-user-table-data');

const ElDialogStub = defineComponent({
  name: 'ElDialog',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue'],
  setup(props, { slots }) {
    return () => (props.modelValue ? h('div', { class: 'el-dialog-stub' }, [slots.default?.(), slots.footer?.()]) : h('div'));
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
  emits: ['row-click', 'selection-change'],
  setup(props, { slots, emit, expose }) {
    provide(
      TABLE_DATA_SYMBOL,
      computed(() => props.data as unknown[])
    );
    expose({
      toggleRowSelection: selectUserMocks.toggleRowSelection
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
      resetFields: selectUserMocks.resetFields
    });
    return () => h('form', { class: 'el-form-stub' }, slots.default?.());
  }
});

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    }
  });

describe('views/system/role/selectUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectUserMocks.unallocatedUserList.mockResolvedValue({
      rows: [
        {
          userId: 1,
          userName: 'u1',
          status: '0',
          createTime: '2026-03-07 10:00:00'
        },
        {
          userId: 2,
          userName: 'u2',
          status: '1',
          createTime: '2026-03-07 10:00:00'
        }
      ],
      total: 2
    });
    selectUserMocks.authUserSelectAll.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(SelectUserView, {
      props: {
        roleId: 10
      },
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
            parseTime: (value: string) => value,
            $modal: {
              msgSuccess: selectUserMocks.msgSuccess,
              msgError: selectUserMocks.msgError
            }
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        stubs: {
          'el-row': passthroughStub('ElRow'),
          'el-dialog': ElDialogStub,
          'el-form': ElFormStub,
          'el-form-item': passthroughStub('ElFormItem'),
          'el-input': true,
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          pagination: true,
          'dict-tag': true,
          'el-button': ElButtonStub
        }
      }
    });

  it('loads user list when show is called and handles row click', async () => {
    const wrapper = mountView();
    await (wrapper.vm as unknown as { show: () => void }).show();
    await flushPromises();

    expect(selectUserMocks.unallocatedUserList).toHaveBeenCalledTimes(1);
    expect(selectUserMocks.unallocatedUserList).toHaveBeenCalledWith(expect.objectContaining({ roleId: 10 }));
    expect(wrapper.find('.el-dialog-stub').exists()).toBe(true);

    await wrapper.find('button.row-click-first').trigger('click');
    expect(selectUserMocks.toggleRowSelection).toHaveBeenCalledWith(expect.objectContaining({ userId: 1 }), false);
  });

  it('validates selection before submit and emits ok after successful authorization', async () => {
    const wrapper = mountView();
    await (wrapper.vm as unknown as { show: () => void }).show();
    await flushPromises();

    const confirmButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(confirmButton).toBeDefined();

    await confirmButton!.trigger('click');
    expect(selectUserMocks.msgError).toHaveBeenCalledWith('请选择要分配的用户');

    await wrapper.find('button.selection-first').trigger('click');
    await confirmButton!.trigger('click');
    await flushPromises();

    expect(selectUserMocks.authUserSelectAll).toHaveBeenCalledWith({
      roleId: 10,
      userIds: '1'
    });
    expect(selectUserMocks.msgSuccess).toHaveBeenCalledWith('分配成功');
    expect(wrapper.emitted('ok')).toBeTruthy();
  });

  it('covers query and reset helper branches', async () => {
    const wrapper = mountView();
    await (wrapper.vm as unknown as { show: () => void }).show();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      queryParams: {
        pageNum?: number;
      };
      handleQuery: () => void;
      resetQuery: () => void;
    };
    vm.queryParams.pageNum = 3;
    vm.handleQuery();
    await flushPromises();
    expect(selectUserMocks.unallocatedUserList).toHaveBeenLastCalledWith(expect.objectContaining({ pageNum: 1 }));

    vm.resetQuery();
    await flushPromises();
    expect(selectUserMocks.unallocatedUserList).toHaveBeenCalledTimes(3);
  });
});
