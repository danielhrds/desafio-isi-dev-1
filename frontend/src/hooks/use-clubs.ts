import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { createClub, listClubSummaries, listClubs } from '../services/clubs.js';
import type {
  ClubListItem,
  ClubSort,
  ClubSummary,
  CreateClubInput,
} from '../types/club.js';

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

export function useCreateClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateClubInput) => createClub(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}
