import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DictTag from '@/components/DictTag';
import Pagination from '@/components/Pagination';
import RightToolbar from '@/components/RightToolbar';
import ScreenFull from '@/components/ScreenFull';

describe('components/common', () => {
  it('renders DictTag labels and unmatched values', () => {
    render(
      <DictTag
        options={[
          { label: '正常', value: '0', elTagType: 'success' },
          { label: '停用', value: '1', elTagType: 'danger' }
        ]}
        value="0,2"
      />
    );

    expect(screen.getByText('正常')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('calls page change callback', () => {
    const onPageChange = vi.fn();
    render(<Pagination total={100} page={1} limit={10} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByTitle('2'));
    expect(onPageChange).toHaveBeenCalled();
  });

  it('toggles search from RightToolbar', () => {
    const onShowSearchChange = vi.fn();
    const onQueryTable = vi.fn();

    render(<RightToolbar showSearch search onShowSearchChange={onShowSearchChange} onQueryTable={onQueryTable} />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);

    expect(onShowSearchChange).toHaveBeenCalledWith(false);
    expect(onQueryTable).toHaveBeenCalledTimes(1);
  });

  it('toggles fullscreen state', async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => null
    });
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: exitFullscreen
    });

    render(<ScreenFull />);
    fireEvent.click(screen.getByRole('button'));
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });
});
