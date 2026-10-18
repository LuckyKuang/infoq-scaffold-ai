import { flushPromises, mount } from '@vue/test-utils';
import { ElMessage } from 'element-plus/es';
import { defineComponent, h } from 'vue';
import ForgotPasswordView from '@/views/forgot-password.vue';

const forgotPasswordMocks = vi.hoisted(() => {
  return {
    forgotPassword: vi.fn(),
    getCodeImg: vi.fn(),
    sendEmailCode: vi.fn(),
    routerPush: vi.fn(),
    routerReplace: vi.fn(),
    t: vi.fn((key: string, params?: Record<string, unknown>) => {
      if (key === 'forgotPassword.countdown') {
        return `${params?.seconds}s`;
      }
      return key;
    })
  };
});

vi.mock('@/api/login', () => ({
  forgotPassword: forgotPasswordMocks.forgotPassword,
  getCodeImg: forgotPasswordMocks.getCodeImg,
  sendEmailCode: forgotPasswordMocks.sendEmailCode
}));

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: forgotPasswordMocks.routerPush,
    replace: forgotPasswordMocks.routerReplace
  }))
}));

vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    t: forgotPasswordMocks.t
  }))
}));

const ElFormStub = defineComponent({
  name: 'ElForm',
  setup(_, { slots, expose }) {
    expose({
      validate: (cb: (valid: boolean) => void) => cb(true)
    });
    return () => h('form', { class: 'el-form-stub' }, slots.default?.());
  }
});

const ElButtonStub = defineComponent({
  name: 'ElButton',
  emits: ['click'],
  setup(_, { attrs, emit, slots }) {
    return () =>
      h(
        'button',
        {
          class: attrs.class,
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

describe('views/forgot-password', () => {
  const messageMock = ElMessage as unknown as {
    success: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    forgotPasswordMocks.getCodeImg.mockResolvedValue({
      data: {
        captchaEnabled: true,
        img: 'img-data',
        uuid: 'uuid-3',
        forgotPasswordEnabled: true,
        mailEnabled: true
      }
    });
    forgotPasswordMocks.sendEmailCode.mockResolvedValue(undefined);
    forgotPasswordMocks.forgotPassword.mockResolvedValue(undefined);
  });

  const mountView = () =>
    mount(ForgotPasswordView, {
      global: {
        config: {
          globalProperties: {
            $t: (key: string) => key
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        stubs: {
          'el-form': ElFormStub,
          'el-form-item': passthroughStub('ElFormItem'),
          'el-input': passthroughStub('ElInput'),
          'el-button': ElButtonStub,
          'router-link': true,
          'lang-select': true,
          'svg-icon': true
        }
      }
    });

  const findButtonByText = (wrapper: ReturnType<typeof mountView>, text: string) =>
    wrapper.findAll('button').find((button) => button.text().includes(text))!;

  it('submits new password successfully and redirects to login', async () => {
    const wrapper = mountView();
    await flushPromises();
    await findButtonByText(wrapper, 'forgotPassword.submit').trigger('click');
    await flushPromises();

    expect(forgotPasswordMocks.forgotPassword).toHaveBeenCalledTimes(1);
    expect(messageMock.success).toHaveBeenCalledWith('forgotPassword.success');
    expect(forgotPasswordMocks.routerPush).toHaveBeenCalledWith('/login');
  });

  it('refreshes captcha after reset failure', async () => {
    forgotPasswordMocks.forgotPassword.mockRejectedValueOnce(new Error('reset-failed'));

    const wrapper = mountView();
    await flushPromises();
    await findButtonByText(wrapper, 'forgotPassword.submit').trigger('click');
    await flushPromises();

    expect(forgotPasswordMocks.getCodeImg).toHaveBeenCalledTimes(2);
    expect(forgotPasswordMocks.routerPush).not.toHaveBeenCalled();
  });

  it('sends forgot-password email code with scene isolation', async () => {
    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      form: {
        email: string;
        code: string;
        uuid: string;
      };
    };
    vm.form.email = 'user@example.com';
    vm.form.code = 'ABCD';
    vm.form.uuid = 'uuid-send';

    await wrapper.find('button.secondary-btn').trigger('click');
    await flushPromises();

    expect(forgotPasswordMocks.sendEmailCode).toHaveBeenCalledWith({
      email: 'user@example.com',
      scene: 'forgot_password',
      code: 'ABCD',
      uuid: 'uuid-send'
    });
    expect(messageMock.success).toHaveBeenCalledWith('forgotPassword.codeSent');
  });
});
