import type { Transaction } from 'sequelize';
import {
  Player,
  type PlayerCondition,
  type PlayerPosition,
} from '../models/player.model.js';

export interface PlayerCreate {
  name: string;
  searchName: string;
  position: PlayerPosition;
  agility: number;
  age: number;
  baseValue: string;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  potential: number;
}

export interface PlayerProfileUpdate {
  name: string;
  searchName: string;
  position: PlayerPosition;
  agility: number;
  age: number;
}

export interface PlayerRecord extends PlayerCreate {
  id: number;
  condition: PlayerCondition;
  clubId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface RepositoryOptions {
  transaction?: Transaction;
  forUpdate?: boolean;
}

function toRecord(player: Player): PlayerRecord {
  return {
    id: player.id,
    name: player.name,
    searchName: player.searchName,
    position: player.position,
    agility: player.agility,
    age: player.age,
    baseValue: player.baseValue,
    condition: player.condition,
    clubId: player.clubId,
    pace: player.pace,
    shooting: player.shooting,
    passing: player.passing,
    dribbling: player.dribbling,
    defending: player.defending,
    physical: player.physical,
    potential: player.potential,
    createdAt: player.createdAt,
    updatedAt: player.updatedAt,
  };
}

export const playerRepository = {
  async create(
    data: PlayerCreate,
    options: RepositoryOptions = {},
  ): Promise<PlayerRecord> {
    const player = await Player.create(data, {
      transaction: options.transaction,
    });
    return toRecord(player);
  },

  async findActiveById(
    id: number,
    options: RepositoryOptions = {},
  ): Promise<PlayerRecord | null> {
    const player = await Player.findByPk(id, {
      transaction: options.transaction,
      lock: options.forUpdate ? options.transaction?.LOCK.UPDATE : undefined,
    });
    return player ? toRecord(player) : null;
  },

  async updateProfile(
    id: number,
    data: PlayerProfileUpdate,
    options: RepositoryOptions = {},
  ): Promise<boolean> {
    const [updatedCount] = await Player.update(data, {
      where: { id },
      transaction: options.transaction,
    });
    return updatedCount === 1;
  },

  async updateCondition(
    id: number,
    condition: PlayerCondition,
    options: RepositoryOptions = {},
  ): Promise<boolean> {
    const [updatedCount] = await Player.update(
      { condition },
      { where: { id }, transaction: options.transaction },
    );
    return updatedCount === 1;
  },

  async softDelete(
    id: number,
    options: RepositoryOptions = {},
  ): Promise<boolean> {
    const deletedCount = await Player.destroy({
      where: { id },
      transaction: options.transaction,
    });
    return deletedCount === 1;
  },
};
