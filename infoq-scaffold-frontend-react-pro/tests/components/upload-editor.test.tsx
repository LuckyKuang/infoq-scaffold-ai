import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ChangeEventHandler, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const uploadEditorMocks = vi.hoisted(() => ({
  listByIds: vi.fn(),
  delOss: vi.fn(),
  modal: {
    confirm: vi.fn(),
    msgSuccess: vi.fn(),
    msgWarning: vi.fn(),
    msgError: vi.fn(),
    loading: vi.fn(),
    closeLoading: vi.fn(),
  },
}));

vi.mock('antd', async () => {
  const Upload = Object.assign(
    ({
      children,
      fileList,
      onPreview,
    }: {
      children?: ReactNode;
      fileList?: Array<{ uid: string; name?: string; url?: string }>;
      onPreview?: (file: { uid: string; name?: string; url?: string }) => void;
    }) => (
      <div data-testid="upload-stub">
        {fileList?.map((file) => (
          <button
            key={file.uid}
            type="button"
            onClick={() => onPreview?.(file)}
          >
            {file.name}
          </button>
        ))}
        {children}
      </div>
    ),
    {
      LIST_IGNORE: Symbol('LIST_IGNORE'),
    },
  );

  const Button = ({
    children,
    onClick,
  }: {
    children?: ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  );

  const Image = ({ src }: { src?: string }) =>
    src ? <img alt="" src={src} /> : null;

  const Input = {
    TextArea: ({
      value,
      onChange,
    }: {
      value?: string;
      onChange?: ChangeEventHandler<HTMLTextAreaElement>;
    }) => <textarea value={value ?? ''} onChange={onChange} />,
  };

  const Space = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );

  return {
    Button,
    Image,
    Input,
    Space,
    Upload,
  };
});

vi.mock('@/api/system/oss', () => ({
  listByIds: uploadEditorMocks.listByIds,
  delOss: uploadEditorMocks.delOss,
}));

vi.mock('@/utils/modal', () => ({
  default: uploadEditorMocks.modal,
}));

const { default: FileUpload } = await import('@/components/FileUpload');
const { default: ImageUpload } = await import('@/components/ImageUpload');
const { default: Editor } = await import('@/components/Editor');
const { listByIds } = await import('@/api/system/oss');

describe('components/upload-editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadEditorMocks.listByIds.mockResolvedValue({
      code: 200,
      data: [
        {
          ossId: '1',
          originalName: 'demo.txt',
          url: 'https://cdn.example.com/demo.txt',
        },
      ],
    });
    uploadEditorMocks.delOss.mockResolvedValue(undefined);
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
            url: 'https://cdn.example.com/demo.txt',
          },
        ],
      })
      .mockRejectedValueOnce(new Error('metadata failed'));

    const { rerender } = render(<FileUpload value="1" />);
    expect(await screen.findByText('demo.txt')).toBeInTheDocument();

    rerender(<FileUpload value="2" />);

    await waitFor(() => {
      expect(listByIds).toHaveBeenCalledWith('2');
    });
    expect(screen.getByText('demo.txt')).toBeInTheDocument();
    expect(uploadEditorMocks.modal.msgError).toHaveBeenCalledWith(
      '加载已上传文件失败，请稍后重试',
    );
  });

  it('keeps ImageUpload list when metadata loading fails', async () => {
    uploadEditorMocks.listByIds
      .mockResolvedValueOnce({
        code: 200,
        data: [
          {
            ossId: '1',
            originalName: 'demo.png',
            url: 'https://cdn.example.com/demo.png',
          },
        ],
      })
      .mockRejectedValueOnce(new Error('metadata failed'));

    const { rerender } = render(<ImageUpload value="1" />);
    expect(await screen.findByText('1')).toBeInTheDocument();

    rerender(<ImageUpload value="2" />);

    await waitFor(() => {
      expect(listByIds).toHaveBeenCalledWith('2');
    });
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(uploadEditorMocks.modal.msgError).toHaveBeenCalledWith(
      '加载已上传图片失败，请稍后重试',
    );
  });

  it('renders ImageUpload tips', () => {
    render(<ImageUpload fileSize={2} fileType={['png']} />);
    expect(screen.getByText(/请上传大小不超过/)).toBeInTheDocument();
    expect(screen.getByText('2MB')).toBeInTheDocument();
    expect(screen.getByText('png')).toBeInTheDocument();
  });

  it('updates editor content', () => {
    const onChange = vi.fn();
    render(<Editor value="" onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: '<p>hello</p>',
      },
    });

    expect(onChange).toHaveBeenCalledWith('<p>hello</p>');
  });
});
