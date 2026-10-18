import { App as AntdApp } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const registerPageMocks = vi.hoisted(() => ({
  getCodeImg: vi.fn(),
  register: vi.fn(),
  sendEmailCode: vi.fn(),
  checkInviteCode: vi.fn()
}));

vi.mock('@/api/login', () => ({
  getCodeImg: registerPageMocks.getCodeImg,
  register: registerPageMocks.register,
  sendEmailCode: registerPageMocks.sendEmailCode,
  checkInviteCode: registerPageMocks.checkInviteCode
}));

const { default: RegisterPage } = await import('@/pages/register');

describe('pages/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerPageMocks.getCodeImg.mockResolvedValue({
      data: {
        captchaEnabled: true,
        img: 'img-data',
        uuid: 'uuid-2',
        registerEnabled: true,
        inviteRegisterEnabled: false,
        mailEnabled: true
      }
    });
    registerPageMocks.register.mockResolvedValue(undefined);
    registerPageMocks.sendEmailCode.mockResolvedValue(undefined);
    registerPageMocks.checkInviteCode.mockResolvedValue(undefined);
  });

  const renderPage = () =>
    render(
      <AntdApp>
        <MemoryRouter initialEntries={['/register']}>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </AntdApp>
    );

  it('registers successfully and redirects to login', async () => {
    renderPage();

    fireEvent.change(await screen.findByPlaceholderText('邮箱'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('邮箱验证码'), { target: { value: '778899' } });
    fireEvent.change(screen.getByPlaceholderText('用户名'), { target: { value: 'new-user' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'Pass@123' } });
    fireEvent.change(screen.getByPlaceholderText('确认密码'), { target: { value: 'Pass@123' } });
    fireEvent.change(screen.getByPlaceholderText('验证码'), { target: { value: 'ABCD' } });
    fireEvent.click(screen.getByRole('button', { name: /注\s*册/ }));

    await waitFor(() => {
      expect(registerPageMocks.register).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user@example.com',
          emailCode: '778899',
          username: 'new-user',
          password: 'Pass@123',
          confirmPassword: 'Pass@123',
          code: 'ABCD',
          uuid: 'uuid-2'
        })
      );
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('sends register email code with scene isolation', async () => {
    renderPage();

    fireEvent.change(await screen.findByPlaceholderText('邮箱'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('验证码'), { target: { value: 'ABCD' } });
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));

    await waitFor(() => {
      expect(registerPageMocks.sendEmailCode).toHaveBeenCalledWith({
        email: 'user@example.com',
        scene: 'register',
        code: 'ABCD',
        uuid: 'uuid-2'
      });
    });
  });

  it('redirects back to login when register capability is disabled', async () => {
    registerPageMocks.getCodeImg.mockResolvedValueOnce({
      data: {
        captchaEnabled: true,
        registerEnabled: false,
        mailEnabled: true
      }
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });
});
