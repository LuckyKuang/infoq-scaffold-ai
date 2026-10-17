import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Error401Page from '@/pages/error/401';

function renderError401(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/401" element={<Error401Page />} />
        <Route path="/index" element={<div>Index Route</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('pages/error/401', () => {
  it('renders access denied copy and returns home when noGoBack is set', () => {
    renderError401('/401?noGoBack=true');

    expect(screen.getByText('401错误!')).toBeInTheDocument();
    expect(screen.getByText('您没有访问权限！')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /返回/u }));

    expect(screen.getByText('Index Route')).toBeInTheDocument();
  });
});
