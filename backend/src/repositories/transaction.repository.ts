import type { Transaction } from 'sequelize';
import {
  MarketTransaction,
  type TransactionType,
} from '../models/transaction.model.js';

export interface TransactionCreate {
  clubId: number;
  playerId: number;
  playerName: string;
  type: TransactionType;
  value: string;
  fee: string;
  penalty: string;
  profit: string | null;
  cashChange: string;
  createdAt: Date;
}

export interface TransactionRecord extends TransactionCreate {
  id: number;
}

export interface TransactionFilters {
  types?: TransactionType[];
  playerId?: number;
}

interface RepositoryOptions {
  transaction?: Transaction;
}

function toRecord(transaction: MarketTransaction): TransactionRecord {
  return {
    id: transaction.id,
    clubId: transaction.clubId,
    playerId: transaction.playerId,
    playerName: transaction.playerName,
    type: transaction.type,
    value: transaction.value,
    fee: transaction.fee,
    penalty: transaction.penalty,
    profit: transaction.profit,
    cashChange: transaction.cashChange,
    createdAt: transaction.createdAt,
  };
}

export const transactionRepository = {
  async create(
    data: TransactionCreate,
    options: RepositoryOptions = {},
  ): Promise<TransactionRecord> {
    const transaction = await MarketTransaction.create(data, {
      transaction: options.transaction,
    });
    return toRecord(transaction);
  },

  async listByClubId(
    clubId: number,
    filters: TransactionFilters = {},
    options: RepositoryOptions = {},
  ): Promise<TransactionRecord[]> {
    const transactions = await MarketTransaction.findAll({
      where: {
        clubId,
        ...(filters.types ? { type: filters.types } : {}),
        ...(filters.playerId !== undefined
          ? { playerId: filters.playerId }
          : {}),
      },
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
      transaction: options.transaction,
    });
    return transactions.map(toRecord);
  },

  async hasSaleByClubAndPlayer(
    clubId: number,
    playerId: number,
    options: RepositoryOptions = {},
  ): Promise<boolean> {
    return (
      (await MarketTransaction.findOne({
        attributes: ['id'],
        where: { clubId, playerId, type: 'VENDA' },
        transaction: options.transaction,
      })) !== null
    );
  },
};
