import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

export function renderWithRouter(ui: ReactElement, entry = '/') {
  return render(<MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>);
}
