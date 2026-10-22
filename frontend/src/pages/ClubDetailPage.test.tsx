import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../services/api-client.js';
import type {
  ClubDetail,
  ClubLineup,
  ClubRosterPlayer,
} from '../types/club.js';
import type { ClubTransactionsResponse } from '../types/transaction.js';
import type { PlayerListResponse } from '../types/player.js';
import { ClubDetailPage } from './ClubDetailPage.js';

const roster: ClubRosterPlayer[] = [
  {
    id: 1,
    name: 'Zeca Farias',
    position: 'GOL',
    overall: 88,
    agility: 70,
    age: 29,
    condition: 'APTO',
    base_value: 40,
    market_value: 41.2,
    club_id: 1,
    pace: 70,
    shooting: 45,
    passing: 65,
    dribbling: 51,
    defending: 90,
    physical: 82,
    potential: 91,
    contract: {
      purchase_value: 37.45,
      loyalty_until: '2025-06-11T14:07:00Z',
      remaining_days: 1095,
      penalty_rate: 0,
    },
  },
  {
    id: 2,
    name: 'Ana Lins',
    position: 'ZAG',
    overall: 79,
    agility: 61,
    age: 24,
    condition: 'DOENTE',
    base_value: 32,
    market_value: 28.8,
    club_id: 1,
    pace: 58,
    shooting: 30,
    passing: 67,
    dribbling: 48,
    defending: 86,
    physical: 80,
    potential: 89,
    contract: {
      purchase_value: 30,
      loyalty_until: '2025-06-12T15:20:00-03:00',
      remaining_days: 2,
      penalty_rate: 20,
    },
  },
  {
    id: 3,
    name: 'Maia Dias',
    position: 'MEI',
    overall: 84,
    agility: 83,
    age: 22,
    condition: 'MAL_CONDICIONADO',
    base_value: 48,
    market_value: 52.3,
    club_id: 1,
    pace: 82,
    shooting: 77,
    passing: 88,
    dribbling: 85,
    defending: 60,
    physical: 69,
    potential: 94,
    contract: {
      purchase_value: 49.99,
      loyalty_until: '2025-06-13T12:30:00-03:00',
      remaining_days: 46,
      penalty_rate: 7,
    },
  },
];

const club: ClubDetail = {
  id: 1,
  name: 'Águias FC',
  acronym: 'AGU',
  cash: 184.71,
  squad_value: 987.65,
  net_worth: 1555.55,
  players: roster,
};

const emptyLineup: ClubLineup = {
  club_id: 1,
  formation: null,
  complete: false,
  players: [],
};

const playerPage: PlayerListResponse = {
  data: [],
  meta: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
};

const emptyTransactions: ClubTransactionsResponse = {
  data: [],
  summary: {
    total_spent: 0,
    total_received: 0,
    total_fees: 0,
    total_penalties: 0,
    total_profit: 0,
  },
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

function apiFailure(status: number, message: string) {
  const response: AxiosResponse<{ message: string }> = {
    ...responseWith({ message }),
    status,
    statusText: status === 404 ? 'Not Found' : 'Internal Server Error',
  };

  return new AxiosError<{ message: string }>(
    'Request failed',
    undefined,
    undefined,
    undefined,
    response,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Providers({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={['/clubes/1']}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/clubes/:clubId" element={children} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );
  }

  return render(<ClubDetailPage />, { wrapper: Providers });
}

function mockClubApi(
  getClub: () => Promise<AxiosResponse<ClubDetail>> = async () =>
    responseWith(club),
) {
  return vi.spyOn(apiClient, 'get').mockImplementation(async (url) => {
    if (url === '/clubs/1') return getClub();
    if (url === '/clubs') return responseWith([club]);
    if (url === '/players') return responseWith(playerPage);
    if (url === '/clubs/1/lineup') return responseWith(emptyLineup);
    if (url === '/clubs/1/transactions') return responseWith(emptyTransactions);

    throw new Error(`Unexpected GET ${url}`);
  });
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

describe('F07 club detail and roster states', () => {
  it('shows the loading state while the club response is pending', async () => {
    const pendingClub = deferred<AxiosResponse<ClubDetail>>();
    mockClubApi(() => pendingClub.promise);

    renderPage();

    expect(
      await screen.findByRole('status', { name: 'Carregando clube' }),
    ).toBeVisible();
    pendingClub.resolve(responseWith(club));
    expect(
      await screen.findByRole('heading', { name: 'Águias FC' }),
    ).toBeVisible();
  });

  it('shows the API-provided financial summary and ordered contract data without recalculating', async () => {
    mockClubApi();

    renderPage();

    const summary = await screen.findByRole('region', {
      name: 'Resumo financeiro e do elenco',
    });
    expect(within(summary).getByText('184,71', { exact: true })).toBeVisible();
    expect(within(summary).getByText('987,65', { exact: true })).toBeVisible();
    expect(
      within(summary).getByText('1.555,55', { exact: true }),
    ).toBeVisible();

    const table = screen.getByRole('table', { name: 'Elenco do clube' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(
          (header) =>
            header.getAttribute('aria-label') || header.textContent?.trim(),
        ),
    ).toEqual([
      'Jogador',
      'Posição',
      'Overall',
      'Condição',
      'Valor de mercado',
      'Valor de compra',
      'Fim da fidelidade',
      'Dias restantes',
      '% de multa',
      'Ações',
    ]);

    const rows = within(table).getAllByRole('row').slice(1);
    expect(
      rows.flatMap((row) =>
        ['Zeca Farias', 'Ana Lins', 'Maia Dias'].filter((name) =>
          within(row).queryByText(name, { exact: true }),
        ),
      ),
    ).toEqual(['Zeca Farias', 'Ana Lins', 'Maia Dias']);

    const firstRow = within(rows[0]);
    expect(firstRow.getByText('41,20', { exact: true })).toBeVisible();
    expect(firstRow.getByText('37,45', { exact: true })).toBeVisible();
    expect(firstRow.getByText('11/06/2025', { exact: true })).toBeVisible();
    expect(firstRow.getByText('11:07', { exact: true })).toBeVisible();
    expect(firstRow.getByText('1095', { exact: true })).toBeVisible();
    expect(firstRow.getByText('0%', { exact: true })).toBeVisible();
    expect(within(rows[1]).getByText('Doente', { exact: true })).toBeVisible();
    expect(within(rows[1]).getByText('20%', { exact: true })).toBeVisible();
    expect(
      within(rows[2]).getByText('Mal condicionado', { exact: true }),
    ).toBeVisible();
    expect(within(rows[2]).getByText('7%', { exact: true })).toBeVisible();
  });

  it('shows the empty roster state when the API returns no players', async () => {
    mockClubApi(async () => responseWith({ ...club, players: [] }));

    renderPage();

    expect(
      await screen.findByText('O clube ainda não tem jogadores'),
    ).toBeVisible();
    expect(
      screen.queryByRole('table', { name: 'Elenco do clube' }),
    ).not.toBeInTheDocument();
  });

  it('shows the exact API error message and retries the club request once', async () => {
    const apiMessage = 'Falha temporária ao consultar o clube.';
    let detailRequests = 0;
    mockClubApi(async () => {
      detailRequests += 1;
      if (detailRequests === 1) throw apiFailure(503, apiMessage);

      return responseWith(club);
    });

    const user = userEvent.setup();
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(apiMessage, { exact: true })).toBeVisible();
    expect(detailRequests).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(
      await screen.findByRole('heading', { name: 'Águias FC' }),
    ).toBeVisible();
    expect(detailRequests).toBe(2);
  });

  it('renders the not-found state for an API 404', async () => {
    mockClubApi(async () => {
      throw apiFailure(404, 'Clube não encontrado.');
    });

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Clube não encontrado' }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Voltar para clubes' }),
    ).toHaveAttribute('href', '/clubes');
    await waitFor(() => {
      expect(
        screen.queryByRole('table', { name: 'Elenco do clube' }),
      ).toBeNull();
    });
  });
});
