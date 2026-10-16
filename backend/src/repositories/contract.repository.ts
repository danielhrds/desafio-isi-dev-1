import type { Transaction } from 'sequelize';
import { Contract, type ContractStatus } from '../models/contract.model.js';

export interface ContractCreate {
  playerId: number;
  clubId: number;
  purchaseValue: string;
  loyaltyUntil: Date;
  status: 'ATIVO';
  startedAt: Date;
}

export interface ContractRecord extends Omit<ContractCreate, 'status'> {
  id: number;
  status: ContractStatus;
  endedAt: Date | null;
}

interface RepositoryOptions {
  transaction?: Transaction;
  forUpdate?: boolean;
}

function toRecord(contract: Contract): ContractRecord {
  return {
    id: contract.id,
    playerId: contract.playerId,
    clubId: contract.clubId,
    purchaseValue: contract.purchaseValue,
    loyaltyUntil: contract.loyaltyUntil,
    status: contract.status,
    startedAt: contract.startedAt,
    endedAt: contract.endedAt,
  };
}

export const contractRepository = {
  async create(
    data: ContractCreate,
    options: RepositoryOptions = {},
  ): Promise<ContractRecord> {
    const contract = await Contract.create(data, {
      transaction: options.transaction,
    });
    return toRecord(contract);
  },

  async findActiveByPlayerId(
    playerId: number,
    options: RepositoryOptions = {},
  ): Promise<ContractRecord | null> {
    const contract = await Contract.findOne({
      where: { playerId, status: 'ATIVO' },
      transaction: options.transaction,
      lock: options.forUpdate ? options.transaction?.LOCK.UPDATE : undefined,
    });
    return contract ? toRecord(contract) : null;
  },

  async listActiveByClubId(
    clubId: number,
    options: RepositoryOptions = {},
  ): Promise<ContractRecord[]> {
    const contracts = await Contract.findAll({
      where: { clubId, status: 'ATIVO' },
      transaction: options.transaction,
    });
    return contracts.map(toRecord);
  },

  async close(
    id: number,
    status: 'ENCERRADO' | 'RESCINDIDO',
    endedAt: Date,
    options: RepositoryOptions = {},
  ): Promise<boolean> {
    const [updatedCount] = await Contract.update(
      { status, endedAt },
      {
        where: { id, status: 'ATIVO' },
        transaction: options.transaction,
      },
    );
    return updatedCount === 1;
  },
};
