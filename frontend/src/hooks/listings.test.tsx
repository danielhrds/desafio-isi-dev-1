import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useClubs } from './use-clubs.js';
import { usePlayers } from './use-players.js';
import { listClubs } from '../services/clubs.js';
import { listPlayers } from '../services/players.js';
import type { PlayerListResponse } from '../types/player.js';

vi.mock('../services/clubs.js', () => ({ listClubs: vi.fn() }));
vi.mock('../services/players.js', () => ({ listPlayers: vi.fn() }));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function playerPage(page: number): PlayerListResponse {
  return {
    data: [
      {
        id: page,
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
    ],
    meta: { page, limit: 10, total_items: 23, total_pages: 3 },
  };
}

beforeEach(() => vi.clearAllMocks());

describe('F01 listing queries', () => {
  it('loads a new server page when the requested page changes', async () => {
    vi.mocked(listPlayers).mockImplementation(async (page) => playerPage(page));
    const { result, rerender } = renderHook(({ page }) => usePlayers(page), {
      initialProps: { page: 1 },
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toEqual(playerPage(1)));
    rerender({ page: 2 });
    await waitFor(() => expect(result.current.data).toEqual(playerPage(2)));

    expect(listPlayers).toHaveBeenNthCalledWith(1, 1);
    expect(listPlayers).toHaveBeenNthCalledWith(2, 2);
    expect(listPlayers).toHaveBeenCalledTimes(2);
  });

  it('exposes an API failure instead of returning an empty list', async () => {
    vi.mocked(listPlayers).mockRejectedValueOnce(new Error('Falha de rede'));
    const { result } = renderHook(() => usePlayers(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error('Falha de rede'));
    expect(result.current.data).toBeUndefined();
  });

  it('loads the club list for resolving a player club ID', async () => {
    const clubs = [{ id: 7, name: 'Águias FC', acronym: 'AGU' }];
    vi.mocked(listClubs).mockResolvedValueOnce(clubs);
    const { result } = renderHook(() => useClubs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toEqual(clubs));
    expect(listClubs).toHaveBeenCalledTimes(1);
  });
});
