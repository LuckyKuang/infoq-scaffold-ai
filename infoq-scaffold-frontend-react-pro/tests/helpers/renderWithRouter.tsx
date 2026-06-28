import {render} from '@testing-library/react';
import type {ReactElement} from 'react';
import {MemoryRouter} from 'react-router-dom';
import {vi} from 'vitest';

vi.mock('@umijs/max', async () => {
  const router = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    Link: router.Link,
    Outlet: router.Outlet,
    useLocation: router.useLocation,
    useNavigate: router.useNavigate,
    useParams: router.useParams,
    useSearchParams: router.useSearchParams,
  };
});

export function renderWithRouter(ui: ReactElement, entry = '/') {
  return render(<MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>);
}
