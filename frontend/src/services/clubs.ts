import { apiClient } from './api-client.js';
import type {
  ClubDetail,
  ClubListItem,
  ClubSort,
  ClubSummary,
  CreateClubInput,
} from '../types/club.js';

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

export async function getClubDetail(id: number): Promise<ClubDetail> {
  const response = await apiClient.get<ClubDetail>(`/clubs/${id}`);

  return response.data;
}

export async function createClub(input: CreateClubInput): Promise<ClubSummary> {
  const response = await apiClient.post<ClubSummary>('/clubs', input);

  return response.data;
}
