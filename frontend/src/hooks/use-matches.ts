import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createMatch, getMatch, listMatches } from '../services/matches.js';
import type { CreateMatchInput } from '../types/match.js';

export function useMatches(clubId?: number) {
  return useQuery({
    queryKey: ['matches', { clubId: clubId ?? null }],
    queryFn: () => listMatches(clubId),
  });
}

export function useMatch(id: number, enabled = true) {
  return useQuery({
    queryKey: ['match', id],
    queryFn: () => getMatch(id),
    enabled,
  });
}

export function useCreateMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateMatchInput) => createMatch(input),
    onSuccess: (match) => {
      queryClient.setQueryData(['match', match.id], match);
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}
