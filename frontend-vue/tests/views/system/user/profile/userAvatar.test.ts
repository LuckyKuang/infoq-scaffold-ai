import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import UserAvatarView from '@/views/system/user/profile/userAvatar.vue';

const avatarMocks = vi.hoisted(() => ({
  uploadAvatar: vi.fn(),
  userStore: {
    avatar: 'https://cdn.example.com/old-avatar.png',
    setAvatar: vi.fn()
  },
  rotateLeft: vi.fn(),
  rotateRight: vi.fn(),
  changeScale: vi.fn(),
  getCropBlob: vi.fn((cb: (blob: Blob) => void) => cb(new Blob(['avatar'], { type: 'image/png' }))),
  msgSuccess: vi.fn(),
  msgError: vi.fn()
}));

vi.mock('@/api/system/user', () => ({
  uploadAvatar: avatarMocks.uploadAvatar
}));

vi.mock('@/store/modules/user', () => ({
  useUserStore: () => avatarMocks.userStore
}));

vi.mock('vue-cropper', () => ({
  VueCropper: {
    name: 'VueCropper',
    emits: ['real-time'],
    setup(_: unknown, { expose, emit }: { expose: (obj: Record<string, unknown>) => void; emit: (event: string, payload: unknown) => void }) {
      expose({
        rotateLeft: avatarMocks.rotateLeft,
        rotateRight: avatarMocks.rotateRight,
        changeScale: avatarMocks.changeScale,
        getCropBlob: avatarMocks.getCropBlob
      });
      return () =>
        h(
          'button',
          {
            class: 'emit-real-time',
            onClick: () =>
              emit('real-time', {
                url: 'https://preview.example.com/avatar-preview.png',
                img: { width: '80px', height: '80px' }
              })
          },
          'emit-real-time'
        );
    }
  }
}));

const ElDialogStub = defineComponent({
  name: 'ElDialog',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue', 'opened', 'close'],
  setup(props, { slots, emit }) {
    return () =>
      props.modelValue
        ? h('div', { class: 'el-dialog-stub' }, [
            h(
              'button',
              {
                class: 'emit-opened',
                onClick: () => emit('opened')
              },
              'opened'
            ),
            h(
              'button',
              {
                class: 'emit-close',
                onClick: () => {
                  emit('close');
                  emit('update:modelValue', false);
                }
              },
              'close'
            ),
            slots.default?.(),
            slots.footer?.()
          ])
        : h('div');
  }
});

const ElUploadStub = defineComponent({
  name: 'ElUpload',
  props: {
    beforeUpload: {
      type: Function,
      default: undefined
    }
  },
  setup(props, { slots }) {
    return () => h('div', { class: 'el-upload-stub' }, slots.default?.());
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

describe('views/system/user/profile/userAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    avatarMocks.userStore.avatar = 'https://cdn.example.com/old-avatar.png';
    avatarMocks.uploadAvatar.mockResolvedValue({
      data: {
        imgUrl: 'https://cdn.example.com/new-avatar.png'
      }
    });

    class MockFileReader {
      result: string | ArrayBuffer | null = 'data:image/png;base64,mock-avatar';
      onload: null | (() => void) = null;

      readAsDataURL() {
        Promise.resolve().then(() => {
          this.onload?.();
        });
      }
    }

    vi.stubGlobal('FileReader', MockFileReader as unknown as typeof FileReader);
  });

  it('supports upload flow and cropper actions', async () => {
    const wrapper = mount(UserAvatarView, {
      global: {
        config: {
          globalProperties: {
            $modal: {
              msgSuccess: avatarMocks.msgSuccess,
              msgError: avatarMocks.msgError
            }
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        stubs: {
          'el-dialog': ElDialogStub,
          'el-row': passthroughStub('ElRow'),
          'el-col': passthroughStub('ElCol'),
          'el-upload': ElUploadStub,
          'el-button': ElButtonStub,
          'el-icon': passthroughStub('ElIcon'),
          Upload: true
        }
      }
    });

    expect(wrapper.find('img.img-circle').attributes('src')).toBe('https://cdn.example.com/old-avatar.png');

    await wrapper.find('.user-info-head').trigger('click');
    await wrapper.find('button.emit-opened').trigger('click');
    await flushPromises();

    const uploadProps = wrapper.findComponent(ElUploadStub).props() as { beforeUpload: (file: File) => void };
    uploadProps.beforeUpload(new File(['bad'], 'bad.txt', { type: 'text/plain' }));
    expect(avatarMocks.msgError).toHaveBeenCalledTimes(1);

    uploadProps.beforeUpload(new File(['img'], 'avatar.png', { type: 'image/png' }));
    await flushPromises();

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '提交');
    expect(submitButton).toBeDefined();

    await submitButton!.trigger('click');
    await flushPromises();

    expect(avatarMocks.getCropBlob).toHaveBeenCalledTimes(1);
    expect(avatarMocks.uploadAvatar).toHaveBeenCalledTimes(1);
    expect(avatarMocks.userStore.setAvatar).toHaveBeenCalledTimes(1);
    expect(avatarMocks.userStore.setAvatar).toHaveBeenCalledWith('https://cdn.example.com/new-avatar.png');
    expect(avatarMocks.msgSuccess).toHaveBeenCalledWith('修改成功');
    expect(wrapper.find('img.img-circle').attributes('src')).toBe('https://cdn.example.com/new-avatar.png');
  });

  it('reports malformed avatar upload response', async () => {
    avatarMocks.uploadAvatar.mockResolvedValueOnce({ data: {} });
    const wrapper = mount(UserAvatarView, {
      global: {
        config: {
          globalProperties: {
            $modal: {
              msgSuccess: avatarMocks.msgSuccess,
              msgError: avatarMocks.msgError
            }
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        stubs: {
          'el-dialog': ElDialogStub,
          'el-row': passthroughStub('ElRow'),
          'el-col': passthroughStub('ElCol'),
          'el-upload': ElUploadStub,
          'el-button': ElButtonStub,
          'el-icon': passthroughStub('ElIcon'),
          Upload: true
        }
      }
    });

    await wrapper.find('.user-info-head').trigger('click');
    await wrapper.find('button.emit-opened').trigger('click');
    await flushPromises();

    const uploadProps = wrapper.findComponent(ElUploadStub).props() as { beforeUpload: (file: File) => void };
    uploadProps.beforeUpload(new File(['img'], 'avatar.png', { type: 'image/png' }));
    await flushPromises();

    const submitButton = wrapper.findAll('button.el-button-stub').find((button) => button.text().replace(/\s/g, '') === '提交');
    await submitButton!.trigger('click');
    await flushPromises();

    expect(avatarMocks.userStore.setAvatar).not.toHaveBeenCalled();
    expect(avatarMocks.msgError).toHaveBeenCalledWith('头像上传响应 data.imgUrl 必须是字符串');
  });

  it('covers rotate/scale/realtime preview and close dialog reset branches', async () => {
    const wrapper = mount(UserAvatarView, {
      global: {
        config: {
          globalProperties: {
            $modal: {
              msgSuccess: avatarMocks.msgSuccess,
              msgError: avatarMocks.msgError
            }
          } as unknown as import('vue').ComponentCustomProperties & Record<string, unknown>
        },
        stubs: {
          'el-dialog': ElDialogStub,
          'el-row': passthroughStub('ElRow'),
          'el-col': passthroughStub('ElCol'),
          'el-upload': ElUploadStub,
          'el-button': ElButtonStub,
          'el-icon': passthroughStub('ElIcon'),
          Upload: true
        }
      }
    });

    await wrapper.find('.user-info-head').trigger('click');
    await wrapper.find('button.emit-opened').trigger('click');
    await flushPromises();

    const plusButton = wrapper.findAll('button.el-button-stub').find((button) => button.attributes('data-icon') === 'Plus');
    const minusButton = wrapper.findAll('button.el-button-stub').find((button) => button.attributes('data-icon') === 'Minus');
    const rotateLeftButton = wrapper.findAll('button.el-button-stub').find((button) => button.attributes('data-icon') === 'RefreshLeft');
    const rotateRightButton = wrapper.findAll('button.el-button-stub').find((button) => button.attributes('data-icon') === 'RefreshRight');
    expect(plusButton).toBeDefined();
    expect(minusButton).toBeDefined();
    expect(rotateLeftButton).toBeDefined();
    expect(rotateRightButton).toBeDefined();

    await plusButton!.trigger('click');
    await minusButton!.trigger('click');
    await rotateLeftButton!.trigger('click');
    await rotateRightButton!.trigger('click');
    expect(avatarMocks.changeScale).toHaveBeenCalledWith(1);
    expect(avatarMocks.changeScale).toHaveBeenCalledWith(-1);
    expect(avatarMocks.rotateLeft).toHaveBeenCalledTimes(1);
    expect(avatarMocks.rotateRight).toHaveBeenCalledTimes(1);

    await wrapper.find('button.emit-real-time').trigger('click');
    await flushPromises();
    const previewImg = wrapper.find('.avatar-upload-preview img');
    expect(previewImg.attributes('src')).toBe('https://preview.example.com/avatar-preview.png');
    expect(previewImg.attributes('style')).toContain('width: 80px');

    const vm = wrapper.vm as unknown as {
      options: {
        img: string;
      };
    };
    vm.options.img = 'https://cdn.example.com/temp-avatar.png';
    await wrapper.find('button.emit-close').trigger('click');
    await flushPromises();
    expect(wrapper.find('img.img-circle').attributes('src')).toBe('https://cdn.example.com/old-avatar.png');
  });
});
