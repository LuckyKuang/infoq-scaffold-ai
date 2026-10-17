import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

    fireEvent.click(screen.getByRole('button', { name: /登\s*录/ }));

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
    fireEvent.click(screen.getByRole('button', { name: /登\s*录/ }));

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
});
