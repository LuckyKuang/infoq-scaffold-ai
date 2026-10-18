import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SvgIcon from '@/components/SvgIcon';

describe('components/svg-icon', () => {
  it('renders copied svg assets by icon name', () => {
    render(<SvgIcon iconClass="redis" />);
    expect(screen.getByRole('img', { name: 'redis' })).toBeInTheDocument();
  });

  it('resolves backend icon aliases to existing svg assets', () => {
    render(<SvgIcon iconClass="loginInfo" />);
    expect(screen.getByRole('img', { name: 'loginInfo' })).toBeInTheDocument();
  });

  it('normalizes svg files without viewBox so they still render', () => {
    const { container } = render(<SvgIcon iconClass="user" />);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 130 130');
  });

  it('returns null for unsupported icon names', () => {
    const { container } = render(<SvgIcon iconClass="not-found-icon" />);
    expect(container).toBeEmptyDOMElement();
  });
});
