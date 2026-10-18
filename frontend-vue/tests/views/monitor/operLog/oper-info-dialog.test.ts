import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, reactive } from 'vue';
import OperInfoDialog from '@/views/monitor/operLog/oper-info-dialog.vue';

vi.mock('vue-json-pretty', () => ({
  default: defineComponent({
    name: 'VueJsonPretty',
    props: {
      data: {
        type: [Object, String, Array],
        default: null
      }
    },
    setup(props) {
      return () => h('pre', { class: 'json-pretty-stub' }, JSON.stringify(props.data));
    }
  })
}));

const ElDialogStub = defineComponent({
  name: 'ElDialog',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue', 'closed'],
  setup(props, { slots }) {
    return () => (props.modelValue ? h('div', { class: 'el-dialog-stub' }, slots.default?.()) : h('div'));
  }
});

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    }
  });

describe('views/monitor/operLog/oper-info-dialog', () => {
  const mountView = () =>
    mount(OperInfoDialog, {
      global: {
        config: {
          globalProperties: {
            useDict: () =>
              reactive({
                sys_oper_type: [{ label: '新增', value: 1 }]
              }),
            selectDictLabel: (options: Array<{ label: string; value: number }>, value: number) =>
              options.find((item) => item.value === value)?.label || '',
            parseTime: (value: string) => value
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        stubs: {
          'el-dialog': ElDialogStub,
          'el-descriptions': passthroughStub('ElDescriptions'),
          'el-descriptions-item': passthroughStub('ElDescriptionsItem'),
          'el-tag': passthroughStub('ElTag')
        }
      }
    });

  it('opens dialog and renders operation detail', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as { openDialog: (row: Record<string, unknown>) => void };

    vm.openDialog({
      status: 0,
      operName: 'tester',
      deptName: '研发部',
      operIp: '127.0.0.1',
      operLocation: 'CN',
      requestMethod: 'GET',
      operUrl: '/system/user/list',
      title: '用户管理',
      businessType: 1,
      method: 'cc.infoq.UserController.list',
      operParam: '{"pageNum":1}',
      jsonResult: '{"rows":[]}',
      costTime: 20,
      operTime: '2026-03-07 10:00:00'
    });
    await nextTick();

    expect(wrapper.find('.el-dialog-stub').exists()).toBe(true);
    const text = wrapper.text();
    expect(text).toContain('tester');
    expect(text).toContain('用户管理');
    expect(text).toContain('新增');
  });

  it('closes dialog through exposed api', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as {
      openDialog: (row: Record<string, unknown>) => void;
      closeDialog: () => void;
    };

    vm.openDialog({
      status: 1,
      operName: 'tester',
      deptName: '研发部',
      operIp: '127.0.0.1',
      operLocation: 'CN',
      requestMethod: 'POST',
      operUrl: '/system/user',
      title: '用户管理',
      businessType: 1,
      method: 'cc.infoq.UserController.add',
      operParam: 'invalid-json',
      jsonResult: 'invalid-json',
      costTime: 35,
      operTime: '2026-03-07 10:00:00',
      errorMsg: 'boom'
    });
    await nextTick();
    expect(wrapper.find('.el-dialog-stub').exists()).toBe(true);

    vm.closeDialog();
    await nextTick();
    expect(wrapper.find('.el-dialog-stub').exists()).toBe(false);
  });
});
