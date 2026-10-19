import { useQuery } from '@tanstack/react-query';
import { listPlayers } from '../services/players.js';

export function usePlayers(page: number) {
  return useQuery({
    queryKey: ['players', page],
    queryFn: () => listPlayers(page),
  });
}
