import {fireEvent, screen, waitFor} from '@testing-library/react';
import type {ChangeEvent, ReactElement} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {renderWithRouter} from '../helpers/renderWithRouter';
import {clearInitialLoadEffectDedupe} from '@/hooks/useInitialLoadEffect';
import {setPermissionContext} from '@/utils/permission';

type MockFormInstance = {
  __store: Record<string, unknown>;
  setFieldsValue: (values: Record<string, unknown>) => void;
  setFieldValue: (name: string, value: unknown) => void;
  getFieldValue: (name: string) => unknown;
  resetFields: () => void;
  validateFields: () => Promise<Record<string, unknown>>;
};

vi.mock('antd', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const Form = (({
    children,
    form,
    initialValues,
  }: {
    children?: unknown;
    form?: MockFormInstance;
    initialValues?: Record<string, unknown>;
  }) => {
    if (form?.__store && initialValues) {
      Object.entries(initialValues).forEach(([key, value]) => {
        if (typeof form.__store[key] === 'undefined') {
          form.__store[key] = value;
        }
      });
    }
    return <form>{children as never}</form>;
  }) as unknown as {
    Item: ({
      children,
      label,
    }: {
      children?: unknown;
      label?: string;
    }) => ReactElement;
    useForm: () => [MockFormInstance];
    useWatch: (name: string, form?: MockFormInstance) => unknown;
  };

  Form.Item = ({ children, label }: { children?: unknown; label?: string }) => (
    <div>
      {label ? <span>{label}</span> : null}
      {children as never}
    </div>
  );
  Form.useForm = () => {
    const ref = React.useRef<MockFormInstance | null>(null);
    if (!ref.current) {
      const store: Record<string, unknown> = {};
      ref.current = {
        __store: store,
        setFieldsValue(values: Record<string, unknown>) {
          Object.assign(store, values);
        },
        setFieldValue(name: string, value: unknown) {
          store[name] = value;
        },
        getFieldValue(name: string) {
          return store[name];
        },
        resetFields() {
          Object.keys(store).forEach((key) => {
            delete store[key];
          });
        },
        async validateFields() {
          return { ...store };
        },
      };
    }
    return [ref.current];
  };
  Form.useWatch = (name: string, form?: MockFormInstance) =>
    form?.__store?.[name];

  const Button = ({
    children,
    onClick,
    disabled,
  }: {
    children?: unknown;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children as never}
    </button>
  );

  const Input = Object.assign(
    ({
      value,
      onChange,
      placeholder,
    }: {
      value?: string | number | readonly string[];
      onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
      placeholder?: string;
    }) => (
      <input
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
      />
    ),
    {
      TextArea: ({
        value,
        onChange,
        placeholder,
      }: {
        value?: string | number | readonly string[];
        onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
        placeholder?: string;
      }) => (
        <textarea
          value={value ?? ''}
          onChange={onChange}
          placeholder={placeholder}
        />
      ),
    },
  );

  const InputNumber = ({
    value,
    onChange,
  }: {
    value?: number | string;
    onChange?: (value: number) => void;
  }) => (
    <input
      type="number"
      value={value ?? ''}
      onChange={(event) =>
        onChange?.(Number((event.target as HTMLInputElement).value))
      }
    />
  );

  const DatePicker = Object.assign(() => <input data-testid="date-picker" />, {
    RangePicker: () => <div data-testid="range-picker" />,
  });

  const Select = () => <select />;
  const Switch = ({ checked }: { checked?: boolean }) => (
    <button type="button" role="switch" aria-checked={checked} />
  );
  const Table = ({
    dataSource,
  }: {
    dataSource?: Array<Record<string, unknown>>;
  }) => (
    <div>
      {dataSource?.map((item) => (
        <div key={String(item.inviteId)}>{item.inviteCode as string}</div>
      ))}
    </div>
  );
  const Modal = ({
    open,
    title,
    onOk,
    onCancel,
    children,
  }: {
    open?: boolean;
    title?: string;
    onOk?: () => void;
    onCancel?: () => void;
    children?: unknown;
  }) =>
    open ? (
      <div>
        {title ? <div>{title}</div> : null}
        {children as never}
        <button type="button" onClick={onOk}>
          确定
        </button>
        <button type="button" onClick={onCancel}>
          取消
        </button>
      </div>
    ) : null;

  const Typography = {
    Text: ({ children }: { children?: unknown }) => (
      <span>{children as never}</span>
    ),
  };

  const passthrough = ({ children }: { children?: unknown }) => (
    <div>{children as never}</div>
  );

  return {
    Button,
    Card: passthrough,
    Col: passthrough,
    Input,
    DatePicker,
    Form,
    InputNumber,
    Modal,
    Row: passthrough,
    Select,
    Space: passthrough,
    Switch,
    Table,
    Tooltip: passthrough,
    Typography,
  };
});

const invitePageMocks = vi.hoisted(() => ({
  listInvite: vi.fn(),
  generateInvite: vi.fn(),
  cancelInvite: vi.fn(),
  delInvite: vi.fn(),
}));

vi.mock('@/api/system/invite', () => ({
  listInvite: invitePageMocks.listInvite,
  generateInvite: invitePageMocks.generateInvite,
  cancelInvite: invitePageMocks.cancelInvite,
  delInvite: invitePageMocks.delInvite,
}));

vi.mock('@/hooks/useDictOptions', () => ({
  default: () => ({
    sys_invite_code_status: [
      { label: '未使用', value: '0' },
      { label: '已使用', value: '1' },
      { label: '已作废', value: '2' },
      { label: '已过期', value: '3' },
    ],
  }),
}));

vi.mock('@/components/Pagination', () => ({
  default: () => <div data-testid="pagination" />,
}));

vi.mock('@/components/RightToolbar', () => ({
  default: () => <div data-testid="right-toolbar" />,
}));

vi.mock('@/components/DictTag', () => ({
  default: ({ value }: { value?: string }) => <span>{value}</span>,
}));

vi.mock('@/utils/modal', () => ({
  default: {
    confirm: vi.fn().mockResolvedValue(true),
    msgSuccess: vi.fn(),
    msgWarning: vi.fn(),
    msgError: vi.fn(),
    loading: vi.fn(),
    closeLoading: vi.fn(),
  },
}));

vi.mock('@/utils/request', async () => {
  const actual =
    await vi.importActual<typeof import('@/utils/request')>('@/utils/request');
  return {
    ...actual,
    download: vi.fn(),
  };
});

const { default: InvitePage } = await import('@/pages/system/invite/index');

describe('pages/system/invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearInitialLoadEffectDedupe();
    setPermissionContext(['admin'], ['*:*:*']);
    invitePageMocks.listInvite.mockResolvedValue({
      rows: [
        {
          inviteId: 1,
          inviteCode: 'INVITE-CODE',
          status: '0',
          usedUserEmail: '',
          creatorName: 'superadmin',
          createTime: '2026-05-13 10:00:00',
          expireTime: '2126-05-13 10:00:00',
          usedTime: '',
          canceledTime: '',
          canceledReason: '',
          remark: 'batch',
        },
      ],
      total: 1,
    });
    invitePageMocks.generateInvite.mockResolvedValue(undefined);
  });

  it('loads invite list on mounted', async () => {
    renderWithRouter(<InvitePage />, '/system/invite');

    expect(await screen.findByText('生成邀请码')).toBeInTheDocument();
    await waitFor(() => {
      expect(invitePageMocks.listInvite).toHaveBeenCalled();
    });
  });

  it('hides generate action without add permission', async () => {
    setPermissionContext([], []);

    renderWithRouter(<InvitePage />, '/system/invite');

    expect(await screen.findByText('INVITE-CODE')).toBeInTheDocument();
    expect(screen.queryByText('生成邀请码')).not.toBeInTheDocument();
  });

  it('generates invite codes from modal', async () => {
    renderWithRouter(<InvitePage />, '/system/invite');

    fireEvent.click(await screen.findByRole('button', { name: '生成邀请码' }));
    fireEvent.click(await screen.findByRole('button', { name: '确定' }));

    await waitFor(() => {
      expect(invitePageMocks.generateInvite).toHaveBeenCalledWith({
        generateCount: 1,
        expireTime: undefined,
        remark: '',
      });
    });
  });
});
