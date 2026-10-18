import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { LoginData } from '@/api/types';
import { useUserStore } from '@/store/modules/user';

const loginPageMocks = vi.hoisted(() => ({
  getCodeImg: vi.fn(),
  getOAuthProviders: vi.fn()
}));

vi.mock('@/api/login', () => ({
  getCodeImg: loginPageMocks.getCodeImg,
  getOAuthProviders: loginPageMocks.getOAuthProviders
}));

const { default: LoginPage } = await import('@/pages/login');

describe('pages/login', () => {
  let loginMock = vi.fn<(userInfo: LoginData) => Promise<void>>(async () => undefined);

  beforeEach(() => {
    localStorage.clear();
    loginMock = vi.fn<(userInfo: LoginData) => Promise<void>>(async () => undefined);
    loginPageMocks.getCodeImg.mockResolvedValue({
      data: {
        captchaEnabled: true,
        uuid: 'uuid-1',
        img: 'abc',
        registerEnabled: true,
        forgotPasswordEnabled: true,
        mailEnabled: true
      }
    });
    loginPageMocks.getOAuthProviders.mockResolvedValue({
      data: []
    });
    useUserStore.setState({
      login: loginMock
    });
  });

  it('submits login form', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    const usernameInput = await screen.findByPlaceholderText('用户名');
    const passwordInput = screen.getByPlaceholderText('密码');
    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: '123456' } });
    const codeInput = screen.getByPlaceholderText('验证码');
    fireEvent.change(codeInput, { target: { value: '1111' } });

    fireEvent.click(screen.getByRole('button', { name: /^登\s*录$/ }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'admin',
          password: '123456',
          code: '1111',
          uuid: 'uuid-1'
        })
      );
    });
  });

  it('shows register and forgot-password links only when capability flags are enabled', async () => {
    const firstRender = render(
      <MemoryRouter>
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('link', { name: '立即注册' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '忘记密码' })).toBeInTheDocument();
    firstRender.unmount();

    loginPageMocks.getCodeImg.mockResolvedValueOnce({
      data: {
        captchaEnabled: true,
        uuid: 'uuid-2',
        img: 'abc',
        registerEnabled: false,
        forgotPasswordEnabled: true,
        mailEnabled: false
      }
    });

    render(
      <MemoryRouter>
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByPlaceholderText('用户名');
    expect(screen.queryByRole('link', { name: '立即注册' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '忘记密码' })).not.toBeInTheDocument();
  });

  it('keeps remembered account when checkbox checked', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    const usernameInput = await screen.findByPlaceholderText('用户名');
    const passwordInput = screen.getByPlaceholderText('密码');
    const codeInput = screen.getByPlaceholderText('验证码');
    fireEvent.change(usernameInput, { target: { value: 'demo' } });
    fireEvent.change(passwordInput, { target: { value: 'pwd' } });
    fireEvent.change(codeInput, { target: { value: '2222' } });
    fireEvent.click(screen.getByText('记住我'));
    fireEvent.click(screen.getByRole('button', { name: /^登\s*录$/ }));

    await waitFor(() => {
      expect(localStorage.getItem('username')).toBe('demo');
      expect(localStorage.getItem('rememberMe')).toBe('true');
    });
  });

  it('renders enabled oauth providers', async () => {
    loginPageMocks.getOAuthProviders.mockResolvedValueOnce({
      data: [{ providerCode: 'github', providerName: 'GitHub' }]
    });

    render(
      <MemoryRouter>
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: /使用 GitHub 登录/ })).toBeInTheDocument();
  });

  it('returns to a safe route without decoding query values a second time', async () => {
    loginPageMocks.getCodeImg.mockResolvedValueOnce({ data: { captchaEnabled: false } });
    const target = '/user/profile?name=a%26b#identity';
    function Destination() {
      const location = useLocation();
      return <div data-testid="destination">{location.pathname + location.search + location.hash}</div>;
    }
    render(
      <MemoryRouter initialEntries={[`/login?redirect=${encodeURIComponent(target)}`]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/user/profile" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.change(await screen.findByPlaceholderText('用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /^登\s*录$/ }));
    expect(await screen.findByTestId('destination')).toHaveTextContent(target);
    expect(loginMock).toHaveBeenCalledTimes(1);
  });

  it.each(['https://evil.test', '//evil.test', '/%252fevil.test', '/path%zz', '/%0apath', ''])('rejects invalid redirect %j before password login or OAuth authorization', async (target) => {
    loginPageMocks.getCodeImg.mockResolvedValueOnce({ data: { captchaEnabled: false } });
    loginPageMocks.getOAuthProviders.mockResolvedValueOnce({ data: [{ providerCode: 'github', providerName: 'GitHub' }] });
    render(<MemoryRouter initialEntries={[`/login?redirect=${encodeURIComponent(target)}`]}><LoginPage /></MemoryRouter>);
    fireEvent.change(await screen.findByPlaceholderText('用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: /^登\s*录$/ }));
    expect(await screen.findByText('登录回跳地址无效，请从站内页面重新进入')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: /使用 GitHub 登录/ }));
    expect(loginMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('登录回跳地址无效');
  });

  it('rejects duplicate redirect values before OAuth authorization', async () => {
    loginPageMocks.getOAuthProviders.mockResolvedValueOnce({ data: [{ providerCode: 'github', providerName: 'GitHub' }] });
    render(<MemoryRouter initialEntries={['/login?redirect=%2Findex&redirect=%2Fuser%2Fprofile']}><LoginPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /使用 GitHub 登录/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('登录回跳地址无效');
    expect(loginMock).not.toHaveBeenCalled();
  });
});
