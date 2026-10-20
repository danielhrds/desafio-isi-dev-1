import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buyPlayer } from '../services/market.js';
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
