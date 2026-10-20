import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import axios from 'axios';
import {
  createClub,
  getClubDetail,
  getClubLineup,
  listClubSummaries,
  listClubs,
  saveClubLineup,
} from '../services/clubs.js';
import type {
  ClubDetail,
  ClubLineup,
  ClubListItem,
  ClubSort,
  ClubSummary,
  CreateClubInput,
  SaveClubLineupInput,
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

export function useClubLineup(id: number, enabled = true) {
  return useQuery<ClubLineup>({
    queryKey: ['club', id, 'lineup'],
    queryFn: () => getClubLineup(id),
    enabled,
  });
}

export function useSaveClubLineup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: SaveClubLineupInput }) =>
      saveClubLineup(id, input),
    onSuccess: async (lineup, { id }) => {
      queryClient.setQueryData(['club', id, 'lineup'], lineup);
      await queryClient.invalidateQueries({ queryKey: ['club', id] });
    },
    onError: async (error, { id }) => {
      const status = axios.isAxiosError(error) ? error.response?.status : null;

      if ([400, 404, 409].includes(status ?? 0)) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['club', id] }),
          queryClient.invalidateQueries({
            queryKey: ['club', id, 'lineup'],
          }),
        ]);
      }
    },
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
