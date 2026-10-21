import { apiClient } from './api-client.js';
import type {
  CreateMatchInput,
  MatchDetail,
  MatchSummary,
} from '../types/match.js';

export async function listMatches(clubId?: number): Promise<MatchSummary[]> {
  const response = await apiClient.get<MatchSummary[]>('/matches', {
    params: clubId === undefined ? undefined : { club_id: clubId },
  });

  return response.data;
}

export async function getMatch(id: number): Promise<MatchDetail> {
  const response = await apiClient.get<MatchDetail>(`/matches/${id}`);

  return response.data;
}

export async function createMatch(
  input: CreateMatchInput,
): Promise<MatchDetail> {
  const response = await apiClient.post<MatchDetail>('/matches', input);

  return response.data;
}
