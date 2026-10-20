import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { listClubSummaries, listClubs } from '../services/clubs.js';
import type { ClubListItem, ClubSort, ClubSummary } from '../types/club.js';

export function useClubs(): UseQueryResult<ClubListItem[], Error> {
  return useQuery({
    queryKey: ['clubs', 'name'],
    queryFn: listClubs,
  });
}

export function useClubSummaries(sort: ClubSort) {
  return useQuery<ClubSummary[]>({
    queryKey: ['clubs', sort],
    queryFn: () => listClubSummaries(sort),
  });
}
