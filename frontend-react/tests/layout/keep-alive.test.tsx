import { useEffect } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import KeepAliveView from '@/layouts/KeepAliveView';
import { useTagsViewStore } from '@/store/modules/tagsView';

const mounts: Record<string, number> = {};

// 与 BackendRouteView 一致：通过 useLocation 解析当前页面，用于验证隐藏槽位不会被当前路由污染
function LocationPage() {
  const { pathname } = useLocation();
  const name = pathname.replace('/', '').toUpperCase();
  useEffect(() => {
    mounts[name] = (mounts[name] || 0) + 1;
  }, [name]);
  return (
    <div data-testid={`page-${name}`}>
      Page {name}
      <input aria-label={`input-${name}`} />
    </div>
  );
}

function Shell({ noCachePaths = [] }: { noCachePaths?: string[] }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <button onClick={() => navigate('/a')}>go-a</button>
      <button onClick={() => navigate('/b')}>go-b</button>
      <KeepAliveView activePath={pathname} noCache={noCachePaths.includes(pathname)} />
    </div>
  );
}

const renderApp = (noCachePaths: string[] = []) =>
  render(
    <MemoryRouter initialEntries={['/a']}>
      <Routes>
        <Route path="/" element={<Shell noCachePaths={noCachePaths} />}>
          <Route path="*" element={<LocationPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe('layouts/keep-alive', () => {
  beforeEach(() => {
    Object.keys(mounts).forEach((key) => delete mounts[key]);
    useTagsViewStore.setState({
      visitedViews: [
        { fullPath: '/a', name: 'a', path: '/a', title: 'A' },
        { fullPath: '/b', name: 'b', path: '/b', title: 'B' }
      ],
      cachedViews: ['a', 'b']
    });
  });

  it('caches the resolved route element per path instead of re-rendering the current route in every slot', () => {
    renderApp();

    fireEvent.change(screen.getByLabelText('input-A'), { target: { value: 'draft-a' } });
    fireEvent.click(screen.getByText('go-b'));

    // 每个页面只挂载一次：A 保留在隐藏槽位，B 在激活槽位，没有重复的 B
    expect(screen.getAllByTestId('page-B')).toHaveLength(1);
    expect(screen.getAllByTestId('page-A')).toHaveLength(1);
    expect(screen.getByTestId('page-A').parentElement).toHaveStyle({ display: 'none' });
    expect(screen.getByTestId('page-B').parentElement).toHaveStyle({ display: 'block' });

    fireEvent.click(screen.getByText('go-a'));

    // 回到 A 时 DOM 状态未丢失，且未重新挂载
    expect(screen.getByLabelText('input-A')).toHaveValue('draft-a');
    expect(screen.getByTestId('page-A').parentElement).toHaveStyle({ display: 'block' });
    expect(mounts).toEqual({ A: 1, B: 1 });
  });

  it('renders only the current route without caching when the route is noCache', () => {
    renderApp(['/a', '/b']);

    fireEvent.click(screen.getByText('go-b'));

    expect(screen.getAllByTestId('page-B')).toHaveLength(1);
    expect(screen.queryByTestId('page-A')).not.toBeInTheDocument();
  });
});
