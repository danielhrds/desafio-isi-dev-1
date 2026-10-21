import { apiClient } from './api-client.js';
import type { Standing } from '../types/standing.js';

export async function getStandings(): Promise<Standing[]> {
  const response = await apiClient.get<Standing[]>('/standings');

  return response.data;
}
