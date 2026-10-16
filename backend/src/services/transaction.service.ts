import { Decimal } from 'decimal.js';
import { AppError } from '../errors/app.error.js';
import { clubRepository } from '../repositories/club.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import {
  transactionRepository,
  type TransactionFilters,
  type TransactionRecord,
} from '../repositories/transaction.repository.js';
import type { ListTransactionsQuery } from '../schemas/transaction.schema.js';
import { formatBrasiliaDateTime } from '../validation/brasilia-datetime.js';

const csvHeader =
  'data_hora;tipo;jogador;valor;taxa_ou_comissao;multa;lucro;variacao_caixa';

async function loadTransactions(
  clubId: number,
  query: ListTransactionsQuery,
): Promise<TransactionRecord[]> {
  if (!(await clubRepository.exists(clubId))) {
    throw new AppError(404, 'Clube não encontrado.');
  }

  const playerId =
    query.player_id === undefined ? undefined : Number(query.player_id);
  if (
    playerId !== undefined &&
    !(await playerRepository.findActiveById(playerId))
  ) {
    throw new AppError(404, 'Jogador não encontrado.');
  }

  const types: TransactionFilters['types'] =
    query.type === undefined
      ? undefined
      : query.type === 'COMPRA'
        ? ['COMPRA']
        : query.type === 'VENDA'
          ? ['VENDA']
          : ['COMPRA', 'VENDA'];
  return transactionRepository.listByClubId(clubId, { types, playerId });
}

function formatCsvMoney(value: string): string {
  return new Decimal(value).toFixed(2).replace('.', ',');
}

function formatCsvName(name: string): string {
  return /[;"]/.test(name) ? `"${name.replace(/"/g, '""')}"` : name;
}

export const transactionService = {
  async listTransactions(clubId: number, query: ListTransactionsQuery) {
    const entries = await loadTransactions(clubId, query);
    let totalSpent = new Decimal(0);
    let totalReceived = new Decimal(0);
    let totalFees = new Decimal(0);
    let totalPenalties = new Decimal(0);
    let totalProfit = new Decimal(0);

    for (const entry of entries) {
      totalFees = totalFees.plus(entry.fee);
      if (entry.type === 'COMPRA') {
        totalSpent = totalSpent.plus(new Decimal(entry.value).plus(entry.fee));
      } else {
        totalReceived = totalReceived.plus(entry.cashChange);
        totalPenalties = totalPenalties.plus(entry.penalty);
        totalProfit = totalProfit.plus(entry.profit ?? '0.00');
      }
    }

    return {
      data: entries.map((entry) => ({
        id: entry.id,
        club_id: entry.clubId,
        player_id: entry.playerId,
        player_name: entry.playerName,
        type: entry.type,
        value: Number(entry.value),
        fee: Number(entry.fee),
        penalty: Number(entry.penalty),
        profit: entry.profit === null ? null : Number(entry.profit),
        cash_change: Number(entry.cashChange),
        created_at: formatBrasiliaDateTime(entry.createdAt),
      })),
      summary: {
        total_spent: totalSpent.toNumber(),
        total_received: totalReceived.toNumber(),
        total_fees: totalFees.toNumber(),
        total_penalties: totalPenalties.toNumber(),
        total_profit: totalProfit.toNumber(),
      },
    };
  },

  async exportTransactions(clubId: number, query: ListTransactionsQuery) {
    const entries = await loadTransactions(clubId, query);
    const lines = entries.map((entry) =>
      [
        formatBrasiliaDateTime(entry.createdAt),
        entry.type,
        formatCsvName(entry.playerName),
        formatCsvMoney(entry.value),
        formatCsvMoney(entry.fee),
        formatCsvMoney(entry.penalty),
        entry.profit === null ? '' : formatCsvMoney(entry.profit),
        formatCsvMoney(entry.cashChange),
      ].join(';'),
    );
    return [csvHeader, ...lines].join('\n') + '\n';
  },
};
