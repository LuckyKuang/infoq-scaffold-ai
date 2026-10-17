import { App as AntdApp } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const forgotPasswordPageMocks = vi.hoisted(() => ({
  forgotPassword: vi.fn(),
  getCodeImg: vi.fn(),
  sendEmailCode: vi.fn()
}));

vi.mock('@/api/login', () => ({
  forgotPassword: forgotPasswordPageMocks.forgotPassword,
  getCodeImg: forgotPasswordPageMocks.getCodeImg,
  sendEmailCode: forgotPasswordPageMocks.sendEmailCode
}));

const { default: ForgotPasswordPage } = await import('@/pages/forgot-password');

describe('pages/forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forgotPasswordPageMocks.getCodeImg.mockResolvedValue({
      data: {
        captchaEnabled: true,
        img: 'img-data',
        uuid: 'uuid-3',
        forgotPasswordEnabled: true,
        mailEnabled: true
      }
    });
    forgotPasswordPageMocks.sendEmailCode.mockResolvedValue(undefined);
    forgotPasswordPageMocks.forgotPassword.mockResolvedValue(undefined);
  });

  const renderPage = () =>
    render(
      <AntdApp>
        <MemoryRouter initialEntries={['/forgot-password']}>
          <Routes>
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </AntdApp>
    );

  it('submits new password successfully and redirects to login', async () => {
    renderPage();

    fireEvent.change(await screen.findByPlaceholderText('邮箱'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('邮箱验证码'), { target: { value: '778899' } });
    fireEvent.change(screen.getByPlaceholderText('新密码'), { target: { value: 'Pass@123' } });
    fireEvent.change(screen.getByPlaceholderText('确认新密码'), { target: { value: 'Pass@123' } });
    fireEvent.change(screen.getByPlaceholderText('验证码'), { target: { value: 'ABCD' } });
    fireEvent.click(screen.getByRole('button', { name: '重置密码' }));

    await waitFor(() => {
      expect(forgotPasswordPageMocks.forgotPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user@example.com',
          emailCode: '778899',
          newPassword: 'Pass@123',
          confirmPassword: 'Pass@123',
          code: 'ABCD',
          uuid: 'uuid-3'
        })
      );
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('sends forgot-password email code with scene isolation', async () => {
    renderPage();

    fireEvent.change(await screen.findByPlaceholderText('邮箱'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('验证码'), { target: { value: 'ABCD' } });
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));

    await waitFor(() => {
      expect(forgotPasswordPageMocks.sendEmailCode).toHaveBeenCalledWith({
        email: 'user@example.com',
        scene: 'forgot_password',
        code: 'ABCD',
        uuid: 'uuid-3'
      });
    });
  });

  it('redirects back to login when forgot-password capability is disabled', async () => {
    forgotPasswordPageMocks.getCodeImg.mockResolvedValueOnce({
      data: {
        captchaEnabled: true,
        forgotPasswordEnabled: false,
        mailEnabled: true
      }
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });
});
