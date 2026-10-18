import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import ResetPwdView from '@/views/system/user/profile/resetPwd.vue';

const resetPwdMocks = vi.hoisted(() => ({
  updateUserPwd: vi.fn(),
  msgSuccess: vi.fn(),
  closePage: vi.fn()
}));

vi.mock('@/api/system/user', () => ({
  updateUserPwd: resetPwdMocks.updateUserPwd
}));

const ElFormStub = defineComponent({
  name: 'ElForm',
  setup(_, { slots, expose }) {
    expose({
      validate: (cb: (valid: boolean) => void) => cb(true),
      resetFields: vi.fn()
    });
    return () => h('form', { class: 'el-form-stub' }, slots.default?.());
  }
});

const ElInputStub = defineComponent({
  name: 'ElInput',
  props: {
    modelValue: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        class: 'el-input-stub',
        value: props.modelValue,
        onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value)
      });
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

describe('views/system/user/profile/resetPwd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPwdMocks.updateUserPwd.mockResolvedValue(undefined);
  });

  it('submits password reset and closes tab', async () => {
    const wrapper = mount(ResetPwdView, {
      global: {
        config: {
          globalProperties: {
            $modal: {
              msgSuccess: resetPwdMocks.msgSuccess
            },
            $tab: {
              closePage: resetPwdMocks.closePage
            }
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        stubs: {
          'el-form': ElFormStub,
          'el-form-item': passthroughStub('ElFormItem'),
          'el-input': ElInputStub,
          'el-button': ElButtonStub
        }
      }
    });

    const inputs = wrapper.findAll('input.el-input-stub');
    await inputs[0].setValue('old-password');
    await inputs[1].setValue('new-password');
    await inputs[2].setValue('new-password');

    const buttons = wrapper.findAll('button.el-button-stub');
    await buttons[0].trigger('click');
    await flushPromises();

    expect(resetPwdMocks.updateUserPwd).toHaveBeenCalledTimes(1);
    expect(resetPwdMocks.updateUserPwd).toHaveBeenCalledWith('old-password', 'new-password');
    expect(resetPwdMocks.msgSuccess).toHaveBeenCalledTimes(1);
    expect(resetPwdMocks.msgSuccess).toHaveBeenCalledWith('修改成功');

    const vm = wrapper.vm as unknown as {
      rules: {
        confirmPassword: Array<{
          validator: (rule: unknown, value: string, cb: (error?: Error) => void) => void;
        }>;
      };
      user: {
        newPassword: string;
      };
    };
    const equalValidator = vm.rules.confirmPassword[1].validator;
    vm.user.newPassword = 'new-password';
    const mismatchCb = vi.fn();
    equalValidator({}, 'not-same', mismatchCb);
    expect(mismatchCb).toHaveBeenCalledWith(expect.any(Error));
    const matchCb = vi.fn();
    equalValidator({}, 'new-password', matchCb);
    expect(matchCb).toHaveBeenCalledWith();

    await buttons[1].trigger('click');
    expect(resetPwdMocks.closePage).toHaveBeenCalledTimes(1);
  });
});
