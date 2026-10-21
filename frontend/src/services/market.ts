import { apiClient } from './api-client.js';
import type {
  BuyPlayerInput,
  BuyPlayerResult,
  SellPlayerResult,
} from '../types/market.js';

export async function buyPlayer(
  playerId: number,
  input: BuyPlayerInput,
): Promise<BuyPlayerResult> {
  const response = await apiClient.post<BuyPlayerResult>(
    `/players/${playerId}/buy`,
    input,
  );

  return response.data;
}

export async function sellPlayer(playerId: number): Promise<SellPlayerResult> {
  const response = await apiClient.post<SellPlayerResult>(
    `/players/${playerId}/sell`,
  );

  return response.data;
}
