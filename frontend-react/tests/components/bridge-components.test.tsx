import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import IFrame from '@/components/iFrame';
import ParentView from '@/components/ParentView';

describe('components/bridge', () => {
  it('renders iframe container', () => {
    render(<IFrame src="https://infoq.cn" iframeId="frame-1" />);
    const iframe = document.getElementById('frame-1') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.src).toContain('https://infoq.cn');
  });

  it('renders ParentView outlet', () => {
    render(
      <MemoryRouter initialEntries={['/child']}>
        <Routes>
          <Route element={<ParentView />}>
            <Route path="/child" element={<div>child-page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('child-page')).toBeInTheDocument();
  });
});
