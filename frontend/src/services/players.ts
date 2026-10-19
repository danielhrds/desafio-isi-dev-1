import { apiClient } from './api-client.js';
import type { PlayerListResponse } from '../types/player.js';

const PAGE_SIZE = 10;

export async function listPlayers(page: number): Promise<PlayerListResponse> {
  const response = await apiClient.get<PlayerListResponse>('/players', {
    params: { page, limit: PAGE_SIZE },
  });

  return response.data;
}
