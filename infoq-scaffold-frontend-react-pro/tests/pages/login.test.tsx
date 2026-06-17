import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loginPageMocks = vi.hoisted(() => ({
  fetchUserInfo: vi.fn(),
  getCodeImg: vi.fn(),
  getOAuthProviders: vi.fn(),
  login: vi.fn(),
  setInitialState: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  SelectLang: () => null,
  useIntl: () => ({
    formatMessage: ({ defaultMessage }: { defaultMessage: string }) =>
      defaultMessage,
  }),
  useModel: () => ({
    initialState: {
      fetchUserInfo: loginPageMocks.fetchUserInfo,
    },
    setInitialState: loginPageMocks.setInitialState,
  }),
}));

vi.mock('@ant-design/pro-components', () => {
  const ProFormText = ({
    name,
    placeholder,
    fieldProps,
  }: {
    name: string;
    placeholder?: string;
    fieldProps?: {
      prefix?: React.ReactNode;
      suffix?: React.ReactNode;
    };
  }) => (
    <label>
      {fieldProps?.prefix}
      <input name={name} placeholder={placeholder} />
      {fieldProps?.suffix}
    </label>
  );
  ProFormText.Password = ({
    name,
    placeholder,
    fieldProps,
  }: {
    name: string;
    placeholder?: string;
    fieldProps?: {
      prefix?: React.ReactNode;
    };
  }) => (
    <label>
      {fieldProps?.prefix}
      <input name={name} placeholder={placeholder} type="password" />
    </label>
  );

  return {
    LoginForm: ({
      children,
      onFinish,
    }: {
      children: React.ReactNode;
      onFinish: (values: Record<string, unknown>) => Promise<void>;
    }) => (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const values = Object.fromEntries(
            new FormData(form).entries(),
          ) as Record<string, unknown>;
          values.rememberMe = (
            form.elements.namedItem('rememberMe') as HTMLInputElement | null
          )?.checked;
          onFinish(values);
        }}
      >
        {children}
        <button type="submit">登 录</button>
      </form>
    ),
    ProFormCheckbox: ({
      children,
      name,
    }: {
      children: React.ReactNode;
      name: string;
    }) => (
      <label>
        <input defaultChecked name={name} type="checkbox" />
        {children}
      </label>
    ),
    ProFormText,
  };
});

vi.mock('@/components', () => ({
  Footer: () => null,
}));

vi.mock('@/services/ant-design-pro/api', () => ({
  getCodeImg: loginPageMocks.getCodeImg,
  getOAuthProviders: loginPageMocks.getOAuthProviders,
  login: loginPageMocks.login,
}));

const { default: LoginPage } = await import('@/pages/user/login');

const renderLogin = () =>
  render(
    <App>
      <LoginPage />
    </App>,
  );

describe('pages/user/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, '', '/login');
    loginPageMocks.getCodeImg.mockResolvedValue({
      data: {
        captchaEnabled: true,
        uuid: 'uuid-1',
        img: 'abc',
        registerEnabled: true,
        forgotPasswordEnabled: true,
        mailEnabled: true,
      },
    });
    loginPageMocks.getOAuthProviders.mockResolvedValue({
      data: [],
    });
    loginPageMocks.login.mockResolvedValue({
      data: {
        access_token: 'token-1',
      },
    });
    loginPageMocks.fetchUserInfo.mockResolvedValue({
      currentUser: {
        name: 'Admin',
      },
    });
  });

  it('submits login form through backend login service', async () => {
    renderLogin();

    fireEvent.change(await screen.findByPlaceholderText('用户名'), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: '123456' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入验证码'), {
      target: { value: '1111' },
    });

    fireEvent.click(screen.getByRole('button', { name: /登\s*录/ }));

    await waitFor(() => {
      expect(loginPageMocks.login).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'admin',
          password: '123456',
          code: '1111',
          uuid: 'uuid-1',
        }),
        {
          skipErrorHandler: true,
        },
      );
      expect(localStorage.getItem('Admin-Token')).toBe('token-1');
      expect(loginPageMocks.fetchUserInfo).toHaveBeenCalledTimes(1);
      expect(loginPageMocks.setInitialState).toHaveBeenCalledTimes(1);
    });
  });

  it('shows register and forgot-password links only when backend capability flags are enabled', async () => {
    const firstRender = renderLogin();

    expect(
      await screen.findByRole('link', { name: '注册账号' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '忘记密码' })).toBeInTheDocument();
    firstRender.unmount();

    loginPageMocks.getCodeImg.mockResolvedValueOnce({
      data: {
        captchaEnabled: true,
        uuid: 'uuid-2',
        img: 'abc',
        registerEnabled: false,
        forgotPasswordEnabled: true,
        mailEnabled: false,
      },
    });

    renderLogin();

    await screen.findByPlaceholderText('用户名');
    expect(
      screen.queryByRole('link', { name: '注册账号' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '忘记密码' }),
    ).not.toBeInTheDocument();
  });

  it('renders enabled oauth providers', async () => {
    loginPageMocks.getOAuthProviders.mockResolvedValueOnce({
      data: [{ providerCode: 'github', providerName: 'GitHub' }],
    });

    renderLogin();

    expect(
      await screen.findByRole('button', { name: /GitHub/ }),
    ).toBeInTheDocument();
  });
});
