import type { Transaction } from 'sequelize';
import { Lineup } from '../models/lineup.model.js';

export interface LineupRecord {
  clubId: number;
  playerId: number;
  createdAt: Date;
}

interface RepositoryOptions {
  transaction?: Transaction;
}

function toRecord(lineup: Lineup): LineupRecord {
  return {
    clubId: lineup.clubId,
    playerId: lineup.playerId,
    createdAt: lineup.createdAt,
  };
}

export const lineupRepository = {
  async listByClubId(
    clubId: number,
    options: RepositoryOptions = {},
  ): Promise<LineupRecord[]> {
    const lineups = await Lineup.findAll({
      where: { clubId },
      order: [['playerId', 'ASC']],
      transaction: options.transaction,
    });
    return lineups.map(toRecord);
  },

  async replaceByClubId(
    clubId: number,
    playerIds: number[],
    transaction: Transaction,
  ): Promise<void> {
    await Lineup.destroy({ where: { clubId }, transaction });
    const createdAt = new Date();
    await Lineup.bulkCreate(
      playerIds.map((playerId) => ({ clubId, playerId, createdAt })),
      { transaction },
    );
  },

  async removeByPlayerId(
    playerId: number,
    options: RepositoryOptions = {},
  ): Promise<boolean> {
    const deletedCount = await Lineup.destroy({
      where: { playerId },
      transaction: options.transaction,
    });
    return deletedCount === 1;
  },
};
