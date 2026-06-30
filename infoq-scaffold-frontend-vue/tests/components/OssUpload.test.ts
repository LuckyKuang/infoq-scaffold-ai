import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import FileUpload from '@/components/FileUpload/index.vue';
import ImageUpload from '@/components/ImageUpload/index.vue';

const uploadMocks = vi.hoisted(() => ({
  listByIds: vi.fn(),
  delOss: vi.fn(),
  globalHeaders: vi.fn(() => ({
    Authorization: 'Bearer unit-token',
    clientid: 'unit-client'
  })),
  modal: {
    msgError: vi.fn(),
    loading: vi.fn(),
    closeLoading: vi.fn()
  }
}));

vi.mock('@/api/system/oss', () => ({
  listByIds: uploadMocks.listByIds,
  delOss: uploadMocks.delOss
}));

vi.mock('@/utils/request', () => ({
  globalHeaders: uploadMocks.globalHeaders
}));

vi.mock('@/plugins/modal', () => ({
  default: uploadMocks.modal
}));

const ElUploadStub = defineComponent({
  name: 'ElUpload',
  props: {
    action: {
      type: String,
      default: ''
    },
    headers: {
      type: Object,
      default: () => ({})
    },
    accept: {
      type: String,
      default: ''
    },
    limit: {
      type: Number,
      default: undefined
    },
    disabled: {
      type: Boolean,
      default: false
    },
    fileList: {
      type: Array,
      default: () => []
    },
    listType: {
      type: String,
      default: 'text'
    },
    beforeUpload: {
      type: Function,
      default: undefined
    },
    beforeRemove: {
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
    },
    onRemove: {
      type: Function,
      default: undefined
    },
    onExceed: {
      type: Function,
      default: undefined
    }
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        {
          class: 'el-upload-stub',
          'data-list-type': props.listType
        },
        slots.default?.()
      );
  }
});

const ElButtonStub = defineComponent({
  name: 'ElButton',
  setup(_, { slots }) {
    return () => h('button', { class: 'el-button-stub', type: 'button' }, slots.default?.());
  }
});

const mountUpload = (component: typeof FileUpload | typeof ImageUpload, props: Record<string, unknown> = {}) =>
  mount(component, {
    props,
    global: {
      stubs: {
        'el-upload': ElUploadStub,
        'el-button': ElButtonStub
      }
    }
  });

type UploadStubProps = {
  action: string;
  headers: Record<string, string>;
  accept: string;
  listType: string;
  fileList: Array<Record<string, unknown>>;
  beforeUpload: (file: File & { uid: number }) => boolean;
  beforeRemove: (file: { uid: number; name: string; status: string }) => Promise<boolean>;
  onSuccess: (response: unknown, file: { uid: number; name: string; status: string; url?: string }) => void;
  onError: (error: Error, file: { uid: number; name: string; status: string }) => void;
  onRemove: (file: { uid: number; name: string; status: string }, files: Array<Record<string, unknown>>) => void;
  onExceed: () => void;
};

const getUploadProps = (wrapper: ReturnType<typeof mountUpload>) => wrapper.findComponent(ElUploadStub).props() as unknown as UploadStubProps;

const rawFile = (name: string, type: string, size = 128) => {
  const file = new File(['x'], name, { type }) as File & { uid: number };
  file.uid = Math.floor(Math.random() * 100000);
  Object.defineProperty(file, 'size', {
    value: size,
    configurable: true
  });
  return file;
};

describe('components OSS upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (import.meta.env as Record<string, string>).VITE_APP_BASE_API = '/dev-api';
    uploadMocks.listByIds.mockResolvedValue({ data: [] });
    uploadMocks.delOss.mockResolvedValue(undefined);
  });

  it('renders a selectable file button and validates file uploads', () => {
    const wrapper = mountUpload(FileUpload);
    const uploadProps = getUploadProps(wrapper);

    expect(wrapper.text()).toContain('选取文件');
    expect(uploadProps.action).toBe('/dev-api/resource/oss/upload');
    expect(uploadProps.headers).toEqual({
      Authorization: 'Bearer unit-token',
      clientid: 'unit-client'
    });
    expect(uploadProps.accept).toBe('.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.pdf');

    expect(uploadProps.beforeUpload(rawFile('bad.exe', 'application/octet-stream'))).toBe(false);
    expect(uploadMocks.modal.msgError).toHaveBeenLastCalledWith('文件格式不正确，请上传 doc/docx/xls/xlsx/ppt/pptx/txt/pdf 格式文件');

    expect(uploadProps.beforeUpload(rawFile('bad,name.pdf', 'application/pdf'))).toBe(false);
    expect(uploadMocks.modal.msgError).toHaveBeenLastCalledWith('文件名不能包含英文逗号');

    expect(uploadProps.beforeUpload(rawFile('large.pdf', 'application/pdf', 6 * 1024 * 1024))).toBe(false);
    expect(uploadMocks.modal.msgError).toHaveBeenLastCalledWith('上传文件大小不能超过 5MB');

    expect(uploadProps.beforeUpload(rawFile('ok.pdf', 'application/pdf'))).toBe(true);
    expect(uploadMocks.modal.loading).toHaveBeenCalledWith('正在上传文件，请稍候...');
  });

  it('hydrates existing files, emits oss ids after upload and deletes removed files', async () => {
    uploadMocks.listByIds.mockResolvedValueOnce({
      data: [
        {
          ossId: 8,
          fileName: 'old.pdf',
          originalName: 'old-origin.pdf',
          fileSuffix: '.pdf',
          url: '/old.pdf',
          createByName: 'admin',
          service: 'local'
        }
      ]
    });

    const wrapper = mountUpload(FileUpload, { modelValue: '8' });
    await flushPromises();
    await nextTick();

    let uploadProps = getUploadProps(wrapper);
    expect(uploadMocks.listByIds).toHaveBeenCalledWith('8');
    expect(uploadProps.fileList).toEqual([expect.objectContaining({ ossId: 8, name: 'old-origin.pdf', url: '/old.pdf' })]);

    uploadProps.onSuccess(
      {
        code: 200,
        data: {
          ossId: 9,
          fileName: 'new.pdf',
          url: '/new.pdf'
        }
      },
      { uid: 9, name: 'new.pdf', status: 'success' }
    );
    await nextTick();
    expect(uploadMocks.modal.closeLoading).toHaveBeenCalled();
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['8,9']);

    uploadProps = getUploadProps(wrapper);
    await expect(uploadProps.beforeRemove({ uid: 8, name: 'old-origin.pdf', status: 'success' })).resolves.toBe(true);
    expect(uploadMocks.delOss).toHaveBeenCalledWith(8);

    uploadProps.onRemove({ uid: 8, name: 'old-origin.pdf', status: 'success' }, [{ uid: 9, name: 'new.pdf', ossId: 9 }]);
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['9']);
  });

  it('renders an image selector and validates image uploads', () => {
    const wrapper = mountUpload(ImageUpload);
    const uploadProps = getUploadProps(wrapper);

    expect(wrapper.text()).toContain('选择图片');
    expect(uploadProps.listType).toBe('picture-card');
    expect(uploadProps.accept).toBe('.png,.jpg,.jpeg');

    expect(uploadProps.beforeUpload(rawFile('bad.gif', 'image/gif'))).toBe(false);
    expect(uploadMocks.modal.msgError).toHaveBeenLastCalledWith('文件格式不正确，请上传 png/jpg/jpeg 图片格式文件');

    expect(uploadProps.beforeUpload(rawFile('ok.png', 'image/png'))).toBe(true);
    expect(uploadMocks.modal.loading).toHaveBeenCalledWith('正在上传图片，请稍候...');

    uploadProps.onSuccess(
      {
        code: 200,
        data: {
          ossId: '11',
          fileName: 'ok.png',
          url: '/ok.png'
        }
      },
      { uid: 11, name: 'ok.png', status: 'success' }
    );
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['11']);
  });

  it('reports upload failure and limit exceed with explicit errors', async () => {
    const fileWrapper = mountUpload(FileUpload);
    const fileUploadProps = getUploadProps(fileWrapper);

    fileUploadProps.onSuccess({ code: 500, msg: '上传失败' }, { uid: 1, name: 'bad.pdf', status: 'fail' });
    expect(uploadMocks.modal.msgError).toHaveBeenLastCalledWith('上传失败');

    fileUploadProps.onError(new Error('network'), { uid: 1, name: 'bad.pdf', status: 'fail' });
    expect(uploadMocks.modal.msgError).toHaveBeenLastCalledWith('上传文件失败');

    fileUploadProps.onExceed();
    expect(uploadMocks.modal.msgError).toHaveBeenLastCalledWith('最多上传 5 个文件');

    const imageWrapper = mountUpload(ImageUpload);
    const imageUploadProps = getUploadProps(imageWrapper);
    imageUploadProps.onExceed();
    expect(uploadMocks.modal.msgError).toHaveBeenLastCalledWith('最多上传 5 张图片');
  });
});
