import {render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {describe, expect, it, vi} from 'vitest';
import IFrame from '@/components/iFrame';
import ParentView from '@/components/ParentView';

vi.mock('@umijs/max', async () => {
  const router = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    Outlet: router.Outlet,
  };
});

describe('components/bridge', () => {
  it('renders iframe container', () => {
    render(<IFrame src="about:blank" iframeId="frame-1" />);
    const iframe = document.getElementById('frame-1') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.src).toContain('about:blank');
  });

  it('renders ParentView outlet', () => {
    render(
      <MemoryRouter initialEntries={['/child']}>
        <Routes>
          <Route element={<ParentView />}>
            <Route path="/child" element={<div>child-page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('child-page')).toBeInTheDocument();
  });
});
