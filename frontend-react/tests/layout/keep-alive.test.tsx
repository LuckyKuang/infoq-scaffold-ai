import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import KeepAliveView from '@/layouts/KeepAliveView';
import { useTagsViewStore } from '@/store/modules/tagsView';

describe('layouts/keep-alive', () => {
  beforeEach(() => {
    useTagsViewStore.setState({
      visitedViews: [
        { fullPath: '/a', name: 'a', path: '/a', title: 'A' },
        { fullPath: '/b', name: 'b', path: '/b', title: 'B' }
      ],
      cachedViews: ['a', 'b']
    });
  });

  it('keeps cached view mounted when switching active path', () => {
    const { rerender } = render(
      <KeepAliveView activePath="/a">
        <div>Page A</div>
      </KeepAliveView>
    );

    expect(screen.getByText('Page A')).toBeInTheDocument();

    rerender(
      <KeepAliveView activePath="/b">
        <div>Page B</div>
      </KeepAliveView>
    );

    expect(screen.getByText('Page B')).toBeInTheDocument();
    expect(screen.getByText('Page A')).toBeInTheDocument();
  });
});
