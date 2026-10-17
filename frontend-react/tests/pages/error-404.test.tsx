import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Error404Page from '@/pages/error/404';
import { renderWithRouter } from '../helpers/renderWithRouter';

describe('pages/error/404', () => {
  it('renders not-found copy and a return-home link', () => {
    renderWithRouter(<Error404Page />, '/404');

    expect(screen.getByText('404错误!')).toBeInTheDocument();
    expect(screen.getByText('找不到网页！')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回首页' })).toHaveAttribute('href', '/index');
  });
});
