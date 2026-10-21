export const transactionTypes = ['COMPRA', 'VENDA'] as const;

export type TransactionType = (typeof transactionTypes)[number];

export interface ClubTransaction {
  id: number;
  club_id: number;
  player_id: number;
  player_name: string;
  type: TransactionType;
  value: number;
  fee: number;
  penalty: number;
  profit: number | null;
  cash_change: number;
  created_at: string;
}

export interface ClubTransactionSummary {
  total_spent: number;
  total_received: number;
  total_fees: number;
  total_penalties: number;
  total_profit: number;
}

export interface ClubTransactionsResponse {
  data: ClubTransaction[];
  summary: ClubTransactionSummary;
}

export interface ClubTransactionFilters {
  type?: TransactionType | 'COMPRA,VENDA';
  player_id?: number;
}
