import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide, reactive } from 'vue';
import InviteView from '@/views/system/invite/index.vue';

const inviteMocks = vi.hoisted(() => ({
  listInvite: vi.fn(),
  generateInvite: vi.fn(),
  cancelInvite: vi.fn(),
  delInvite: vi.fn(),
  modalConfirm: vi.fn(() => Promise.resolve()),
  msgSuccess: vi.fn(),
  msgWarning: vi.fn(),
  download: vi.fn(),
  rows: [
    {
      inviteId: 1,
      inviteCode: 'INVITE-CODE',
      status: '0',
      usedUserEmail: '',
      creatorName: 'superadmin',
      createTime: '2026-05-13 10:00:00',
      expireTime: '2126-05-13 10:00:00',
      usedTime: '',
      canceledTime: '',
      canceledReason: '',
      remark: 'batch'
    }
  ] as Array<Record<string, unknown>>
}));

vi.mock('@/api/system/invite', () => ({
  listInvite: inviteMocks.listInvite,
  generateInvite: inviteMocks.generateInvite,
  cancelInvite: inviteMocks.cancelInvite,
  delInvite: inviteMocks.delInvite
}));

const TABLE_DATA_SYMBOL = Symbol('invite-table-data');

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
          onClick: (event: MouseEvent) => emit('click', event)
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

describe('views/system/invite/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inviteMocks.listInvite.mockResolvedValue({
      rows: inviteMocks.rows,
      total: inviteMocks.rows.length
    });
    inviteMocks.generateInvite.mockResolvedValue(undefined);
    inviteMocks.cancelInvite.mockResolvedValue(undefined);
    inviteMocks.delInvite.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(InviteView, {
      global: {
        config: {
          globalProperties: {
            useDict: () =>
              reactive({
                sys_invite_code_status: [
                  { label: '未使用', value: '0' },
                  { label: '已使用', value: '1' },
                  { label: '已作废', value: '2' },
                  { label: '已过期', value: '3' }
                ]
              }),
            animate: {
              searchAnimate: {
                enter: '',
                leave: ''
              }
            },
            addDateRange: (query: Record<string, unknown>, range: unknown[]) => ({ ...query, range }),
            parseTime: (value: string) => value,
            $modal: {
              confirm: inviteMocks.modalConfirm,
              msgSuccess: inviteMocks.msgSuccess,
              msgWarning: inviteMocks.msgWarning
            },
            download: inviteMocks.download
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        directives: {
          loading: {},
          hasPermi: {}
        },
        stubs: {
          transition: passthroughStub('Transition'),
          'el-row': passthroughStub('ElRow'),
          'el-col': passthroughStub('ElCol'),
          'el-card': ElCardStub,
          'el-form': ElFormStub,
          'el-form-item': passthroughStub('ElFormItem'),
          'el-input': true,
          'el-input-number': true,
          'el-select': passthroughStub('ElSelect'),
          'el-option': passthroughStub('ElOption'),
          'el-date-picker': true,
          'right-toolbar': true,
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          'dict-tag': true,
          pagination: true,
          'el-tooltip': passthroughStub('ElTooltip'),
          'el-dialog': ElDialogStub,
          'el-button': ElButtonStub,
          'el-switch': true
        }
      }
    });

  it('loads invite list on mounted', async () => {
    mountView();
    await flushPromises();

    expect(inviteMocks.listInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      })
    );
  });

  it('generates invite codes successfully', async () => {
    const wrapper = mountView();
    await flushPromises();

    const addButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '生成邀请码');
    expect(addButton).toBeDefined();
    await addButton!.trigger('click');
    await flushPromises();

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    expect(inviteMocks.generateInvite).toHaveBeenCalledTimes(1);
    expect(inviteMocks.msgSuccess).toHaveBeenCalledWith('生成成功');
  });

  it('cancels and deletes row actions', async () => {
    const wrapper = mountView();
    await flushPromises();

    const cancelButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'CircleClose' && button.text().trim() === '');
    expect(cancelButton).toBeDefined();
    await cancelButton!.trigger('click');
    await flushPromises();

    const confirmButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(confirmButton).toBeDefined();
    await confirmButton!.trigger('click');
    await flushPromises();
    expect(inviteMocks.cancelInvite).toHaveBeenCalledWith({
      inviteId: 1,
      canceledReason: ''
    });

    const deleteButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'Delete' && button.text().trim() === '');
    expect(deleteButton).toBeDefined();
    await deleteButton!.trigger('click');
    await flushPromises();

    expect(inviteMocks.delInvite).toHaveBeenCalledWith(1);
  });
});
