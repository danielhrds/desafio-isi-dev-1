import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from '../components/ui/sonner.js';
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function renderPage({ withToaster = false }: { withToaster?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Providers({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={['/clubes']}>
        <QueryClientProvider client={queryClient}>
          {children}
          {withToaster && <Toaster position="bottom-right" theme="light" />}
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

describe('F3 club listing states', () => {
  it('shows a loading status until the summaries request settles', async () => {
    const pendingSummaries = deferred<AxiosResponse<ClubSummary[]>>();
    vi.spyOn(apiClient, 'get').mockImplementation(async (url, config) => {
      if (url === '/players') return responseWith(playerPage);
      if (url === '/clubs') {
        return sortFromConfig(config) === 'name'
          ? pendingSummaries.promise
          : responseWith(clubs);
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    renderPage();

    expect(
      await screen.findByRole('status', { name: 'Carregando clubes' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('table', { name: 'Clubes' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Nenhum clube cadastrado'),
    ).not.toBeInTheDocument();

    pendingSummaries.resolve(responseWith(clubLists.name));
    expect(
      await screen.findByRole('table', { name: 'Clubes' }),
    ).toBeInTheDocument();
  });

  it('shows the empty state and its create-club action when the API returns no clubs', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url) => {
      if (url === '/players') return responseWith(playerPage);
      if (url === '/clubs') return responseWith([]);

      throw new Error(`Unexpected GET ${url}`);
    });

    renderPage();

    expect(
      await screen.findByText('Nenhum clube cadastrado'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Novo clube' })).toHaveLength(
      2,
    );
    expect(
      screen.queryByRole('table', { name: 'Clubes' }),
    ).not.toBeInTheDocument();
  });

  it('shows the API error and retries the summaries request successfully', async () => {
    const apiMessage = 'Serviço temporariamente indisponível.';
    const errorResponse: AxiosResponse<{ message: string }> = {
      ...responseWith({ message: apiMessage }),
      status: 503,
      statusText: 'Service Unavailable',
    };
    const apiError = new AxiosError<{ message: string }>(
      'Request failed',
      undefined,
      undefined,
      undefined,
      errorResponse,
    );
    const get = vi
      .spyOn(apiClient, 'get')
      .mockImplementation(async (url, config) => {
        if (url === '/players') return responseWith(playerPage);
        if (url === '/clubs') {
          if (sortFromConfig(config) !== 'name') return responseWith(clubs);

          const summaryRequests = get.mock.calls.filter(
            ([requestUrl, requestConfig]) =>
              requestUrl === '/clubs' &&
              sortFromConfig(requestConfig) === 'name',
          ).length;

          if (summaryRequests === 1) throw apiError;
          return responseWith(clubLists.name);
        }

        throw new Error(`Unexpected GET ${url}`);
      });
    const user = userEvent.setup();

    renderPage();

    expect(
      await screen.findByText(apiMessage, { exact: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Nenhum clube cadastrado'),
    ).not.toBeInTheDocument();
    expect(
      get.mock.calls.filter(
        ([url, config]) =>
          url === '/clubs' && sortFromConfig(config) === 'name',
      ),
    ).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(
      await screen.findByRole('table', { name: 'Clubes' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Delta FC/ })).toBeInTheDocument();
    expect(
      get.mock.calls.filter(
        ([url, config]) =>
          url === '/clubs' && sortFromConfig(config) === 'name',
      ),
    ).toHaveLength(2);
  });
});

describe('F05 club creation', () => {
  it('creates one club on double click and refreshes the list from API data', async () => {
    const createdClub: ClubSummary = {
      id: 4,
      name: 'Leões da Serra',
      acronym: 'LDS',
      cash: 300,
      squad_value: 0,
      net_worth: 300,
    };
    const summariesAfterCreation = [...clubLists.name, createdClub];
    const clubsAfterCreation = [
      ...clubs,
      {
        id: createdClub.id,
        name: createdClub.name,
        acronym: createdClub.acronym,
      },
    ];
    const pendingPost = deferred<AxiosResponse<ClubSummary>>();
    const get = vi
      .spyOn(apiClient, 'get')
      .mockImplementation(async (url, config) => {
        if (url === '/players') return responseWith(playerPage);
        if (url === '/clubs') {
          const sort = sortFromConfig(config);
          const requestsWithSameSort = get.mock.calls.filter(
            ([requestUrl, requestConfig]) =>
              requestUrl === '/clubs' && sortFromConfig(requestConfig) === sort,
          ).length;

          if (sort === 'name') {
            return responseWith(
              requestsWithSameSort === 1
                ? clubLists.name
                : summariesAfterCreation,
            );
          }

          return responseWith(
            requestsWithSameSort === 1 ? clubs : clubsAfterCreation,
          );
        }

        throw new Error(`Unexpected GET ${url}`);
      });
    const post = vi.spyOn(apiClient, 'post').mockImplementation(async (url) => {
      if (url !== '/clubs') throw new Error(`Unexpected POST ${url}`);
      return pendingPost.promise;
    });
    const user = userEvent.setup();

    renderPage({ withToaster: true });
    await screen.findByRole('table', { name: 'Clubes' });
    await user.click(screen.getByRole('button', { name: 'Novo clube' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Nome' }),
      createdClub.name,
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Sigla' }),
      createdClub.acronym,
    );

    await user.dblClick(screen.getByRole('button', { name: 'Criar clube' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/clubs', {
      name: 'Leões da Serra',
      acronym: 'LDS',
    });
    expect(screen.getByRole('button', { name: 'Criar clube' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();

    pendingPost.resolve(responseWith(createdClub));

    expect(await screen.findByText('Clube criado')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Leões da Serra (LDS) começa com 300,00 em caixa.',
      ),
    ).toBeInTheDocument();

    const row = await screen.findByRole('row', { name: /Leões da Serra/ });
    const cells = within(row).getAllByRole('cell');
    expect(cells[2]).toHaveTextContent('300,00');
    expect(cells[3]).toHaveTextContent('0,00');
    expect(cells[4]).toHaveTextContent('300,00');
    expect(
      await screen.findByRole('link', { name: /Leões da Serra/ }),
    ).toBeInTheDocument();
    expect(
      get.mock.calls.filter(
        ([url, config]) =>
          url === '/clubs' && sortFromConfig(config) === 'name',
      ),
    ).toHaveLength(2);
    expect(
      get.mock.calls.filter(
        ([url, config]) =>
          url === '/clubs' && sortFromConfig(config) === undefined,
      ),
    ).toHaveLength(2);
  });
});

async function waitForIds(expected: string[]) {
  await waitFor(() => expect(clubIdsInTable()).toEqual(expected));
}
