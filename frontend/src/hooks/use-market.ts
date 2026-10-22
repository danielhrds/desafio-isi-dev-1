import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buyPlayer, sellPlayer } from '../services/market.js';
import type { BuyPlayerInput } from '../types/market.js';

export function useBuyPlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      playerId,
      input,
    }: {
      playerId: number;
      input: BuyPlayerInput;
    }) => buyPlayer(playerId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['players'] }),
        queryClient.invalidateQueries({ queryKey: ['player'] }),
        queryClient.invalidateQueries({ queryKey: ['player-count'] }),
        queryClient.invalidateQueries({ queryKey: ['clubs'] }),
        queryClient.invalidateQueries({ queryKey: ['club'] }),
      ]);
    },
  });
}

export function useSellPlayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ playerId }: { playerId: number; clubId: number }) =>
      sellPlayer(playerId),
    onSuccess: async (sale, { clubId }) => {
      const affectedClubIds = new Set([clubId, sale.club_id]);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['players'] }),
        queryClient.invalidateQueries({ queryKey: ['player'] }),
        queryClient.invalidateQueries({ queryKey: ['player-count'] }),
        queryClient.invalidateQueries({ queryKey: ['clubs'] }),
        ...Array.from(affectedClubIds, (affectedClubId) =>
          queryClient.invalidateQueries({
            queryKey: ['club', affectedClubId],
          }),
        ),
      ]);
    },
  });
}
