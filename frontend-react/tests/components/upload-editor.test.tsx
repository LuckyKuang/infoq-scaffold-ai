import type { ChangeEventHandler, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const uploadEditorMocks = vi.hoisted(() => ({
  listByIds: vi.fn(),
  uploadOss: vi.fn(),
  delOss: vi.fn(),
  modal: {
    confirm: vi.fn(),
    msgSuccess: vi.fn(),
    msgWarning: vi.fn(),
    msgError: vi.fn(),
    loading: vi.fn(),
    closeLoading: vi.fn()
  }
}));

vi.mock('antd', async () => {
  const Upload = Object.assign(
    ({
      children,
      fileList,
      listType,
      showUploadList,
      beforeUpload,
      customRequest,
      onChange,
      onPreview
    }: {
      children?: ReactNode;
      fileList?: Array<{ uid: string; name?: string; url?: string; status?: string; response?: unknown }>;
      listType?: string;
      showUploadList?: boolean;
      beforeUpload?: (file: File & { uid: string }, fileList: Array<File & { uid: string }>) => boolean | symbol;
      customRequest?: (options: {
        file: File & { uid: string };
        filename: string;
        onProgress: (event: { percent: number }) => void;
        onSuccess: (response: unknown) => void;
        onError: (error: Error) => void;
      }) => void;
      onChange?: (info: {
        file: { uid: string; name: string; status: string; response?: unknown; error?: Error };
        fileList: Array<{ uid: string; name: string; status: string; response?: unknown; error?: Error }>;
      }) => void;
      onPreview?: (file: { uid: string; name?: string; url?: string }) => void;
    }) => {
      const runUpload = () => {
        const imageFile = listType === 'picture-card' || showUploadList === false;
        const file = Object.assign(
          new File(['payload'], imageFile ? 'demo.png' : 'demo.pdf', { type: imageFile ? 'image/png' : 'application/pdf' }),
          {
            uid: 'upload-1'
          }
        );
        const beforeResult = beforeUpload?.(file, [file]);
        if (beforeResult === Upload.LIST_IGNORE || beforeResult === false) {
          return;
        }
        const uploading = { uid: file.uid, name: file.name, status: 'uploading' };
        onChange?.({ file: uploading, fileList: [uploading] });
        customRequest?.({
          file,
          filename: 'file',
          onProgress: () => undefined,
          onSuccess: (response) => {
            const done = { uid: file.uid, name: file.name, status: 'done', response };
            onChange?.({ file: done, fileList: [done] });
          },
          onError: (error) => {
            const failed = { uid: file.uid, name: file.name, status: 'error', error };
            onChange?.({ file: failed, fileList: [failed] });
          }
        });
      };

      return (
        <div data-testid="upload-stub">
          {fileList?.map((file) => (
            <button key={file.uid} type="button" onClick={() => onPreview?.(file)}>
              {file.name}
            </button>
          ))}
          {children}
          {customRequest && (
            <button type="button" data-testid="simulate-upload" onClick={runUpload}>
              模拟上传
            </button>
          )}
        </div>
      );
    },
    {
      LIST_IGNORE: Symbol('LIST_IGNORE')
    }
  );

  const Button = ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  );

  const Image = ({ src }: { src?: string }) => (src ? <img alt="" src={src} /> : null);

  const Input = {
    TextArea: ({ value, onChange }: { value?: string; onChange?: ChangeEventHandler<HTMLTextAreaElement> }) => (
      <textarea value={value ?? ''} onChange={onChange} />
    )
  };

  const Space = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

  return {
    Button,
    Image,
    Input,
    Space,
    Upload
  };
});

vi.mock('@/api/system/oss', () => ({
  listByIds: uploadEditorMocks.listByIds,
  uploadOss: uploadEditorMocks.uploadOss,
  delOss: uploadEditorMocks.delOss
}));

vi.mock('@/utils/modal', () => ({
  default: uploadEditorMocks.modal
}));

const { default: FileUpload } = await import('@/components/FileUpload');
const { default: ImageUpload } = await import('@/components/ImageUpload');
const { default: Editor } = await import('@/components/Editor');
const { listByIds, uploadOss } = await import('@/api/system/oss');

describe('components/upload-editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadEditorMocks.listByIds.mockResolvedValue({
      code: 200,
      data: [
        {
          ossId: '1',
          originalName: 'demo.txt',
          url: 'https://cdn.example.com/demo.txt'
        }
      ]
    });
    uploadEditorMocks.delOss.mockResolvedValue(undefined);
    uploadEditorMocks.uploadOss.mockResolvedValue({
      code: 200,
      data: {
        ossId: '9',
        fileName: 'uploaded.png',
        url: 'https://cdn.example.com/uploaded.png'
      }
    });
  });

  it('renders FileUpload and hydrates files', async () => {
    render(<FileUpload value="1" />);

    expect(screen.getByText('选取文件')).toBeInTheDocument();
    expect(screen.getByText(/请上传大小不超过/)).toBeInTheDocument();
    await waitFor(() => {
      expect(listByIds).toHaveBeenCalledWith('1');
    });
    expect(screen.getByText('demo.txt')).toBeInTheDocument();
  });

  it('keeps FileUpload list when metadata loading fails', async () => {
    uploadEditorMocks.listByIds
      .mockResolvedValueOnce({
        code: 200,
        data: [
          {
            ossId: '1',
            originalName: 'demo.txt',
            url: 'https://cdn.example.com/demo.txt'
          }
        ]
      })
      .mockRejectedValueOnce(new Error('metadata failed'));

    const { rerender } = render(<FileUpload value="1" />);
    expect(await screen.findByText('demo.txt')).toBeInTheDocument();

    rerender(<FileUpload value="2" />);

    await waitFor(() => {
      expect(listByIds).toHaveBeenCalledWith('2');
    });
    expect(screen.getByText('demo.txt')).toBeInTheDocument();
    expect(uploadEditorMocks.modal.msgError).toHaveBeenCalledWith('加载已上传文件失败，请稍后重试');
  });

  it('keeps ImageUpload list when metadata loading fails', async () => {
    uploadEditorMocks.listByIds
      .mockResolvedValueOnce({
        code: 200,
        data: [
          {
            ossId: '1',
            originalName: 'demo.png',
            url: 'https://cdn.example.com/demo.png'
          }
        ]
      })
      .mockRejectedValueOnce(new Error('metadata failed'));

    const { rerender } = render(<ImageUpload value="1" />);
    expect(await screen.findByText('1')).toBeInTheDocument();

    rerender(<ImageUpload value="2" />);

    await waitFor(() => {
      expect(listByIds).toHaveBeenCalledWith('2');
    });
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(uploadEditorMocks.modal.msgError).toHaveBeenCalledWith('加载已上传图片失败，请稍后重试');
  });

  it('renders ImageUpload tips', () => {
    render(<ImageUpload fileSize={2} fileType={['png']} />);
    expect(screen.getByText(/请上传大小不超过/)).toBeInTheDocument();
    expect(screen.getByText('2MB')).toBeInTheDocument();
    expect(screen.getByText('png')).toBeInTheDocument();
  });

  it('closes ImageUpload loading after successful upload', async () => {
    const onChange = vi.fn();
    render(<ImageUpload onChange={onChange} />);

    fireEvent.click(screen.getByTestId('simulate-upload'));

    await waitFor(() => {
      expect(uploadOss).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('9');
    });
    expect(uploadEditorMocks.modal.loading).toHaveBeenCalledWith('正在上传图片，请稍候...');
    expect(uploadEditorMocks.modal.closeLoading).toHaveBeenCalled();
  });

  it('closes FileUpload loading after successful upload', async () => {
    const onChange = vi.fn();
    uploadEditorMocks.uploadOss.mockResolvedValueOnce({
      code: 200,
      data: {
        ossId: '10',
        fileName: 'uploaded.pdf',
        url: 'https://cdn.example.com/uploaded.pdf'
      }
    });
    render(<FileUpload onChange={onChange} />);

    fireEvent.click(screen.getByTestId('simulate-upload'));

    await waitFor(() => {
      expect(uploadOss).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('10');
    });
    expect(uploadEditorMocks.modal.loading).toHaveBeenCalledWith('正在上传文件，请稍候...');
    expect(uploadEditorMocks.modal.closeLoading).toHaveBeenCalled();
  });

  it('updates editor content', () => {
    const onChange = vi.fn();
    render(<Editor value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: '<p>hello</p>'
      }
    });

    expect(onChange).toHaveBeenCalledWith('<p>hello</p>');
  });

  it('inserts editor image after successful upload', async () => {
    const onChange = vi.fn();
    render(<Editor value="<p>hello</p>" onChange={onChange} />);

    fireEvent.click(screen.getByTestId('simulate-upload'));

    await waitFor(() => {
      expect(uploadOss).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('<p>hello</p><p><img src="https://cdn.example.com/uploaded.png" alt="image" /></p>');
    });
    expect(uploadEditorMocks.modal.closeLoading).toHaveBeenCalled();
  });
});
