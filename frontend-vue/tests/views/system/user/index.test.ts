import { flushPromises, mount } from '@vue/test-utils';
import { computed, defineComponent, h, inject, provide, reactive } from 'vue';
import UserView from '@/views/system/user/index.vue';
import { ElMessageBox } from 'element-plus/es';

const userMocks = vi.hoisted(() => ({
  listUser: vi.fn(),
  deptTreeSelect: vi.fn(),
  delUser: vi.fn(),
  changeUserStatus: vi.fn(),
  getUser: vi.fn(),
  addUser: vi.fn(),
  updateUser: vi.fn(),
  resetUserPwd: vi.fn(),
  optionselect: vi.fn(),
  checkPermi: vi.fn(() => true),
  routerPush: vi.fn(),
  modalConfirm: vi.fn(() => Promise.resolve()),
  msgSuccess: vi.fn(),
  download: vi.fn(),
  getConfigKey: vi.fn(),
  treeFilter: vi.fn(),
  treeSetCurrentKey: vi.fn(),
  uploadSubmit: vi.fn(),
  uploadRemove: vi.fn(),
  rows: [
    {
      userId: 2,
      userName: 'tester',
      nickName: '测试用户',
      deptName: '研发部',
      phonenumber: '13800000000',
      status: '0',
      createTime: '2026-03-07 10:00:00'
    }
  ] as Array<Record<string, unknown>>,
  deptTree: [
    {
      id: 99,
      label: '研发部',
      disabled: false,
      children: []
    }
  ] as Array<Record<string, unknown>>
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: userMocks.routerPush
  })
}));

vi.mock('@/api/system/user', () => ({
  __esModule: true,
  default: {
    listUser: userMocks.listUser,
    deptTreeSelect: userMocks.deptTreeSelect,
    delUser: userMocks.delUser,
    changeUserStatus: userMocks.changeUserStatus,
    getUser: userMocks.getUser,
    addUser: userMocks.addUser,
    updateUser: userMocks.updateUser,
    resetUserPwd: userMocks.resetUserPwd
  }
}));

vi.mock('@/api/system/post', () => ({
  optionselect: userMocks.optionselect
}));

vi.mock('@/utils/permission', () => ({
  checkPermi: userMocks.checkPermi
}));

vi.mock('@/store/modules/user', () => ({
  useUserStore: () => ({
    userId: 100
  })
}));

vi.mock('@/utils/request', () => ({
  globalHeaders: () => ({ Authorization: 'Bearer unit-test' })
}));

const TABLE_DATA_SYMBOL = Symbol('user-table-data');

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
  emits: ['update:modelValue', 'close'],
  setup(props, { slots, emit }) {
    return () =>
      props.modelValue
        ? h('div', { class: 'el-dialog-stub', 'data-title': props.title }, [
            h(
              'button',
              {
                class: 'dialog-close',
                onClick: () => emit('close')
              },
              'close'
            ),
            slots.default?.(),
            slots.footer?.()
          ])
        : h('div');
  }
});

const ElFormStub = defineComponent({
  name: 'ElForm',
  setup(_, { slots, expose }) {
    expose({
      resetFields: vi.fn(),
      clearValidate: vi.fn(),
      validate: (cb: (valid: boolean) => void) => cb(true)
    });
    return () => h('form', { class: 'el-form-stub' }, slots.default?.());
  }
});

const ElTreeStub = defineComponent({
  name: 'ElTree',
  emits: ['node-click'],
  setup(_, { emit, expose }) {
    expose({
      filter: userMocks.treeFilter,
      setCurrentKey: userMocks.treeSetCurrentKey
    });
    return () =>
      h(
        'button',
        {
          class: 'tree-node-click',
          onClick: () => emit('node-click', { id: 99, label: '研发部' })
        },
        'tree-node-click'
      );
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
    return () =>
      h('div', { class: 'el-table-column-stub' }, (slots.default && slots.default({ row: rows.value[0] || { createTime: '' }, $index: 0 })) || []);
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

const ElUploadStub = defineComponent({
  name: 'ElUpload',
  setup(_, { slots, expose }) {
    expose({
      submit: userMocks.uploadSubmit,
      handleRemove: userMocks.uploadRemove
    });
    return () => h('div', { class: 'el-upload-stub' }, [slots.default?.(), slots.tip?.()]);
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

describe('views/system/user/index', () => {
  const messageBoxPromptMock = ElMessageBox.prompt as unknown as ReturnType<typeof vi.fn>;
  const messageBoxAlertMock = ElMessageBox.alert as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    userMocks.rows = [
      {
        userId: 2,
        userName: 'tester',
        nickName: '测试用户',
        deptName: '研发部',
        phonenumber: '13800000000',
        status: '0',
        createTime: '2026-03-07 10:00:00'
      }
    ];
    userMocks.deptTree = [
      {
        id: 99,
        label: '研发部',
        disabled: false,
        children: []
      }
    ];
    userMocks.listUser.mockImplementation(() =>
      Promise.resolve({
        rows: userMocks.rows,
        total: userMocks.rows.length
      })
    );
    userMocks.deptTreeSelect.mockResolvedValue({
      data: userMocks.deptTree
    });
    userMocks.getUser.mockImplementation((userId?: number | string) => {
      if (userId == null) {
        return Promise.resolve({
          data: {
            posts: [{ postId: 1, postName: '开发', status: '0' }],
            roles: [{ roleId: 1, roleName: '管理员', status: '0' }]
          }
        });
      }
      return Promise.resolve({
        data: {
          user: {
            userId: 2,
            deptId: 99,
            userName: 'tester',
            nickName: '测试用户',
            phonenumber: '13800000000',
            email: 'tester@infoq.cc',
            sex: '0',
            status: '0',
            roles: [{ roleId: 1, roleName: '管理员', status: '0' }]
          },
          posts: [{ postId: 1, postName: '开发', status: '0' }],
          roles: [{ roleId: 1, roleName: '管理员', status: '0' }],
          postIds: [1],
          roleIds: [1]
        }
      });
    });
    userMocks.addUser.mockResolvedValue(undefined);
    userMocks.updateUser.mockResolvedValue(undefined);
    userMocks.delUser.mockResolvedValue(undefined);
    userMocks.changeUserStatus.mockResolvedValue(undefined);
    userMocks.resetUserPwd.mockResolvedValue(undefined);
    userMocks.optionselect.mockResolvedValue({
      data: [{ postId: 1, postName: '开发', status: '0' }]
    });
    userMocks.getConfigKey.mockResolvedValue({
      data: 'Init@123'
    });
  });

  const mountView = () =>
    mount(UserView, {
      global: {
        config: {
          globalProperties: {
            useDict: () =>
              reactive({
                sys_normal_disable: [
                  { label: '正常', value: '0' },
                  { label: '停用', value: '1' }
                ],
                sys_user_sex: [
                  { label: '男', value: '0' },
                  { label: '女', value: '1' }
                ]
              }),
            animate: {
              searchAnimate: {
                enter: '',
                leave: ''
              }
            },
            addDateRange: (query: Record<string, unknown>, range: unknown[]) => ({ ...query, range }),
            $modal: {
              confirm: userMocks.modalConfirm,
              msgSuccess: userMocks.msgSuccess
            },
            download: userMocks.download,
            getConfigKey: userMocks.getConfigKey
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        directives: {
          loading: {},
          hasPermi: {},
          'has-permi': {}
        },
        stubs: {
          transition: passthroughStub('Transition'),
          'el-row': passthroughStub('ElRow'),
          'el-col': passthroughStub('ElCol'),
          'el-card': ElCardStub,
          'el-input': true,
          'el-tree': ElTreeStub,
          'el-form': ElFormStub,
          'el-form-item': passthroughStub('ElFormItem'),
          'el-select': passthroughStub('ElSelect'),
          'el-option': passthroughStub('ElOption'),
          'el-date-picker': true,
          'el-button': ElButtonStub,
          'el-dropdown': passthroughStub('ElDropdown'),
          'el-dropdown-menu': passthroughStub('ElDropdownMenu'),
          'el-dropdown-item': ElButtonStub,
          'el-icon': passthroughStub('ElIcon'),
          'arrow-down': true,
          'right-toolbar': true,
          'el-table': ElTableStub,
          'el-table-column': ElTableColumnStub,
          'el-switch': ElSwitchStub,
          'el-tooltip': passthroughStub('ElTooltip'),
          pagination: true,
          'el-dialog': ElDialogStub,
          'el-tree-select': true,
          'el-radio-group': passthroughStub('ElRadioGroup'),
          'el-radio': passthroughStub('ElRadio'),
          'el-upload': ElUploadStub,
          'el-checkbox': true,
          'el-link': ElButtonStub,
          'i-ep-upload-filled': true
        }
      }
    });

  it('loads department tree, user list and init password on mounted', async () => {
    mountView();
    await flushPromises();

    expect(userMocks.deptTreeSelect).toHaveBeenCalledTimes(1);
    expect(userMocks.listUser).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10
      })
    );
    expect(userMocks.getConfigKey).toHaveBeenCalledWith('sys.user.initPassword');
  });

  it('filters user list by clicked department node', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.tree-node-click').trigger('click');
    await flushPromises();

    expect(userMocks.listUser).toHaveBeenCalledTimes(2);
    expect(userMocks.listUser).toHaveBeenLastCalledWith(
      expect.objectContaining({
        deptId: 99,
        pageNum: 1
      })
    );
  });

  it('adds user successfully', async () => {
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

    expect(userMocks.getUser).toHaveBeenCalledTimes(1);
    expect(userMocks.addUser).toHaveBeenCalledWith(
      expect.objectContaining({
        password: 'Init@123'
      })
    );
    expect(userMocks.msgSuccess).toHaveBeenCalledWith('操作成功');
  });

  it('updates user successfully', async () => {
    const wrapper = mountView();
    await flushPromises();

    const editButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'Edit' && button.text().trim() === '');
    expect(editButton).toBeDefined();
    await editButton!.trigger('click');
    await flushPromises();

    expect(userMocks.getUser).toHaveBeenCalledWith(2);

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '确定');
    expect(submitButton).toBeDefined();
    await submitButton!.trigger('click');
    await flushPromises();

    expect(userMocks.updateUser).toHaveBeenCalledTimes(1);
    expect(userMocks.msgSuccess).toHaveBeenCalledWith('操作成功');
  });

  it('deletes user successfully', async () => {
    const wrapper = mountView();
    await flushPromises();

    const deleteButton = wrapper
      .findAll('button.el-button-stub')
      .find((button) => button.attributes('data-icon') === 'Delete' && button.text().trim() === '');
    expect(deleteButton).toBeDefined();
    await deleteButton!.trigger('click');
    await flushPromises();

    expect(userMocks.modalConfirm).toHaveBeenCalledWith(expect.stringContaining('"2"'));
    expect(userMocks.delUser).toHaveBeenCalledWith(2);
    expect(userMocks.msgSuccess).toHaveBeenCalledWith('删除成功');
  });

  it('changes status and jumps to auth role page', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('button.el-switch-stub').trigger('click');
    await flushPromises();

    expect(userMocks.changeUserStatus).toHaveBeenCalledWith(2, '1');
    expect(userMocks.msgSuccess).toHaveBeenCalledWith('停用成功');

    const authRoleButton = wrapper.findAll('button.el-button-stub').find((button) => button.attributes('data-icon') === 'CircleCheck');
    expect(authRoleButton).toBeDefined();
    await authRoleButton!.trigger('click');

    expect(userMocks.routerPush).toHaveBeenCalledWith('/system/user-auth/role/2');
  });

  it('covers filter/reset/cancel-delete and status rollback branches', async () => {
    const wrapper = mountView();
    await flushPromises();
    const vm = wrapper.vm as unknown as {
      ids: number[];
      single: boolean;
      multiple: boolean;
      form: {
        status: string;
        userId?: number;
        roleIds?: number[] | null;
        deptId?: number | null;
        postIds?: number[] | null;
      };
      dialog: {
        visible: boolean;
      };
      upload: {
        open: boolean;
        title: string;
        isUploading: boolean;
      };
      filterNode: (value: string, data: { label: string }) => boolean;
      filterDisabledDept: (data: Array<Record<string, unknown>>) => Array<Record<string, unknown>>;
      handleDelete: (row: { userId: number }) => Promise<void>;
      handleStatusChange: (row: { userId: number; userName: string; status: string }) => Promise<void>;
      resetQuery: () => void;
      handleResetPwd: (row: { userId: number; userName: string }) => Promise<void>;
      handleImport: () => void;
      submitFileForm: () => void;
      handleExport: () => void;
      importTemplate: () => void;
      handleFileUploadProgress: () => void;
      handleFileSuccess: (response: { msg: string }, file: { name: string }) => void;
      cancel: () => void;
      closeDialog: () => void;
      handleSelectionChange: (selection: Array<{ userId: number }>) => void;
      handleUpdate: (row: { userId: number }) => Promise<void>;
      submitForm: () => void;
      handleDeptChange: (deptId: number) => Promise<void>;
    };

    expect(vm.filterNode('', { label: '研发部' })).toBe(true);
    expect(vm.filterNode('研发', { label: '研发部' })).toBe(true);
    expect(vm.filterNode('财务', { label: '研发部' })).toBe(false);

    const filtered = vm.filterDisabledDept([
      { id: 1, label: '禁用部门', disabled: true, children: [] },
      {
        id: 2,
        label: '启用部门',
        disabled: false,
        children: [
          { id: 3, label: '禁用子部门', disabled: true, children: [] },
          { id: 4, label: '启用子部门', disabled: false, children: [] }
        ]
      }
    ]);
    expect(filtered).toEqual([
      {
        id: 2,
        label: '启用部门',
        disabled: false,
        children: [{ id: 4, label: '启用子部门', disabled: false, children: [] }]
      }
    ]);

    userMocks.modalConfirm.mockRejectedValueOnce(new Error('cancel-delete'));
    await vm.handleDelete({ userId: 2 });
    expect(userMocks.delUser).not.toHaveBeenCalled();

    userMocks.modalConfirm.mockRejectedValueOnce(new Error('cancel-status'));
    const row = { userId: 2, userName: 'tester', status: '1' };
    await vm.handleStatusChange(row);
    expect(row.status).toBe('0');

    vm.resetQuery();
    await flushPromises();
    expect(userMocks.treeSetCurrentKey).toHaveBeenCalledWith(undefined);
  });

  it('covers reset password/import-export/upload and dialog close flows', async () => {
    const wrapper = mountView();
    await flushPromises();
    const vm = wrapper.vm as unknown as {
      ids: number[];
      single: boolean;
      multiple: boolean;
      form: {
        status: string;
      };
      dialog: {
        visible: boolean;
      };
      upload: {
        open: boolean;
        title: string;
        isUploading: boolean;
      };
      handleResetPwd: (row: { userId: number; userName: string }) => Promise<void>;
      handleImport: () => void;
      submitFileForm: () => void;
      handleExport: () => void;
      importTemplate: () => void;
      handleFileUploadProgress: () => void;
      handleFileSuccess: (response: { msg: string }, file: { name: string }) => void;
      cancel: () => void;
      closeDialog: () => void;
      handleSelectionChange: (selection: Array<{ userId: number }>) => void;
    };

    messageBoxPromptMock.mockResolvedValueOnce({ value: 'NewPwd123' });
    await vm.handleResetPwd({ userId: 2, userName: 'tester' });
    const promptOptions = messageBoxPromptMock.mock.calls[0]?.[2] as {
      inputValidator: (value: string) => string | undefined;
    };
    expect(promptOptions?.inputValidator('<bad\\|pwd')).toBe('不能包含非法字符：< > " \' \\ |');
    expect(promptOptions?.inputValidator('NewPwd123')).toBeUndefined();
    expect(userMocks.resetUserPwd).toHaveBeenCalledWith(2, 'NewPwd123');
    expect(userMocks.msgSuccess).toHaveBeenCalledWith('修改成功，新密码是：NewPwd123');

    messageBoxPromptMock.mockRejectedValueOnce(new Error('cancel-reset-pwd'));
    await vm.handleResetPwd({ userId: 2, userName: 'tester' });

    vm.handleImport();
    expect(vm.upload.open).toBe(true);
    expect(vm.upload.title).toBe('用户导入');
    await flushPromises();

    vm.submitFileForm();
    expect(userMocks.uploadSubmit).toHaveBeenCalled();

    vm.handleExport();
    vm.importTemplate();
    expect(userMocks.download).toHaveBeenCalledWith(
      'system/user/export',
      expect.objectContaining({ pageNum: 1 }),
      expect.stringMatching(/^user_\d+\.xlsx$/)
    );
    expect(userMocks.download).toHaveBeenCalledWith('system/user/importTemplate', {}, expect.stringMatching(/^user_template_\d+\.xlsx$/));

    vm.handleFileUploadProgress();
    expect(vm.upload.isUploading).toBe(true);

    messageBoxAlertMock.mockResolvedValueOnce(undefined);
    vm.handleFileSuccess({ msg: '导入完成' }, { name: 'users.xlsx' });
    await flushPromises();
    expect(userMocks.uploadRemove).toHaveBeenCalled();

    vm.dialog.visible = true;
    vm.cancel();
    expect(vm.dialog.visible).toBe(false);

    vm.dialog.visible = true;
    vm.closeDialog();
    expect(vm.dialog.visible).toBe(false);
    expect(vm.form.status).toBe('1');

    vm.handleSelectionChange([{ userId: 2 }]);
    expect(vm.ids).toEqual([2]);
    expect(vm.single).toBe(false);
    expect(vm.multiple).toBe(false);
    vm.handleSelectionChange([]);
    expect(vm.ids).toEqual([]);
    expect(vm.single).toBe(true);
    expect(vm.multiple).toBe(true);
  });

  it('covers self-update submit branch and department change', async () => {
    const wrapper = mountView();
    await flushPromises();
    const vm = wrapper.vm as unknown as {
      form: {
        userId?: number;
        roleIds?: number[] | null;
        deptId?: number | null;
        postIds?: number[] | null;
      };
      handleUpdate: (row: { userId: number }) => Promise<void>;
      submitForm: () => void;
      handleDeptChange: (deptId: number) => Promise<void>;
    };

    await vm.handleUpdate({ userId: 2 });
    await flushPromises();

    vm.form.userId = 100;
    vm.form.roleIds = [1];
    vm.form.deptId = 99;
    vm.form.postIds = [1];
    vm.submitForm();
    await flushPromises();

    expect(userMocks.updateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 100,
        roleIds: null,
        deptId: null,
        postIds: null
      })
    );

    await vm.handleDeptChange(99);
    expect(userMocks.optionselect).toHaveBeenCalledWith(99);
    expect(vm.form.postIds).toEqual([]);
  });
});
