import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import Pagination from '@/components/Pagination';

type MockPaginationProps = {
  onChange?: (page: number, size: number) => void;
  onShowSizeChange?: (page: number, size: number) => void;
};

const antdPaginationSpy = vi.hoisted(() => vi.fn());

vi.mock('antd', async () => {
  const React = await import('react');
  return {
    Pagination: (props: MockPaginationProps) => {
      antdPaginationSpy(props);
      return React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => {
            props.onChange?.(2, 20);
            props.onShowSizeChange?.(2, 20);
          },
        },
        'change page size',
      );
    },
  };
});

describe('components/Pagination', () => {
  it('uses a single callback path when page size changes', () => {
    const onPageChange = vi.fn();

    render(
      <Pagination
        total={100}
        page={2}
        limit={10}
        onPageChange={onPageChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'change page size' }));

    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith({ page: 2, limit: 20 });
    expect(antdPaginationSpy).toHaveBeenCalledWith(
      expect.not.objectContaining({
        onShowSizeChange: expect.any(Function),
      }),
    );
  });

  it('resets to first page when larger page size exceeds total', () => {
    const onPageChange = vi.fn();

    render(
      <Pagination
        total={25}
        page={2}
        limit={10}
        onPageChange={onPageChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'change page size' }));

    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });
});
