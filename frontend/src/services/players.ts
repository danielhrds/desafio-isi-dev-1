import { apiClient } from './api-client.js';
import type { PlayerListFilters, PlayerListResponse } from '../types/player.js';

const PAGE_SIZE = 10;

export async function listPlayers(
  page: number,
  filters: PlayerListFilters = {},
  limit = PAGE_SIZE,
): Promise<PlayerListResponse> {
  const response = await apiClient.get<PlayerListResponse>('/players', {
    params: { ...filters, page, limit },
  });

  return response.data;
}
