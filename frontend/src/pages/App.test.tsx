import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
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
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return render(<App />, { wrapper: Providers });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listClubs).mockResolvedValue([
    { id: 7, name: 'Águias FC', acronym: 'AGU' },
  ]);
});

describe('F01 player list screen', () => {
  it('renders all required fields from the API, resolving club names and formatting money', async () => {
    vi.mocked(listPlayers).mockResolvedValue(page);
    renderApp();

    const table = await screen.findByRole('table', { name: 'Jogadores' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([
      'Nome',
      'Posição',
      'Overall',
      'Agilidade',
      'Idade',
      'Condição',
      'Valor base',
      'Valor de mercado',
      'Clube',
    ]);
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('Águias FC')).toBeInTheDocument();
    expect(within(table).getByText('Livre')).toBeInTheDocument();
    expect(within(table).getByText('Mal condicionado')).toBeInTheDocument();
    expect(within(table).getByText('37,00')).toBeInTheDocument();
    expect(within(table).getByText('28,60')).toBeInTheDocument();
    expect(screen.getByText('2 encontrados')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 2 de 2 jogadores')).toBeInTheDocument();
    expect(listPlayers).toHaveBeenCalledExactlyOnceWith(1);
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
    expect(screen.getByText('0 encontrados')).toBeInTheDocument();
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
    vi.mocked(listPlayers)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(page);
    const user = userEvent.setup();
    renderApp();

    expect(
      await screen.findByText('Falha ao consultar jogadores'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    await waitFor(() =>
      expect(
        screen.getByRole('table', { name: 'Jogadores' }),
      ).toBeInTheDocument(),
    );
    expect(listPlayers).toHaveBeenCalledTimes(2);
  });

  it('retries the club lookup when player data is already loaded', async () => {
    vi.mocked(listPlayers).mockResolvedValue(page);
    vi.mocked(listClubs)
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce([{ id: 7, name: 'Águias FC', acronym: 'AGU' }]);
    const user = userEvent.setup();
    renderApp();

    expect(
      await screen.findByText('Não foi possível carregar os jogadores.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Águias FC')).toBeInTheDocument();
    expect(listClubs).toHaveBeenCalledTimes(2);
    expect(listPlayers).toHaveBeenCalledTimes(1);
  });
});
