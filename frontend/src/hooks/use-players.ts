import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createPlayer, listPlayers } from '../services/players.js';
import type { PlayerListFilters } from '../types/player.js';

export function usePlayers(page: number, filters?: PlayerListFilters) {
  return useQuery({
    queryKey: ['players', page, filters ?? {}],
    queryFn: () => (filters ? listPlayers(page, filters) : listPlayers(page)),
  });
}

export function usePlayerCounts(filters: PlayerListFilters) {
  const countFilters = { ...filters };
  delete countFilters.free;
  delete countFilters.club_id;
  delete countFilters.sort;

  const [all, free, assigned] = useQueries({
    queries: ([undefined, true, false] as const).map((freeValue) => {
      const variant = {
        ...countFilters,
        ...(freeValue === undefined ? {} : { free: freeValue }),
      };
      return {
        queryKey: ['player-count', variant],
        queryFn: () => listPlayers(1, variant, 1),
      };
    }),
  });

  return {
    all: all.data?.meta.total_items,
    free: free.data?.meta.total_items,
    assigned: assigned.data?.meta.total_items,
  };
}

export function useCreatePlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPlayer,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['players'] }),
        queryClient.invalidateQueries({ queryKey: ['player-count'] }),
      ]);
    },
  });
}
