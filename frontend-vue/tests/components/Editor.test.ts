import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, reactive, type ComponentCustomProperties } from 'vue';
import Editor from '@/components/Editor/index.vue';

const editorMocks = vi.hoisted(() => ({
  quillFormat: vi.fn(),
  quillInsertEmbed: vi.fn(),
  quillSetSelection: vi.fn(),
  modalLoading: vi.fn(),
  modalCloseLoading: vi.fn(),
  modalMsgError: vi.fn()
}));

vi.mock('@/utils/request', () => ({
  globalHeaders: () => ({
    Authorization: 'Bearer test-token',
    clientid: 'test-client'
  })
}));

vi.mock('@vueup/vue-quill', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    Quill: {
      format: editorMocks.quillFormat
    },
    QuillEditor: defineComponent({
      name: 'QuillEditor',
      props: {
        content: {
          type: String,
          default: ''
        },
        options: {
          type: Object,
          default: () => ({})
        },
        style: {
          type: [String, Object, Array],
          default: undefined
        }
      },
      emits: ['update:content', 'text-change'],
      setup(props, { emit, expose }) {
        expose({
          getQuill: () => ({
            selection: {
              savedRange: {
                index: 2
              }
            },
            insertEmbed: editorMocks.quillInsertEmbed,
            setSelection: editorMocks.quillSetSelection
          })
        });
        return () =>
          h(
            'div',
            {
              class: 'quill-editor-stub',
              style: props.style as Record<string, string>
            },
            [
              h(
                'button',
                {
                  class: 'emit-text-change',
                  onClick: () => {
                    emit('update:content', '<p>changed</p>');
                    emit('text-change', { delta: [] });
                  }
                },
                'emit-text-change'
              )
            ]
          );
      }
    })
  };
});

const ElUploadStub = defineComponent({
  name: 'ElUpload',
  props: {
    beforeUpload: {
      type: Function,
      default: undefined
    },
    onSuccess: {
      type: Function,
      default: undefined
    },
    onError: {
      type: Function,
      default: undefined
    }
  },
  setup(_, { slots }) {
    return () => h('div', { class: 'el-upload-stub' }, slots.default?.());
  }
});

describe('components/Editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  type QuillEditorOptions = {
    modules: {
      toolbar: {
        handlers: {
          image: (value: boolean) => void;
        };
      };
    };
  };

  const globalProperties = {
    useDict: () => reactive({}),
    $modal: {
      loading: editorMocks.modalLoading,
      closeLoading: editorMocks.modalCloseLoading,
      msgError: editorMocks.modalMsgError
    }
  };

  const mountEditor = (props: Record<string, unknown> = {}) =>
    mount(Editor, {
      props,
      global: {
        config: {
          globalProperties: globalProperties as unknown as ComponentCustomProperties & Record<string, unknown>
        },
        stubs: {
          'el-upload': ElUploadStub
        }
      }
    });

  it('emits content update and provides editor style from props', async () => {
    const wrapper = mountEditor({
      modelValue: '<p>init</p>',
      height: 320,
      minHeight: 120
    });

    const quillWrapper = wrapper.findComponent({ name: 'QuillEditor' });
    expect((quillWrapper.props('style') as Record<string, string>).height).toBe('320px');
    expect((quillWrapper.props('style') as Record<string, string>).minHeight).toBe('120px');

    await wrapper.find('button.emit-text-change').trigger('click');

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['<p>changed</p>']);

    const options = quillWrapper.props('options') as QuillEditorOptions;
    const clickSpy = vi.spyOn(HTMLElement.prototype, 'click');
    options.modules.toolbar.handlers.image(true);
    expect(clickSpy).toHaveBeenCalled();
    options.modules.toolbar.handlers.image(false);
    expect(editorMocks.quillFormat).toHaveBeenCalledWith('image', true);
    clickSpy.mockRestore();
  });

  it('validates upload and handles success/failure callbacks', async () => {
    const wrapper = mountEditor();
    const uploadProps = wrapper.findComponent(ElUploadStub).props() as {
      beforeUpload: (file: File) => boolean;
      onSuccess: (res: unknown) => void;
      onError: (err: unknown) => void;
    };

    const wrongTypeResult = uploadProps.beforeUpload(new File(['txt'], 'bad.txt', { type: 'text/plain' }));
    expect(wrongTypeResult).toBe(false);
    expect(editorMocks.modalMsgError).toHaveBeenCalledWith('图片格式错误!');

    const tooLargeFile = new File([new Uint8Array(6 * 1024 * 1024)], 'too-large.png', { type: 'image/png' });
    const tooLargeResult = uploadProps.beforeUpload(tooLargeFile);
    expect(tooLargeResult).toBe(false);
    expect(editorMocks.modalMsgError).toHaveBeenCalledWith('上传文件大小不能超过 5 MB!');

    const largeFileResult = uploadProps.beforeUpload(new File(['png'], 'valid.png', { type: 'image/png' }));
    expect(largeFileResult).toBe(true);
    expect(editorMocks.modalLoading).toHaveBeenCalledWith('正在上传文件，请稍候...');

    uploadProps.onSuccess({
      code: 200,
      data: {
        url: 'https://cdn.example.com/editor.png'
      }
    });
    await flushPromises();

    expect(editorMocks.quillInsertEmbed).toHaveBeenCalledWith(2, 'image', 'https://cdn.example.com/editor.png');
    expect(editorMocks.quillSetSelection).toHaveBeenCalledWith(3);
    expect(editorMocks.modalCloseLoading).toHaveBeenCalled();

    uploadProps.onSuccess({ code: 500 });
    expect(editorMocks.modalMsgError).toHaveBeenCalledWith('图片插入失败');

    uploadProps.onError(new Error('upload failed'));
    expect(editorMocks.modalMsgError).toHaveBeenCalledWith('上传文件失败');
  });

  it('hides url uploader when type is not url', () => {
    const wrapper = mountEditor({
      type: 'base64'
    });

    expect(wrapper.findComponent(ElUploadStub).exists()).toBe(false);
  });
});
