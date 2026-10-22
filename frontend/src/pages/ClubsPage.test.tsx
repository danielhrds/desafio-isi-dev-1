import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosHeaders, type AxiosResponse } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../services/api-client.js';
import type { ClubListItem, ClubSort, ClubSummary } from '../types/club.js';
import type { PlayerListResponse } from '../types/player.js';
import { ClubsPage } from './ClubsPage.js';

const clubLists: Record<ClubSort, ClubSummary[]> = {
  name: [
    {
      id: 1,
      name: 'Águias FC',
      acronym: 'AGU',
      cash: 198.5,
      squad_value: 51.5,
      net_worth: 250,
    },
    {
      id: 2,
      name: 'Delta FC',
      acronym: 'DEL',
      cash: 100.7,
      squad_value: 299.3,
      net_worth: 400,
    },
    {
      id: 3,
      name: 'Gama SC',
      acronym: 'GAM',
      cash: 72.2,
      squad_value: 127.8,
      net_worth: 200,
    },
  ],
  net_worth_desc: [
    {
      id: 2,
      name: 'Delta FC',
      acronym: 'DEL',
      cash: 100.7,
      squad_value: 299.3,
      net_worth: 400,
    },
    {
      id: 1,
      name: 'Águias FC',
      acronym: 'AGU',
      cash: 198.5,
      squad_value: 51.5,
      net_worth: 250,
    },
    {
      id: 3,
      name: 'Gama SC',
      acronym: 'GAM',
      cash: 72.2,
      squad_value: 127.8,
      net_worth: 200,
    },
  ],
  net_worth_asc: [
    {
      id: 3,
      name: 'Gama SC',
      acronym: 'GAM',
      cash: 72.2,
      squad_value: 127.8,
      net_worth: 200,
    },
    {
      id: 1,
      name: 'Águias FC',
      acronym: 'AGU',
      cash: 198.5,
      squad_value: 51.5,
      net_worth: 250,
    },
    {
      id: 2,
      name: 'Delta FC',
      acronym: 'DEL',
      cash: 100.7,
      squad_value: 299.3,
      net_worth: 400,
    },
  ],
};

const clubs: ClubListItem[] = clubLists.name.map(({ id, name, acronym }) => ({
  id,
  name,
  acronym,
}));

const playerPage: PlayerListResponse = {
  data: [],
  meta: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
};

function responseWith<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Providers({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={['/clubes']}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </MemoryRouter>
    );
  }

  return render(<ClubsPage />, { wrapper: Providers });
}

function clubIdsInTable(): string[] {
  const table = screen.getByRole('table', { name: 'Clubes' });

  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getByRole('link', { name: /Ver clube/ })
        .getAttribute('href'),
    )
    .map((href) => href?.split('/').at(-1) ?? '');
}

function sortFromConfig(config: unknown): string | undefined {
  if (typeof config !== 'object' || config === null || !('params' in config)) {
    return undefined;
  }

  const params = config.params;
  if (typeof params !== 'object' || params === null || !('sort' in params)) {
    return undefined;
  }

  return typeof params.sort === 'string' ? params.sort : undefined;
}

const domMethods = [
  'hasPointerCapture',
  'setPointerCapture',
  'releasePointerCapture',
  'scrollIntoView',
] as const;
const domMethodDescriptors = new Map(
  domMethods.map((method) => [
    method,
    Object.getOwnPropertyDescriptor(HTMLElement.prototype, method),
  ]),
);

afterEach(() => {
  vi.restoreAllMocks();
  domMethods.forEach((method) => {
    const descriptor = domMethodDescriptors.get(method);
    if (descriptor) {
      Object.defineProperty(HTMLElement.prototype, method, descriptor);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, method);
    }
  });
});

describe('F05/F07 club listing', () => {
  it('renders API financial values and follows the API order for every sort', async () => {
    Object.defineProperties(HTMLElement.prototype, {
      hasPointerCapture: { configurable: true, value: () => false },
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
      scrollIntoView: { configurable: true, value: vi.fn() },
    });
    const get = vi
      .spyOn(apiClient, 'get')
      .mockImplementation(async (url, config) => {
        if (url === '/players') return responseWith(playerPage);
        if (url === '/clubs') {
          const sort = sortFromConfig(config) as ClubSort | undefined;
          return responseWith(sort ? clubLists[sort] : clubs);
        }

        throw new Error(`Unexpected GET ${url}`);
      });

    const user = userEvent.setup();
    renderPage();

    const table = await screen.findByRole('table', { name: 'Clubes' });
    expect(clubIdsInTable()).toEqual(['1', '2', '3']);

    const aguiaRow = within(table).getByRole('row', { name: /Águias FC/ });
    const aguiaCells = within(aguiaRow).getAllByRole('cell');
    expect(
      within(aguiaCells[0]).getByText('Águias FC', { exact: true }),
    ).toBeInTheDocument();
    expect(aguiaCells[1]).toHaveTextContent('AGU');
    expect(aguiaCells[2]).toHaveTextContent('198,50');
    expect(aguiaCells[3]).toHaveTextContent('51,50');
    expect(aguiaCells[4]).toHaveTextContent('250,00');
    expect(aguiaCells[5]).toHaveTextContent('Ver clube');

    await user.click(screen.getByRole('combobox', { name: 'Ordenar clubes' }));
    await user.click(
      screen.getByRole('option', {
        name: 'Ordenar: patrimônio (maior para o menor)',
      }),
    );
    await waitForIds(['2', '1', '3']);

    await user.click(screen.getByRole('combobox', { name: 'Ordenar clubes' }));
    await user.click(
      screen.getByRole('option', {
        name: 'Ordenar: patrimônio (menor para o maior)',
      }),
    );
    await waitForIds(['3', '1', '2']);

    expect(
      get.mock.calls
        .filter(([url, config]) => url === '/clubs' && sortFromConfig(config))
        .map(([, config]) => sortFromConfig(config)),
    ).toEqual(['name', 'net_worth_desc', 'net_worth_asc']);
  });
});

async function waitForIds(expected: string[]) {
  await waitFor(() => expect(clubIdsInTable()).toEqual(expected));
}
