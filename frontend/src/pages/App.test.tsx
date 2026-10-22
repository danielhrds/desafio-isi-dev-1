import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayersPage } from './PlayersPage.js';
import { listClubs } from '../services/clubs.js';
import { listPlayers } from '../services/players.js';
import type { PlayerListResponse } from '../types/player.js';

vi.mock('../services/clubs.js', () => ({ listClubs: vi.fn() }));
vi.mock('../services/players.js', () => ({ listPlayers: vi.fn() }));

const page: PlayerListResponse = {
  data: [
    {
      id: 1,
      name: 'Meia Lua',
      position: 'MEI',
      overall: 75,
      agility: 85,
      age: 25,
      condition: 'MAL_CONDICIONADO',
      base_value: 40,
      market_value: 37,
      club_id: 7,
    },
    {
      id: 2,
      name: 'João Silva',
      position: 'ATA',
      overall: 68,
      agility: 70,
      age: 21,
      condition: 'APTO',
      base_value: 26,
      market_value: 28.6,
      club_id: null,
    },
  ],
  meta: { page: 1, limit: 10, total_items: 2, total_pages: 1 },
};

function renderApp() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Providers({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={['/jogadores']}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </MemoryRouter>
    );
  }
  return render(<PlayersPage />, { wrapper: Providers });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listClubs).mockResolvedValue([
    { id: 7, name: 'Águias FC', acronym: 'AGU' },
  ]);
});

describe('F01 player list screen', () => {
  it('renders all required fields from the API, resolving club names and formatting money', async () => {
    vi.mocked(listPlayers).mockImplementation(
      async (_requestedPage, filters = {}, limit = 10) => {
        if (limit === 1) {
          const total = filters.free === undefined ? 2 : 1;
          return {
            data: [filters.free === true ? page.data[1] : page.data[0]],
            meta: { page: 1, limit: 1, total_items: total, total_pages: total },
          };
        }
        return page;
      },
    );
    renderApp();

    const table = await screen.findByRole('table', { name: 'Jogadores' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([
      'Jogador',
      'Posição',
      'Overall',
      'Agilidade',
      'Idade',
      'Condição',
      'Valor base',
      'Valor de mercado',
      'Clube',
      'Ações',
    ]);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const expectedRows = [
      {
        name: 'Meia Lua',
        initials: 'ML',
        positionLabel: 'Meio-campo',
        fields: ['MEI', '75', '85', '25', 'Mal condicionado', '40,00', '37,00'],
        club: 'Águias FC',
      },
      {
        name: 'João Silva',
        initials: 'JS',
        positionLabel: 'Atacante',
        fields: ['ATA', '68', '70', '21', 'Apto', '26,00', '28,60'],
        club: 'Livre',
      },
    ];
    expectedRows.forEach((expectedRow, index) => {
      const cells = within(rows[index]).getAllByRole('cell');
      expect(cells).toHaveLength(10);
      expect(
        within(cells[0]).getByText(expectedRow.name, { exact: true }),
      ).toBeInTheDocument();
      expect(
        within(cells[0]).getByText(expectedRow.initials, { exact: true }),
      ).toBeInTheDocument();
      expect(
        within(cells[0]).getByText(expectedRow.positionLabel, { exact: true }),
      ).toBeInTheDocument();
      expect(cells.slice(1, 8).map((cell) => cell.textContent?.trim())).toEqual(
        expectedRow.fields,
      );
      expect(
        within(cells[8]).getByText(expectedRow.club, { exact: true }),
      ).toBeInTheDocument();
      expect(
        within(cells[3]).getByRole('progressbar', {
          name: `Agilidade de ${expectedRow.name}`,
        }),
      ).toHaveAttribute('aria-valuenow', expectedRow.fields[2]);
    });
    expect(
      screen.getByText('Mostrando 1–2 de 2 jogadores'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
    const tableRequests = vi
      .mocked(listPlayers)
      .mock.calls.filter(([, , limit = 10]) => limit === 10)
      .map(([requestedPage, filters = {}, limit = 10]) => ({
        page: requestedPage,
        filters,
        limit,
      }));
    expect(tableRequests).toEqual([{ page: 1, filters: {}, limit: 10 }]);
    expect(listClubs).toHaveBeenCalledTimes(1);
  });

  it('shows loading and then the empty state for a zero total', async () => {
    let resolvePage!: (value: PlayerListResponse) => void;
    vi.mocked(listPlayers).mockReturnValue(
      new Promise((resolve) => {
        resolvePage = resolve;
      }),
    );
    renderApp();

    expect(
      screen.getByRole('status', { name: 'Carregando jogadores' }),
    ).toBeInTheDocument();
    resolvePage({
      data: [],
      meta: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
    });

    expect(
      await screen.findByText('Nenhum jogador encontrado'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the API message and retries the failed query', async () => {
    const error = new AxiosError(
      'Request failed',
      'ERR_BAD_RESPONSE',
      undefined,
      undefined,
      {
        data: { message: 'Falha ao consultar jogadores' },
        status: 503,
        statusText: 'Service Unavailable',
        headers: {},
        config: { headers: new AxiosHeaders() },
      },
    );
    const tableQuery = vi
      .fn<typeof listPlayers>()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(page);
    vi.mocked(listPlayers).mockImplementation(
      (requestedPage, filters = {}, limit = 10) => {
        if (limit === 1) {
          const total = filters.free === undefined ? 2 : 1;
          return Promise.resolve({
            data: [filters.free === true ? page.data[1] : page.data[0]],
            meta: { page: 1, limit: 1, total_items: total, total_pages: total },
          });
        }
        return tableQuery(requestedPage, filters, limit);
      },
    );
    const user = userEvent.setup();
    renderApp();

    expect(
      await screen.findByText('Falha ao consultar jogadores', { exact: true }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Nenhum jogador encontrado'),
    ).not.toBeInTheDocument();
    expect(tableQuery).toHaveBeenCalledExactlyOnceWith(1, {}, 10);
    expect(listClubs).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    const table = await screen.findByRole('table', { name: 'Jogadores' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('Meia Lua')).toBeInTheDocument();
    expect(within(table).getByText('João Silva')).toBeInTheDocument();
    expect(within(table).getByText('Águias FC')).toBeInTheDocument();
    expect(within(table).getByText('37,00')).toBeInTheDocument();
    expect(
      screen.queryByText('Falha ao consultar jogadores'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Tentar novamente' }),
    ).not.toBeInTheDocument();
    expect(tableQuery).toHaveBeenCalledTimes(2);
    expect(tableQuery).toHaveBeenNthCalledWith(2, 1, {}, 10);
    expect(listClubs).toHaveBeenCalledTimes(1);
  });

  it('retries the club lookup when player data is already loaded', async () => {
    const tableQuery = vi.fn<typeof listPlayers>().mockResolvedValue(page);
    vi.mocked(listPlayers).mockImplementation(
      (requestedPage, filters = {}, limit = 10) => {
        if (limit === 1) {
          const total = filters.free === undefined ? 2 : 1;
          return Promise.resolve({
            data: [filters.free === true ? page.data[1] : page.data[0]],
            meta: { page: 1, limit: 1, total_items: total, total_pages: total },
          });
        }
        return tableQuery(requestedPage, filters, limit);
      },
    );
    vi.mocked(listClubs)
      .mockRejectedValueOnce(
        new AxiosError('Network unavailable', 'ERR_NETWORK'),
      )
      .mockResolvedValueOnce([{ id: 7, name: 'Águias FC', acronym: 'AGU' }]);
    const user = userEvent.setup();
    renderApp();

    expect(
      await screen.findByText('Não foi possível carregar os jogadores'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Verifique a conexão e tente novamente.', {
        exact: true,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Nenhum jogador encontrado'),
    ).not.toBeInTheDocument();
    expect(tableQuery).toHaveBeenCalledExactlyOnceWith(1, {}, 10);
    expect(listClubs).toHaveBeenCalledTimes(1);
    const initialPlayerRequests = [...vi.mocked(listPlayers).mock.calls];
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    const table = await screen.findByRole('table', { name: 'Jogadores' });
    const assignedPlayer = within(table).getByRole('row', { name: /Meia Lua/ });
    const freePlayer = within(table).getByRole('row', { name: /João Silva/ });
    expect(
      within(assignedPlayer).getByText('Águias FC', { exact: true }),
    ).toBeInTheDocument();
    expect(within(freePlayer).getByText('Livre')).toBeInTheDocument();
    expect(
      screen.queryByText('Não foi possível carregar os jogadores'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Verifique a conexão e tente novamente.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Tentar novamente' }),
    ).not.toBeInTheDocument();
    expect(listClubs).toHaveBeenCalledTimes(2);
    expect(tableQuery).toHaveBeenCalledExactlyOnceWith(1, {}, 10);
    expect(vi.mocked(listPlayers).mock.calls).toEqual(initialPlayerRequests);
  });

  it('navigates through 10-item pages using the API meta, including the short last page', async () => {
    const namesByPage = [
      [
        'André Lacerda',
        'Bruno Tavares',
        'Danilo Freitas',
        'Diego Ramos',
        'Eduardo Paiva',
        'Ênio Carvalho',
        'Felipe Moura',
        'Gabriel Antunes',
        'Heitor Gomes',
        'Ícaro Mendes',
      ],
      [
        'João Silva',
        'Leandro Costa',
        'Marcelo Reis',
        'Natan Alves',
        'Otávio Rezende',
        'Paulo Moreira',
        'Rafael Nogueira',
        'Renan Castro',
        'Sávio Lima',
        'Tiago Moraes',
      ],
      ['Ulisses Rocha', 'Vitor Martins', 'Wesley Santos'],
    ];
    const responses: PlayerListResponse[] = namesByPage.map(
      (names, pageIndex) => ({
        data: names.map((name, index) => ({
          ...page.data[0],
          id: pageIndex * 10 + index + 1,
          name,
        })),
        meta: {
          page: pageIndex + 1,
          limit: 10,
          total_items: 23,
          total_pages: 3,
        },
      }),
    );
    const tableQuery = vi
      .fn<typeof listPlayers>()
      .mockImplementation(async (requestedPage) => {
        const response = responses[requestedPage - 1];
        if (!response) throw new Error('Unexpected player page');
        return response;
      });
    vi.mocked(listPlayers).mockImplementation(
      (requestedPage, filters = {}, limit = 10) => {
        if (limit === 1) {
          const total = filters.free === true ? 0 : 23;
          return Promise.resolve({
            data: filters.free === true ? [] : [responses[0].data[0]],
            meta: { page: 1, limit: 1, total_items: total, total_pages: total },
          });
        }
        return tableQuery(requestedPage, filters, limit);
      },
    );

    async function expectPage(
      currentPage: number,
      summary: string,
      expectedNames: string[],
    ) {
      expect(await screen.findByText(summary)).toBeInTheDocument();
      const table = screen.getByRole('table', { name: 'Jogadores' });
      const rows = within(table).getAllByRole('row').slice(1);
      expect(rows).toHaveLength(expectedNames.length);
      expectedNames.forEach((name, index) => {
        expect(
          within(rows[index]).getByText(name, { exact: true }),
        ).toBeInTheDocument();
      });
      for (const number of [1, 2, 3]) {
        const button = screen.getByRole('button', { name: `Página ${number}` });
        if (number === currentPage) {
          expect(button).toHaveAttribute('aria-current', 'page');
        } else {
          expect(button).not.toHaveAttribute('aria-current');
        }
      }
    }

    const user = userEvent.setup();
    renderApp();

    await expectPage(1, 'Mostrando 1–10 de 23 jogadores', namesByPage[0]);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Próxima' }));

    await expectPage(2, 'Mostrando 11–20 de 23 jogadores', namesByPage[1]);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Página 3' }));

    await expectPage(3, 'Mostrando 21–23 de 23 jogadores', namesByPage[2]);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Anterior' }));

    await expectPage(2, 'Mostrando 11–20 de 23 jogadores', namesByPage[1]);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Anterior' }));

    await expectPage(1, 'Mostrando 1–10 de 23 jogadores', namesByPage[0]);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeEnabled();
    for (const number of [1, 2, 3]) {
      expect(tableQuery).toHaveBeenCalledWith(number, {}, 10);
    }
    for (const [requestedPage, filters, limit] of tableQuery.mock.calls) {
      expect([1, 2, 3]).toContain(requestedPage);
      expect(filters).toEqual({});
      expect(limit).toBe(10);
    }
  });
});
