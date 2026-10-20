import { apiClient } from './api-client.js';
import type { ClubListItem, ClubSort, ClubSummary } from '../types/club.js';

export async function listClubs(): Promise<ClubListItem[]> {
  const response = await apiClient.get<ClubListItem[]>('/clubs');

  return response.data;
}

export async function listClubSummaries(
  sort: ClubSort,
): Promise<ClubSummary[]> {
  const response = await apiClient.get<ClubSummary[]>('/clubs', {
    params: { sort },
  });

  return response.data;
}
