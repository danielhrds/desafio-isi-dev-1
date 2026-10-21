import { apiClient } from './api-client.js';
import type {
  ClubTransactionFilters,
  ClubTransactionsResponse,
} from '../types/transaction.js';

export async function listClubTransactions(
  clubId: number,
  filters: ClubTransactionFilters,
): Promise<ClubTransactionsResponse> {
  const response = await apiClient.get<ClubTransactionsResponse>(
    `/clubs/${clubId}/transactions`,
    { params: filters },
  );

  return response.data;
}

export async function exportClubTransactions(
  clubId: number,
  filters: ClubTransactionFilters,
): Promise<{ file: Blob; filename: string }> {
  const response = await apiClient.get<Blob>(
    `/clubs/${clubId}/transactions/export`,
    { params: filters, responseType: 'blob' },
  );
  const disposition = response.headers['content-disposition'];
  const filename = disposition?.match(/filename="?([^";]+)"?/i)?.[1];

  return {
    file: response.data,
    filename: filename ?? `club-${clubId}-transactions.csv`,
  };
}
