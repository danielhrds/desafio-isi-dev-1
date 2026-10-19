import { useQuery } from '@tanstack/react-query';
import { listClubs } from '../services/clubs.js';

export function useClubs() {
  return useQuery({
    queryKey: ['clubs'],
    queryFn: listClubs,
  });
}
