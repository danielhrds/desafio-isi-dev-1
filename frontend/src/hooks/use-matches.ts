import { useQuery } from '@tanstack/react-query';
import { getMatch, listMatches } from '../services/matches.js';

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
