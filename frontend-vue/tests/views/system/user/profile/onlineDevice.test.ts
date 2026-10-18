import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide, reactive } from 'vue';
import { ElMessageBox } from 'element-plus/es';
import OnlineDeviceView from '@/views/system/user/profile/onlineDevice.vue';

const onlineDeviceMocks = vi.hoisted(() => ({
  delOnline: vi.fn(),
  msgSuccess: vi.fn(),
  msgError: vi.fn(),
  refreshPage: vi.fn()
}));

vi.mock('@/api/monitor/online', () => ({
  delOnline: onlineDeviceMocks.delOnline
}));

const TABLE_ROW_SYMBOL = Symbol('table-row-symbol');

const ElTableStub = defineComponent({
  name: 'ElTable',
  props: {
    data: {
      type: Array,
      default: () => []
    }
  },
  setup(props, { slots }) {
    provide(
      TABLE_ROW_SYMBOL,
      computed(() => ((props.data as unknown[]) || [])[0] || {})
    );
    return () => h('div', { class: 'el-table-stub' }, slots.default?.());
  }
});

const ElTableColumnStub = defineComponent({
  name: 'ElTableColumn',
  setup(_, { slots }) {
    const row = inject(
      TABLE_ROW_SYMBOL,
      computed(() => ({}) as Record<string, unknown>)
    );
    return () => h('div', { class: 'el-table-column-stub' }, (slots.default && slots.default({ row: row.value })) || []);
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

describe('views/system/user/profile/onlineDevice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mountView = () =>
    mount(OnlineDeviceView, {
      props: {
        devices: [
          {
            tokenId: 'tk-100',
            deviceType: 'pc',
            ipaddr: '127.0.0.1',
            loginLocation: '上海',
            os: 'macOS',
            browser: 'Chrome',
            loginTime: '2026-03-07 10:00:00'
          }
        ]
      },
      global: {
        config: {
          globalProperties: {
            useDict: () =>
              reactive({
                sys_device_type: [{ label: 'PC', value: 'pc' }]
              }),
            parseTime: (value: string) => value,
            $modal: {
              msgSuccess: onlineDeviceMocks.msgSuccess,
              msgError: onlineDeviceMocks.msgError
            },
            $tab: {
              refreshPage: onlineDeviceMocks.refreshPage
            }
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        stubs: {
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          'el-tooltip': passthroughStub('ElTooltip'),
          'el-button': ElButtonStub,
          'dict-tag': true
        }
      }
    });

  it('deletes device and refreshes page when api returns success', async () => {
    (ElMessageBox.confirm as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    onlineDeviceMocks.delOnline.mockResolvedValueOnce({
      code: 200
    });

    const wrapper = mountView();
    await wrapper.find('button.el-button-stub').trigger('click');
    await flushPromises();

    expect(ElMessageBox.confirm).toHaveBeenCalledTimes(1);
    expect(onlineDeviceMocks.delOnline).toHaveBeenCalledTimes(1);
    expect(onlineDeviceMocks.delOnline).toHaveBeenCalledWith('tk-100');
    expect(onlineDeviceMocks.msgSuccess).toHaveBeenCalledWith('删除成功');
    expect(onlineDeviceMocks.refreshPage).toHaveBeenCalledTimes(1);
  });

  it('shows error message when api returns non-200 code', async () => {
    (ElMessageBox.confirm as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    onlineDeviceMocks.delOnline.mockResolvedValueOnce({
      code: 500,
      msg: '删除失败'
    });

    const wrapper = mountView();
    await wrapper.find('button.el-button-stub').trigger('click');
    await flushPromises();

    expect(onlineDeviceMocks.msgError).toHaveBeenCalledTimes(1);
    expect(onlineDeviceMocks.msgError).toHaveBeenCalledWith('删除失败');
  });
});
