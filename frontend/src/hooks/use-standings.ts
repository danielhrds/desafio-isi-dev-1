import { useQuery } from '@tanstack/react-query';
import { getStandings } from '../services/standings.js';

export function useStandings() {
  return useQuery({
    queryKey: ['standings'],
    queryFn: getStandings,
  });
}
