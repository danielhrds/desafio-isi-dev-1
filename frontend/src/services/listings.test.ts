import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxiosHeaders, type AxiosResponse } from 'axios';
import { apiClient } from './api-client.js';
import { listClubs } from './clubs.js';
import { listPlayers } from './players.js';
import type { ClubListItem } from '../types/club.js';
import type { PlayerListResponse } from '../types/player.js';

function responseWith<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
}

afterEach(() => vi.restoreAllMocks());

describe('F01 listing API methods', () => {
  it.each([1, 3])(
    'requests player page %i with exactly 10 items',
    async (page) => {
      const payload: PlayerListResponse = {
        data: [],
        meta: { page, limit: 10, total_items: 23, total_pages: 3 },
      };
      const get = vi
        .spyOn(apiClient, 'get')
        .mockResolvedValueOnce(responseWith(payload));

      await expect(listPlayers(page)).resolves.toEqual(payload);
      expect(get).toHaveBeenCalledExactlyOnceWith('/players', {
        params: { page, limit: 10 },
      });
    },
  );

  it('returns club IDs, names and acronyms from the club list', async () => {
    const clubs: ClubListItem[] = [
      { id: 7, name: 'Águias FC', acronym: 'AGU' },
    ];
    const get = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce(responseWith(clubs));

    await expect(listClubs()).resolves.toEqual(clubs);
    expect(get).toHaveBeenCalledExactlyOnceWith('/clubs');
  });

  it('preserves an API rejection for the screen to handle', async () => {
    const error = new Error('Falha de rede');
    vi.spyOn(apiClient, 'get').mockRejectedValueOnce(error);

    await expect(listPlayers(1)).rejects.toBe(error);
  });
});
