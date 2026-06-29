import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

  it('renders icons through css mask so menu text is not polluted by raw svg', () => {
    const { container } = render(<SvgIcon iconClass="user" />);
    const maskImage = container.querySelector('span')?.style.maskImage;
    expect(maskImage).toContain('url(');
    expect(maskImage).toMatch(/data:image\/svg\+xml|user\.svg/);
  });

  it('returns null for unsupported icon names', () => {
    const { container } = render(<SvgIcon iconClass="not-found-icon" />);
    expect(container).toBeEmptyDOMElement();
  });
});
