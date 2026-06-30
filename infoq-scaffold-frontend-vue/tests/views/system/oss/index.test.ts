import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide } from 'vue';
import OssView from '@/views/system/oss/index.vue';

const ossMocks = vi.hoisted(() => ({
  listOss: vi.fn(),
  delOss: vi.fn(),
  routerPush: vi.fn(),
  modalConfirm: vi.fn(() => Promise.resolve()),
  msgSuccess: vi.fn(),
  getConfigKey: vi.fn(),
  updateConfigByKey: vi.fn(),
  downloadOss: vi.fn(),
  rows: [
    {
      ossId: 1,
      fileName: 'demo.png',
      originalName: 'demo-origin.png',
      fileSuffix: '.png',
      url: 'https://example.com/demo.png',
      createTime: '2026-03-07 10:00:00',
      createByName: 'admin',
      service: 's3'
    }
  ] as Array<Record<string, unknown>>
}));

vi.mock('vue-router', () => ({
  createRouter: vi.fn(() => ({
    beforeEach: vi.fn(),
    afterEach: vi.fn(),
    push: vi.fn()
  })),
  createWebHistory: vi.fn(),
  useRouter: () => ({
    push: ossMocks.routerPush
  })
}));

vi.mock('@/api/system/oss', () => ({
  listOss: ossMocks.listOss,
  delOss: ossMocks.delOss
}));

const TABLE_DATA_SYMBOL = Symbol('oss-table-data');

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
      resetFields: vi.fn()
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
  emits: ['selection-change', 'header-click'],
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
      h(
        'div',
        { class: 'el-table-column-stub' },
        (slots.default &&
          slots.default({
            row: rows.value[0] || { createTime: '', fileSuffix: '', url: '', ossId: 0 },
            $index: 0
          })) ||
          []
      );
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

const FileUploadStub = defineComponent({
  name: 'FileUpload',
  setup() {
    return () => h('div', { class: 'file-upload-stub' }, [h('button', { class: 'choose-file-button', type: 'button' }, '选取文件')]);
  }
});

const ImageUploadStub = defineComponent({
  name: 'ImageUpload',
  setup() {
    return () => h('div', { class: 'image-upload-stub' }, [h('button', { class: 'choose-image-button', type: 'button' }, '选择图片')]);
  }
});

describe('views/system/oss/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ossMocks.rows = [
      {
        ossId: 1,
        fileName: 'demo.png',
        originalName: 'demo-origin.png',
        fileSuffix: '.png',
        url: 'https://example.com/demo.png',
        createTime: '2026-03-07 10:00:00',
        createByName: 'admin',
        service: 's3'
      }
    ];
    ossMocks.getConfigKey.mockResolvedValue({ data: 'true' });
    ossMocks.listOss.mockImplementation(() =>
      Promise.resolve({
        rows: ossMocks.rows,
        total: ossMocks.rows.length
      })
    );
    ossMocks.delOss.mockResolvedValue(undefined);
    ossMocks.updateConfigByKey.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(OssView, {
      global: {
        config: {
          globalProperties: {
            animate: {
              searchAnimate: {
                enter: '',
                leave: ''
              }
            },
            parseTime: (value: string) => value,
            addDateRange: (query: Record<string, unknown>, range: unknown[], suffix: string) => ({ ...query, range, suffix }),
            getConfigKey: ossMocks.getConfigKey,
            updateConfigByKey: ossMocks.updateConfigByKey,
            $modal: {
              confirm: ossMocks.modalConfirm,
              msgSuccess: ossMocks.msgSuccess
            },
            $download: {
              oss: ossMocks.downloadOss
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
          'el-date-picker': true,
          'right-toolbar': true,
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          pagination: true,
          'el-dialog': ElDialogStub,
          'el-tooltip': passthroughStub('ElTooltip'),
          'el-button': ElButtonStub,
          FileUpload: FileUploadStub,
          ImageUpload: ImageUploadStub,
          ImagePreview: true
        }
      }
    });

  it('loads oss list and preview config on mounted', async () => {
    mountView();
    await flushPromises();

    expect(ossMocks.getConfigKey).toHaveBeenCalledWith('sys.oss.previewListResource');
    expect(ossMocks.listOss).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      })
    );
  });

  it('opens upload dialog for file and image', async () => {
    const wrapper = mountView();
    await flushPromises();

    const fileButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '上传文件');
    const imageButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '上传图片');
    expect(fileButton).toBeDefined();
    expect(imageButton).toBeDefined();

    await fileButton!.trigger('click');
    await flushPromises();
    expect(wrapper.find('.el-dialog-stub[data-title=\"上传文件\"]').exists()).toBe(true);
    expect(wrapper.find('.file-upload-stub .choose-file-button').text()).toBe('选取文件');

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    await imageButton!.trigger('click');
    await flushPromises();
    expect(wrapper.find('.el-dialog-stub[data-title=\"上传图片\"]').exists()).toBe(true);
    expect(wrapper.find('.image-upload-stub .choose-image-button').text()).toBe('选择图片');
  });

  it('downloads and deletes by row action', async () => {
    const wrapper = mountView();
    await flushPromises();

    const downloadButton = wrapper.findAll('button.el-button-stub').find((button) => button.attributes('data-icon') === 'Download');
    expect(downloadButton).toBeDefined();
    await downloadButton!.trigger('click');
    expect(ossMocks.downloadOss).toHaveBeenCalledWith(1);

    const deleteButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'Delete' && button.text().trim() === '');
    expect(deleteButton).toBeDefined();
    await deleteButton!.trigger('click');
    await flushPromises();

    expect(ossMocks.delOss).toHaveBeenCalledWith(1);
    expect(ossMocks.msgSuccess).toHaveBeenCalledWith('删除成功');
  });

  it('toggles preview list resource', async () => {
    const wrapper = mountView();
    await flushPromises();

    const previewButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().includes('预览开关'));
    expect(previewButton).toBeDefined();
    await previewButton!.trigger('click');
    await flushPromises();

    expect(ossMocks.updateConfigByKey).toHaveBeenCalledWith('sys.oss.previewListResource', false);
    expect(ossMocks.msgSuccess).toHaveBeenCalledWith('停用成功');
  });

  it('navigates to oss config page', async () => {
    const wrapper = mountView();
    await flushPromises();

    const configButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '配置管理');
    expect(configButton).toBeDefined();
    await configButton!.trigger('click');

    expect(ossMocks.routerPush).toHaveBeenCalledWith('/system/oss-config/index');
  });

  it('covers query/reset/sort and suffix helper branches', async () => {
    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      ids: number[];
      single: boolean;
      multiple: boolean;
      queryParams: {
        orderByColumn?: string;
        isAsc?: string;
      };
      dialog: {
        visible: boolean;
      };
      handleQuery: () => void;
      handleSelectionChange: (selection: Array<{ ossId: number }>) => void;
      handleHeaderClass: (payload: { column: { multiOrder: string } }) => void;
      handleHeaderCLick: (column: { sortable: string; multiOrder: string; property: string }) => void;
      handleOrderChange: (property: string, order: string) => void;
      checkFileSuffix: (suffix: string | string[]) => boolean;
      resetQuery: () => void;
      handleFile: () => void;
      cancel: () => void;
      handlePreviewListResource: (value: boolean) => Promise<void>;
    };

    vm.handleQuery();
    await flushPromises();

    vm.handleSelectionChange([{ ossId: 1 }]);
    vm.handleSelectionChange([]);
    expect(vm.ids).toEqual([]);
    expect(vm.single).toBe(true);
    expect(vm.multiple).toBe(true);

    vm.handleHeaderClass({ column: { multiOrder: 'descending' } });
    const sortColumn = { sortable: 'custom', multiOrder: 'descending', property: 'service' };
    vm.handleHeaderCLick(sortColumn);
    expect(sortColumn.multiOrder).toBe('ascending');
    vm.handleHeaderCLick(sortColumn);
    expect(sortColumn.multiOrder).toBe('');
    vm.handleHeaderCLick(sortColumn);
    expect(sortColumn.multiOrder).toBe('descending');
    vm.handleHeaderCLick({ sortable: 'not-custom', multiOrder: 'descending', property: 'service' });
    await flushPromises();

    vm.handleOrderChange('service', 'ascending');
    await flushPromises();
    vm.handleOrderChange('service', '');
    await flushPromises();

    expect(vm.checkFileSuffix('.png')).toBe(true);
    expect(vm.checkFileSuffix(['.txt', '.jpg'])).toBe(true);
    expect(vm.checkFileSuffix('.pdf')).toBe(false);

    vm.resetQuery();
    await flushPromises();
    expect(vm.queryParams.orderByColumn).toBe('createTime');
    expect(vm.queryParams.isAsc).toBe('ascending');
  });

  it('covers cancel/delete by selected ids and preview toggle rejection path', async () => {
    const wrapper = mountView();
    await flushPromises();
    const vm = wrapper.vm as unknown as {
      dialog: {
        visible: boolean;
      };
      handleFile: () => void;
      cancel: () => void;
      handlePreviewListResource: (value: boolean) => Promise<void>;
    };

    vm.handleFile();
    expect(vm.dialog.visible).toBe(true);
    vm.cancel();
    expect(vm.dialog.visible).toBe(false);

    await wrapper.find('button.selection-first').trigger('click');
    await flushPromises();
    const toolbarDeleteButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().trim() === '删除');
    expect(toolbarDeleteButton).toBeDefined();
    await toolbarDeleteButton!.trigger('click');
    await flushPromises();
    expect(ossMocks.delOss).toHaveBeenCalledWith([1]);

    ossMocks.modalConfirm.mockRejectedValueOnce(new Error('cancel-preview'));
    await vm.handlePreviewListResource(true);
    await flushPromises();
    expect(ossMocks.updateConfigByKey).toHaveBeenCalledTimes(0);
  });
});
