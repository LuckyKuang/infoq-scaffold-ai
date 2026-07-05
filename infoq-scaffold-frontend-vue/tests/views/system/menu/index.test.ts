import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide, reactive } from 'vue';
import MenuView from '@/views/system/menu/index.vue';

const menuMocks = vi.hoisted(() => ({
  listMenu: vi.fn(),
  getMenu: vi.fn(),
  addMenu: vi.fn(),
  updateMenu: vi.fn(),
  delMenu: vi.fn(),
  cascadeDelMenu: vi.fn(),
  modalConfirm: vi.fn(() => Promise.resolve()),
  msgSuccess: vi.fn(),
  msgWarning: vi.fn(),
  updateKeyChildren: vi.fn(),
  checkedKeys: [1, 11] as Array<number | string>,
  rows: [
    {
      menuId: 1,
      parentId: 0,
      menuName: '演示目录',
      menuType: 'M',
      icon: 'system',
      orderNum: 1,
      perms: '',
      component: '',
      status: '0',
      createTime: '2026-03-07 10:00:00'
    },
    {
      menuId: 11,
      parentId: 1,
      menuName: '演示菜单',
      menuType: 'C',
      icon: 'menu',
      orderNum: 1,
      perms: 'system:menu:list',
      component: 'system/menu/index',
      status: '0',
      createTime: '2026-03-07 10:00:00'
    }
  ] as Array<Record<string, unknown>>
}));

vi.mock('@/api/system/menu', () => ({
  listMenu: menuMocks.listMenu,
  getMenu: menuMocks.getMenu,
  addMenu: menuMocks.addMenu,
  updateMenu: menuMocks.updateMenu,
  delMenu: menuMocks.delMenu,
  cascadeDelMenu: menuMocks.cascadeDelMenu
}));

const TABLE_DATA_SYMBOL = Symbol('menu-table-data');

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

const ElTableStub = defineComponent({
  name: 'ElTable',
  props: {
    data: {
      type: Array,
      default: () => []
    },
    load: {
      type: Function,
      default: undefined
    },
    expandChange: {
      type: Function,
      default: undefined
    }
  },
  setup(props, { slots, expose }) {
    provide(
      TABLE_DATA_SYMBOL,
      computed(() => props.data as unknown[])
    );
    expose({
      updateKeyChildren: menuMocks.updateKeyChildren
    });
    return () =>
      h('div', { class: 'el-table-stub' }, [
        h(
          'button',
          {
            class: 'trigger-load-empty',
            onClick: () => props.load?.({ menuId: 999, parentId: 0 }, {}, vi.fn())
          },
          'trigger-load-empty'
        ),
        h(
          'button',
          {
            class: 'trigger-load-root',
            onClick: () => props.load?.({ menuId: 1, parentId: 0 }, {}, vi.fn())
          },
          'trigger-load-root'
        ),
        h(
          'button',
          {
            class: 'trigger-load-child',
            onClick: () => props.load?.({ menuId: 11, parentId: 1 }, {}, vi.fn())
          },
          'trigger-load-child'
        ),
        h(
          'button',
          {
            class: 'trigger-collapse-child',
            onClick: () => props.expandChange?.({ menuId: 11 }, false)
          },
          'trigger-collapse-child'
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

const ElTreeStub = defineComponent({
  name: 'ElTree',
  setup(_, { expose }) {
    expose({
      setCheckedKeys: vi.fn(),
      getCheckedKeys: () => menuMocks.checkedKeys
    });
    return () => h('div', { class: 'el-tree-stub' });
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

const passthroughStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    }
  });

describe('views/system/menu/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    menuMocks.checkedKeys = [1, 11];
    menuMocks.rows = [
      {
        menuId: 1,
        parentId: 0,
        menuName: '演示目录',
        menuType: 'M',
        icon: 'system',
        orderNum: 1,
        perms: '',
        component: '',
        status: '0',
        createTime: '2026-03-07 10:00:00'
      },
      {
        menuId: 11,
        parentId: 1,
        menuName: '演示菜单',
        menuType: 'C',
        icon: 'menu',
        orderNum: 1,
        perms: 'system:menu:list',
        component: 'system/menu/index',
        status: '0',
        createTime: '2026-03-07 10:00:00'
      }
    ];
    menuMocks.listMenu.mockImplementation(() =>
      Promise.resolve({
        data: menuMocks.rows
      })
    );
    menuMocks.getMenu.mockResolvedValue({
      data: {
        menuId: 1,
        parentId: 0,
        menuName: '演示目录',
        icon: 'system',
        menuType: 'M',
        orderNum: 1,
        isFrame: '1',
        isCache: '0',
        path: 'demo',
        status: '0',
        visible: '0',
        children: [],
        createTime: '2026-03-07 10:00:00',
        createBy: 'admin'
      }
    });
    menuMocks.addMenu.mockResolvedValue(undefined);
    menuMocks.updateMenu.mockResolvedValue(undefined);
    menuMocks.delMenu.mockResolvedValue(undefined);
    menuMocks.cascadeDelMenu.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(MenuView, {
      global: {
        config: {
          globalProperties: {
            useDict: () =>
              reactive({
                sys_show_hide: [
                  { label: '显示', value: '0' },
                  { label: '隐藏', value: '1' }
                ],
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
            handleTree: (data: unknown[]) => data,
            $modal: {
              confirm: menuMocks.modalConfirm,
              msgSuccess: menuMocks.msgSuccess,
              msgWarning: menuMocks.msgWarning
            }
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
          'el-select': passthroughStub('ElSelect'),
          'el-option': passthroughStub('ElOption'),
          'right-toolbar': true,
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          'svg-icon': true,
          'dict-tag': true,
          'el-tooltip': passthroughStub('ElTooltip'),
          'el-tree-select': true,
          'el-radio-group': passthroughStub('ElRadioGroup'),
          'el-radio': passthroughStub('ElRadio'),
          'icon-select': true,
          'el-input-number': true,
          'el-dialog': ElDialogStub,
          'el-tree': ElTreeStub,
          'el-icon': passthroughStub('ElIcon'),
          'question-filled': true,
          'i-ep-question-filled': true,
          'el-button': ElButtonStub
        }
      }
    });

  it('loads menu list on mounted', async () => {
    mountView();
    await flushPromises();

    expect(menuMocks.listMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        menuName: undefined,
        status: undefined
      })
    );
  });

  it('adds menu successfully', async () => {
    const wrapper = mountView();
    await flushPromises();

    const addButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '新增');
    expect(addButton).toBeDefined();
    await addButton!.trigger('click');
    await flushPromises();

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    expect(menuMocks.addMenu).toHaveBeenCalledTimes(1);
    expect(menuMocks.msgSuccess).toHaveBeenCalledWith('操作成功');
  });

  it('updates menu successfully', async () => {
    const wrapper = mountView();
    await flushPromises();

    const editButton = wrapper.findAll('button.el-button-stub').find((button) => button.attributes('data-icon') === 'Edit');
    expect(editButton).toBeDefined();
    await editButton!.trigger('click');
    await flushPromises();

    expect(menuMocks.getMenu).toHaveBeenCalledWith(1);

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    expect(menuMocks.updateMenu).toHaveBeenCalledTimes(1);
    expect(menuMocks.updateMenu).toHaveBeenCalledWith(
      expect.not.objectContaining({
        children: expect.anything(),
        createTime: expect.anything(),
        createBy: expect.anything()
      })
    );
    expect(menuMocks.msgSuccess).toHaveBeenCalledWith('操作成功');
  });

  it('deletes single menu successfully', async () => {
    const wrapper = mountView();
    await flushPromises();

    const deleteButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'Delete' && button.text().trim() === '');
    expect(deleteButton).toBeDefined();
    await deleteButton!.trigger('click');
    await flushPromises();

    expect(menuMocks.modalConfirm).toHaveBeenCalledWith(expect.stringContaining('演示目录'));
    expect(menuMocks.delMenu).toHaveBeenCalledWith(1);
    expect(menuMocks.msgSuccess).toHaveBeenCalledWith('删除成功');
  });

  it('warns when cascade delete has no selected menu', async () => {
    menuMocks.checkedKeys = [];
    const wrapper = mountView();
    await flushPromises();

    const cascadeButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '级联删除');
    expect(cascadeButton).toBeDefined();
    await cascadeButton!.trigger('click');
    await flushPromises();

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    expect(menuMocks.msgWarning).toHaveBeenCalledWith('请选择要删除的菜单');
    expect(menuMocks.cascadeDelMenu).not.toHaveBeenCalled();
  });

  it('cascades delete by selected keys', async () => {
    menuMocks.checkedKeys = [1, 11];
    const wrapper = mountView();
    await flushPromises();

    const cascadeButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '级联删除');
    expect(cascadeButton).toBeDefined();
    await cascadeButton!.trigger('click');
    await flushPromises();

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    expect(menuMocks.cascadeDelMenu).toHaveBeenCalledWith([1, 11]);
    expect(menuMocks.msgSuccess).toHaveBeenCalledWith('删除成功');
  });

  it('covers lazy tree refresh and query/reset/cancel branches', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.trigger-load-empty').trigger('click');
    await wrapper.find('button.trigger-load-root').trigger('click');
    await wrapper.find('button.trigger-load-child').trigger('click');
    await flushPromises();

    expect(menuMocks.updateKeyChildren).toHaveBeenCalledWith(999, []);

    const searchButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '搜索');
    const resetButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '重置');
    expect(searchButton).toBeDefined();
    expect(resetButton).toBeDefined();

    await searchButton!.trigger('click');
    await flushPromises();
    await wrapper.find('button.trigger-collapse-child').trigger('click');
    await flushPromises();
    await resetButton!.trigger('click');
    await flushPromises();

    expect(menuMocks.listMenu).toHaveBeenCalledTimes(3);

    const addButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '新增');
    expect(addButton).toBeDefined();
    await addButton!.trigger('click');
    await flushPromises();

    const formDialogCancel = wrapper
      .find('.el-dialog-stub[data-title="添加菜单"]')
      .findAll('button.el-button-stub')
      .find((button) => button.text().replace(/\s/g, '') === '取消');
    expect(formDialogCancel).toBeDefined();
    await formDialogCancel!.trigger('click');
    await flushPromises();

    const cascadeButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '级联删除');
    expect(cascadeButton).toBeDefined();
    await cascadeButton!.trigger('click');
    await flushPromises();

    const cascadeCancel = wrapper
      .find('.el-dialog-stub[data-title="级联删除菜单"]')
      .findAll('button.el-button-stub')
      .find((button) => button.text().replace(/\s/g, '') === '取消');
    expect(cascadeCancel).toBeDefined();
    await cascadeCancel!.trigger('click');
    await flushPromises();
  });
});
