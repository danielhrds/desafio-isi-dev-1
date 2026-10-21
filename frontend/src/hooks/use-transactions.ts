import {
  useMutation,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  exportClubTransactions,
  listClubTransactions,
} from '../services/transactions.js';
import type {
  ClubTransactionFilters,
  ClubTransactionsResponse,
} from '../types/transaction.js';

export function useClubTransactions(
  clubId: number,
  filters: ClubTransactionFilters,
  enabled = true,
): UseQueryResult<ClubTransactionsResponse, Error> {
  return useQuery({
    queryKey: ['club', clubId, 'transactions', filters],
    queryFn: () => listClubTransactions(clubId, filters),
    enabled,
    retry: false,
  });
}

export function useExportClubTransactions() {
  return useMutation({
    mutationFn: ({
      clubId,
      filters,
    }: {
      clubId: number;
      filters: ClubTransactionFilters;
    }) => exportClubTransactions(clubId, filters),
  });
}
