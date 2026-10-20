import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  createClub,
  getClubDetail,
  listClubSummaries,
  listClubs,
} from '../services/clubs.js';
import type {
  ClubDetail,
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

export function useClubDetail(id: number, enabled = true) {
  return useQuery<ClubDetail>({
    queryKey: ['club', id],
    queryFn: () => getClubDetail(id),
    enabled,
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
