import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createPlayer,
  deletePlayer,
  getPlayer,
  listPlayers,
  updatePlayer,
} from '../services/players.js';
import type { PlayerListFilters, UpdatePlayerInput } from '../types/player.js';

export function usePlayers(page: number, filters?: PlayerListFilters) {
  return useQuery({
    queryKey: ['players', page, filters ?? {}],
    queryFn: () => (filters ? listPlayers(page, filters) : listPlayers(page)),
  });
}

export function usePlayer(id: number) {
  return useQuery({
    queryKey: ['player', id],
    queryFn: () => getPlayer(id),
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

export function useUpdatePlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdatePlayerInput }) =>
      updatePlayer(id, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['players'] }),
        queryClient.invalidateQueries({ queryKey: ['player'] }),
        queryClient.invalidateQueries({ queryKey: ['player-count'] }),
        queryClient.invalidateQueries({ queryKey: ['clubs'] }),
      ]);
    },
  });
}

export function useDeletePlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePlayer,
    onSuccess: async (_, id) => {
      queryClient.removeQueries({ queryKey: ['player', id], exact: true });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['players'] }),
        queryClient.invalidateQueries({ queryKey: ['player-count'] }),
      ]);
    },
  });
}
