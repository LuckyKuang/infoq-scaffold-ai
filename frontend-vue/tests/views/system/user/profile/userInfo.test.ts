import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import UserInfoView from '@/views/system/user/profile/userInfo.vue';

const userInfoMocks = vi.hoisted(() => ({
  updateUserProfile: vi.fn(),
  msgSuccess: vi.fn(),
  closePage: vi.fn()
}));

vi.mock('@/api/system/user', () => ({
  updateUserProfile: userInfoMocks.updateUserProfile
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

describe('views/system/user/profile/userInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userInfoMocks.updateUserProfile.mockResolvedValue(undefined);
  });

  it('submits user profile update and closes tab', async () => {
    const user = {
      nickName: '测试用户',
      phonenumber: '13800138000',
      email: 'tester@example.com',
      sex: '0'
    };

    const wrapper = mount(UserInfoView, {
      props: {
        user
      },
      global: {
        config: {
          globalProperties: {
            $modal: {
              msgSuccess: userInfoMocks.msgSuccess
            },
            $tab: {
              closePage: userInfoMocks.closePage
            }
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        stubs: {
          'el-form': ElFormStub,
          'el-form-item': passthroughStub('ElFormItem'),
          'el-input': true,
          'el-radio-group': passthroughStub('ElRadioGroup'),
          'el-radio': passthroughStub('ElRadio'),
          'el-button': ElButtonStub
        }
      }
    });

    const buttons = wrapper.findAll('button.el-button-stub');
    await buttons[0].trigger('click');
    await flushPromises();

    expect(userInfoMocks.updateUserProfile).toHaveBeenCalledTimes(1);
    expect(userInfoMocks.updateUserProfile).toHaveBeenCalledWith(user);
    expect(userInfoMocks.msgSuccess).toHaveBeenCalledTimes(1);
    expect(userInfoMocks.msgSuccess).toHaveBeenCalledWith('修改成功');

    await buttons[1].trigger('click');
    expect(userInfoMocks.closePage).toHaveBeenCalledTimes(1);
  });
});
