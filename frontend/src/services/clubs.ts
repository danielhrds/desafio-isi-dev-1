import { apiClient } from './api-client.js';
import type { ClubListItem } from '../types/club.js';

export async function listClubs(): Promise<ClubListItem[]> {
  const response = await apiClient.get<ClubListItem[]>('/clubs');

  return response.data;
}
