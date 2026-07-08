import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {App} from 'antd';
import {afterAll, beforeEach, describe, expect, it, vi} from 'vitest';

const loginPageMocks = vi.hoisted(() => ({
  fetchUserInfo: vi.fn(),
  getCodeImg: vi.fn(),
  getOAuthProviders: vi.fn(),
  historyReplace: vi.fn(),
  initializeRealtimeChannels: vi.fn(),
  login: vi.fn(),
  setInitialState: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  history: {
    replace: loginPageMocks.historyReplace,
  },
  useModel: () => ({
    initialState: {
      fetchUserInfo: loginPageMocks.fetchUserInfo,
    },
    setInitialState: loginPageMocks.setInitialState,
  }),
}));

vi.mock('@ant-design/pro-components', () => {
  let latestInitialValues: Record<string, unknown> = {};

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
      <input
        defaultValue={(latestInitialValues[name] as string | undefined) || ''}
        name={name}
        placeholder={placeholder}
      />
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
      <input
        defaultValue={(latestInitialValues[name] as string | undefined) || ''}
        name={name}
        placeholder={placeholder}
        type="password"
      />
    </label>
  );

  return {
    LoginForm: ({
      children,
      initialValues,
      logo,
      onFinish,
    }: {
      children: React.ReactNode;
      initialValues?: Record<string, unknown>;
      logo?: React.ReactNode;
      onFinish: (values: Record<string, unknown>) => Promise<void>;
    }) => {
      latestInitialValues = initialValues || {};
      return (
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
          {logo}
          {children}
          <button type="submit">登 录</button>
        </form>
      );
    },
    ProFormCheckbox: ({
      children,
      name,
    }: {
      children: React.ReactNode;
      name: string;
    }) => (
      <label>
        <input
          defaultChecked={latestInitialValues[name] === true}
          name={name}
          type="checkbox"
        />
        {children}
      </label>
    ),
    ProFormText,
  };
});

vi.mock('@/components/LangSelect', () => ({
  default: () => null,
}));

vi.mock('@/services/ant-design-pro/api', () => ({
  getCodeImg: loginPageMocks.getCodeImg,
  getOAuthProviders: loginPageMocks.getOAuthProviders,
  login: loginPageMocks.login,
}));

vi.mock('@/store/modules/user', () => ({
  useUserStore: {
    getState: () => ({
      initializeRealtimeChannels: loginPageMocks.initializeRealtimeChannels,
    }),
  },
}));

const originalContextPath = process.env.VITE_APP_CONTEXT_PATH;
process.env.VITE_APP_CONTEXT_PATH = '/react-pro/';

const { default: LoginPage } = await import('@/pages/user/login');

const renderLogin = () =>
  render(
    <App>
      <LoginPage />
    </App>,
  );

describe('pages/user/login', () => {
  afterAll(() => {
    if (originalContextPath === undefined) {
      delete process.env.VITE_APP_CONTEXT_PATH;
      return;
    }
    process.env.VITE_APP_CONTEXT_PATH = originalContextPath;
  });
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
    window.history.replaceState({}, '', '/login?redirect=/dashboard');
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
    fireEvent.click(screen.getByLabelText('记住我'));

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
      expect(localStorage.getItem('username')).toBe('admin');
      expect(localStorage.getItem('password')).toBe('123456');
      expect(localStorage.getItem('rememberMe')).toBe('true');
      expect(loginPageMocks.initializeRealtimeChannels).toHaveBeenCalledTimes(
        1,
      );
      expect(loginPageMocks.fetchUserInfo).toHaveBeenCalledTimes(1);
      expect(loginPageMocks.setInitialState).toHaveBeenCalledTimes(1);
      expect(loginPageMocks.historyReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('resolves login logo from deployment context path', async () => {
    renderLogin();

    expect(await screen.findByAltText('logo')).toHaveAttribute(
      'src',
      '/react-pro/logo.svg',
    );
  });

  it('restores remembered username and password into login form', async () => {
    localStorage.setItem('username', 'remembered-user');
    localStorage.setItem('password', 'remembered-pass');
    localStorage.setItem('rememberMe', 'true');

    renderLogin();

    expect(await screen.findByPlaceholderText('用户名')).toHaveValue(
      'remembered-user',
    );
    expect(screen.getByPlaceholderText('密码')).toHaveValue('remembered-pass');
    expect(screen.getByLabelText('记住我')).toBeChecked();
  });

  it('clears remembered username and password when remember me is unchecked', async () => {
    localStorage.setItem('username', 'old-user');
    localStorage.setItem('password', 'old-pass');
    localStorage.setItem('rememberMe', 'true');

    renderLogin();

    fireEvent.click(await screen.findByLabelText('记住我'));
    fireEvent.click(screen.getByRole('button', { name: /登\s*录/ }));

    await waitFor(() => {
      expect(localStorage.getItem('username')).toBeNull();
      expect(localStorage.getItem('password')).toBeNull();
      expect(localStorage.getItem('rememberMe')).toBeNull();
    });
  });

  it('keeps login redirect inside app routes when using SPA navigation', async () => {
    window.history.replaceState(
      {},
      '',
      '/login?redirect=https%3A%2F%2Fevil.example%2Fadmin',
    );

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
      expect(loginPageMocks.historyReplace).toHaveBeenCalledWith('/index');
    });
  });

  it('centers the login form in the page viewport', async () => {
    const { container } = renderLogin();

    await screen.findByPlaceholderText('用户名');
    expect(container.querySelector('.login-form-shell')).toHaveStyle({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
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
