import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {describe, expect, it, vi} from 'vitest';
import Error404Page from '@/pages/error/404';

vi.mock('@umijs/max', async () => {
  const router = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    Link: router.Link,
    useLocation: router.useLocation,
    useNavigate: router.useNavigate,
  };
});

describe('pages/error/404', () => {
  it('renders not-found copy and a return-home link', () => {
    render(
      <MemoryRouter initialEntries={['/404']}>
        <Error404Page />
      </MemoryRouter>,
    );

    expect(screen.getByText('404错误!')).toBeInTheDocument();
    expect(screen.getByText('找不到网页！')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回首页' })).toHaveAttribute(
      'href',
      '/index',
    );
  });
});
