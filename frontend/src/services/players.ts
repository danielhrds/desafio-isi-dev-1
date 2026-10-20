import { apiClient } from './api-client.js';
import type {
  CreatePlayerInput,
  PlayerDetail,
  PlayerListFilters,
  PlayerListResponse,
  UpdatePlayerInput,
} from '../types/player.js';

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

export async function createPlayer(
  input: CreatePlayerInput,
): Promise<PlayerDetail> {
  const response = await apiClient.post<PlayerDetail>('/players', input);
  return response.data;
}

export async function updatePlayer(
  id: number,
  input: UpdatePlayerInput,
): Promise<PlayerDetail> {
  const response = await apiClient.put<PlayerDetail>(`/players/${id}`, input);
  return response.data;
}
