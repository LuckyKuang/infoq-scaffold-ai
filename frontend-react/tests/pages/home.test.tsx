import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '@/pages/index';

describe('pages/home', () => {
  it('should render dashboard cards', () => {
    render(<HomePage />);
    expect(screen.getByText('infoq-scaffold-backend后台管理系统')).toBeInTheDocument();
  });
});
