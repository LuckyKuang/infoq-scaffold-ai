import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import ConfigView from '@/views/system/config/index.vue';

const panelFixture = {
  groups: [
    {
      groupKey: 'account',
      groupName: '账号与登录',
      displayOrder: 10,
      items: [
        {
          configId: 5,
          configName: '是否开启注册',
          configKey: 'sys.account.registerUser',
          configValue: 'true',
          configType: 'Y',
          valueType: 'switch',
          defaultValue: 'false',
          groupKey: 'account',
          displayOrder: 10,
          options: null,
          uiProps: {},
          editable: true,
          editableReason: null,
          remark: '关闭后公开注册不可访问'
        },
        {
          configId: 2,
          configName: '初始密码',
          configKey: 'sys.user.initPassword',
          configValue: '123456',
          configType: 'Y',
          valueType: 'password',
          defaultValue: '123456',
          groupKey: 'account',
          displayOrder: 40,
          options: null,
          uiProps: {},
          editable: true,
          editableReason: null,
          remark: '初始化密码'
        }
      ]
    },
    {
      groupKey: 'theme',
      groupName: '界面与主题',
      displayOrder: 20,
      items: [
        {
          configId: 3,
          configName: '侧边栏主题',
          configKey: 'sys.index.sideTheme',
          configValue: 'theme-light',
          configType: 'Y',
          valueType: 'select',
          defaultValue: 'theme-light',
          groupKey: 'theme',
          displayOrder: 10,
          options: [
            { label: '深色主题', value: 'theme-dark' },
            { label: '浅色主题', value: 'theme-light' }
          ],
          uiProps: {},
          editable: true,
          editableReason: null,
          remark: '深色主题theme-dark，浅色主题theme-light'
        }
      ]
    }
  ]
};

const largePanelFixture = {
  groups: [
    {
      ...panelFixture.groups[0],
      items: Array.from({ length: 12 }, (_, index) => ({
        ...panelFixture.groups[0].items[0],
        configId: 100 + index,
        configName: `分页配置${index + 1}`,
        configKey: `sys.page.${index + 1}`,
        configValue: `value-${index + 1}`,
        valueType: 'text',
        remark: `分页测试${index + 1}`
      }))
    }
  ]
};

const configPageMocks = vi.hoisted(() => ({
  getConfigPanel: vi.fn(),
  addConfig: vi.fn(),
  updateConfig: vi.fn(),
  updateConfigByKey: vi.fn(),
  resetConfigByKey: vi.fn(),
  reorderConfig: vi.fn(),
  refreshCache: vi.fn(),
  msgSuccess: vi.fn(),
  msgWarning: vi.fn(),
  msgError: vi.fn(),
  download: vi.fn()
}));

vi.mock('@/api/system/config', () => ({
  getConfigPanel: configPageMocks.getConfigPanel,
  addConfig: configPageMocks.addConfig,
  updateConfig: configPageMocks.updateConfig,
  updateConfigByKey: configPageMocks.updateConfigByKey,
  resetConfigByKey: configPageMocks.resetConfigByKey,
  reorderConfig: configPageMocks.reorderConfig,
  refreshCache: configPageMocks.refreshCache
}));

vi.mock('@/store/modules/user', () => ({
  useUserStore: () => ({
    roles: ['superadmin']
  })
}));

const withAttrs = (attrs: Record<string, unknown>, className: string) => ({
  ...attrs,
  class: [className, attrs.class]
});

const passthroughStub = (name: string, className = `${name.toLowerCase()}-stub`) =>
  defineComponent({
    name,
    setup(_, { attrs, slots }) {
      return () => h('div', withAttrs(attrs, className), slots.default?.());
    }
  });

const ElCardStub = passthroughStub('ElCard', 'el-card-stub');
const ElTagStub = passthroughStub('ElTag', 'el-tag-stub');
const ElOptionStub = passthroughStub('ElOption', 'el-option-stub');
const ElFormItemStub = passthroughStub('ElFormItem', 'el-form-item-stub');

const ElButtonStub = defineComponent({
  name: 'ElButton',
  props: {
    disabled: {
      type: Boolean,
      default: false
    },
    icon: {
      type: String,
      default: ''
    }
  },
  emits: ['click'],
  setup(props, { attrs, slots, emit }) {
    return () =>
      h(
        'button',
        {
          ...withAttrs(attrs, 'el-button-stub'),
          disabled: props.disabled,
          'data-icon': props.icon,
          onClick: (event: MouseEvent) => {
            if (!props.disabled) {
              emit('click', event);
            }
          }
        },
        slots.default?.()
      );
  }
});

const ElInputStub = defineComponent({
  name: 'ElInput',
  props: {
    modelValue: {
      type: [String, Number],
      default: ''
    },
    type: {
      type: String,
      default: 'text'
    },
    placeholder: {
      type: String,
      default: ''
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue', 'keyup'],
  setup(props, { attrs, emit }) {
    return () =>
      h('input', {
        ...withAttrs(attrs, 'el-input-stub'),
        value: props.modelValue,
        type: props.type === 'password' ? 'password' : 'text',
        placeholder: props.placeholder,
        disabled: props.disabled,
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
        onKeyup: (event: KeyboardEvent) => emit('keyup', event)
      });
  }
});

const ElSwitchStub = defineComponent({
  name: 'ElSwitch',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  emits: ['change'],
  setup(props, { attrs, emit }) {
    return () =>
      h(
        'button',
        {
          ...withAttrs(attrs, 'el-switch-stub'),
          'data-checked': String(props.modelValue),
          disabled: props.disabled,
          onClick: () => {
            if (!props.disabled) {
              emit('change', !props.modelValue);
            }
          }
        },
        'switch'
      );
  }
});

const ElSelectStub = defineComponent({
  name: 'ElSelect',
  props: {
    modelValue: {
      type: [String, Number, Boolean],
      default: ''
    }
  },
  emits: ['update:modelValue', 'change'],
  setup(_, { attrs, slots }) {
    return () => h('div', withAttrs(attrs, 'el-select-stub'), slots.default?.());
  }
});

const ElFormStub = defineComponent({
  name: 'ElForm',
  setup(_, { attrs, slots, expose }) {
    expose({
      resetFields: vi.fn(),
      validate: (callback: (valid: boolean) => void) => callback(true)
    });
    return () => h('form', withAttrs(attrs, 'el-form-stub'), slots.default?.());
  }
});

const ElDrawerStub = defineComponent({
  name: 'ElDrawer',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    }
  },
  setup(props, { attrs, slots }) {
    return () => (props.modelValue ? h('div', withAttrs(attrs, 'el-drawer-stub'), slots.default?.()) : h('div'));
  }
});

const ElTabsStub = passthroughStub('ElTabs', 'el-tabs-stub');
const ElTabPaneStub = passthroughStub('ElTabPane', 'el-tab-pane-stub');
const ElTableStub = passthroughStub('ElTable', 'el-table-stub');
const ElTableColumnStub = passthroughStub('ElTableColumn', 'el-table-column-stub');
const ElInputNumberStub = ElInputStub;

const ElEmptyStub = defineComponent({
  name: 'ElEmpty',
  props: {
    description: {
      type: String,
      default: ''
    }
  },
  setup(props, { attrs }) {
    return () => h('div', withAttrs(attrs, 'el-empty-stub'), props.description);
  }
});

const PaginationStub = defineComponent({
  name: 'Pagination',
  props: {
    page: {
      type: Number,
      default: 1
    },
    limit: {
      type: Number,
      default: 5
    },
    total: {
      type: Number,
      default: 0
    }
  },
  emits: ['update:page', 'update:limit'],
  setup(props, { attrs, emit }) {
    return () =>
      h('div', withAttrs(attrs, 'pagination-stub'), [
        h(
          'button',
          {
            class: 'pagination-next',
            disabled: props.page * props.limit >= props.total,
            onClick: () => emit('update:page', props.page + 1)
          },
          'next'
        )
      ]);
  }
});

describe('views/system/config/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
    configPageMocks.getConfigPanel.mockResolvedValue({ data: panelFixture });
    configPageMocks.addConfig.mockResolvedValue(undefined);
    configPageMocks.updateConfig.mockResolvedValue(undefined);
    configPageMocks.updateConfigByKey.mockResolvedValue(undefined);
    configPageMocks.resetConfigByKey.mockResolvedValue({ data: 'false' });
    configPageMocks.reorderConfig.mockResolvedValue(undefined);
    configPageMocks.refreshCache.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(ConfigView, {
      global: {
        config: {
          globalProperties: {
            $modal: {
              msgSuccess: configPageMocks.msgSuccess,
              msgWarning: configPageMocks.msgWarning,
              msgError: configPageMocks.msgError
            },
            download: configPageMocks.download
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        directives: {
          loading: {}
        },
        stubs: {
          'el-card': ElCardStub,
          'el-input': ElInputStub,
          'el-button': ElButtonStub,
          'el-select': ElSelectStub,
          'el-option': ElOptionStub,
          'el-tag': ElTagStub,
          'el-switch': ElSwitchStub,
          'el-empty': ElEmptyStub,
          'el-drawer': ElDrawerStub,
          'el-tabs': ElTabsStub,
          'el-tab-pane': ElTabPaneStub,
          'el-form': ElFormStub,
          'el-form-item': ElFormItemStub,
          'el-input-number': ElInputNumberStub,
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          pagination: PaginationStub
        }
      }
    });

  it('loads config panel groups and typed items', async () => {
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('账号与登录');
    expect(wrapper.text()).toContain('是否开启注册');
    expect(wrapper.text()).toContain('初始密码');
    expect(wrapper.findAll('.config-setting-row')).toHaveLength(3);
    expect(wrapper.find('.config-list-panel').exists()).toBe(true);
    expect(wrapper.find('.config-list-scroll').exists()).toBe(true);
    expect(wrapper.text()).toContain('管理配置定义');
    expect(wrapper.find('input[placeholder="搜索配置名称、键名或备注"]').exists()).toBe(false);
    const actionLabels = wrapper.findAll('button.el-button-stub').map((button) => button.text().trim());
    expect(actionLabels).not.toContain('刷新');
    expect(actionLabels).toContain('刷新缓存');
    expect(configPageMocks.getConfigPanel).toHaveBeenCalled();
  });

  it('reports malformed config panel instead of rendering empty groups', async () => {
    configPageMocks.getConfigPanel.mockResolvedValueOnce({ data: {} });

    mountView();
    await flushPromises();

    expect(configPageMocks.msgError).toHaveBeenCalledWith('配置面板响应 data.groups 必须是数组');
  });

  it('paginates the config list with five rows per page and scrolls the page', async () => {
    configPageMocks.getConfigPanel.mockResolvedValueOnce({ data: largePanelFixture });
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('分页配置1');
    expect(wrapper.findAll('.config-setting-row')).toHaveLength(5);
    expect(wrapper.text()).not.toContain('分页配置6');

    await wrapper.find('button.pagination-next').trigger('click');
    await nextTick();

    expect(wrapper.text()).toContain('分页配置6');
    expect(wrapper.findAll('.config-setting-row')).toHaveLength(5);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it('updates switch config by key', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.el-switch-stub').trigger('click');
    await flushPromises();

    expect(configPageMocks.updateConfigByKey).toHaveBeenCalledWith('sys.account.registerUser', false);
  });

  it('enters password edit mode without leaving the config card layout', async () => {
    const wrapper = mountView();
    await flushPromises();

    const editButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '编辑');
    expect(editButton).toBeDefined();
    await editButton!.trigger('click');
    await nextTick();

    expect(wrapper.find('.config-card-main-editing').exists()).toBe(true);
    expect((wrapper.find('input[type="password"]').element as HTMLInputElement).value).toBe('123456');
  });

  it('restores default value by backend reset api', async () => {
    const wrapper = mountView();
    await flushPromises();

    const resetButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '恢复默认');
    expect(resetButton).toBeDefined();
    await resetButton!.trigger('click');
    await flushPromises();

    expect(configPageMocks.resetConfigByKey).toHaveBeenCalledWith('sys.account.registerUser');
  });
});
