import {act, fireEvent, render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {UploadFile, UploadProps} from 'antd/es/upload/interface';
import type {ChangeEvent, ReactNode} from 'react';

type TestCrudModalProps = {
  children: ReactNode;
  open?: boolean;
  okText?: ReactNode;
  onOk?: () => void | Promise<void>;
};

let confirmPromise: Promise<void> | undefined;

const ossApi = vi.hoisted(() => ({
  delOss: vi.fn(),
  listOss: vi.fn().mockResolvedValue({rows: [], total: 0}),
  uploadOss: vi.fn().mockResolvedValue({code: 200, data: {}}),
}));

vi.mock('@umijs/max', () => ({
  useNavigate: vi.fn(),
}));

vi.mock('@/hooks/useInitialLoadEffect', () => ({
  default: vi.fn(),
}));

vi.mock('@/components/Pagination', () => ({
  default: () => null,
}));

vi.mock('@/components/RightToolbar', () => ({
  default: () => null,
}));

vi.mock('@/components/CrudModal', () => ({
  default: ({children, open, okText = '确定', onOk}: TestCrudModalProps) =>
    open ? (
      <div role="dialog">
        {children}
        <button
          type="button"
          onClick={() => {
            confirmPromise = Promise.resolve(onOk?.());
          }}
        >
          {okText}
        </button>
      </div>
    ) : null,
}));

vi.mock('@/utils/modal', () => ({
  default: {
    closeLoading: vi.fn(),
    confirm: vi.fn(),
    loading: vi.fn(),
    msgError: vi.fn(),
    msgSuccess: vi.fn(),
    msgWarning: vi.fn(),
  },
}));

vi.mock('@/utils/permission', () => ({
  default: {
    hasPermiOr: () => true,
  },
}));

vi.mock('@/api/system/config', () => ({
  getConfigKey: vi.fn(),
  updateConfigByKey: vi.fn(),
}));

vi.mock('@/api/system/oss', () => ossApi);

vi.mock('antd', () => {
  const passthrough = ({children}: {children?: ReactNode}) => <div>{children}</div>;
  const TestButton = ({
    children,
    disabled,
    onClick,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
  const TestInput = ({
    onChange,
    placeholder,
    value,
  }: {
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    value?: string;
  }) => <input placeholder={placeholder} value={value} onChange={onChange} />;
  const TestForm = Object.assign(passthrough, {
    Item: passthrough,
    useForm: () => [{setFieldsValue: vi.fn()}],
  });
  const TestDatePicker = Object.assign(() => <input />, {
    RangePicker: () => <input />,
  });
  const TestUpload = Object.assign(
    ({accept, children, fileList = [], onChange}: UploadProps) => (
      <label>
        <input
          accept={typeof accept === 'string' ? accept : undefined}
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }
            const uploadFile: UploadFile = {
              uid: 'test-upload',
              name: file.name,
              originFileObj:
                file as unknown as NonNullable<UploadFile['originFileObj']>,
              status: 'done',
            };
            onChange?.({file: uploadFile, fileList: [uploadFile]});
          }}
        />
        {children}
        {fileList.map((file) => (
          <span key={file.uid}>{file.name}</span>
        ))}
      </label>
    ),
    {LIST_IGNORE: '__TEST_LIST_IGNORE__'},
  );

  return {
    Button: TestButton,
    Card: passthrough,
    Col: passthrough,
    DatePicker: TestDatePicker,
    Form: TestForm,
    Image: () => null,
    Input: TestInput,
    Row: passthrough,
    Space: passthrough,
    Table: passthrough,
    Tooltip: passthrough,
    Upload: TestUpload,
  };
});

const {default: OssPage} = await import('@/pages/system/oss/index');

describe('pages/system/oss', () => {
  beforeEach(() => {
    confirmPromise = undefined;
    ossApi.listOss.mockClear();
    ossApi.uploadOss.mockClear();
  });

  it('uploads an image only after dialog confirmation', async () => {
    render(<OssPage />);

    fireEvent.click(screen.getByRole('button', {name: /上传图片/}));
    const uploadInput = document.querySelector(
      '.oss-pending-upload input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['image'], 'local.png', {type: 'image/png'});
    fireEvent.change(uploadInput, {target: {files: [file]}});

    expect(ossApi.uploadOss).not.toHaveBeenCalled();
    expect(screen.getByText('local.png')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', {name: '确 定'}));
      await confirmPromise;
    });

    expect(ossApi.uploadOss).toHaveBeenCalledWith(file, 'file');
  });
});
