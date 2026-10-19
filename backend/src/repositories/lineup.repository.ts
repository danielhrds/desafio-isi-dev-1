import { fn, literal, Op, type Transaction } from 'sequelize';
import { Lineup } from '../models/lineup.model.js';
import type {
  PlayerCondition,
  PlayerPosition,
} from '../models/player.model.js';

export interface LineupRecord {
  clubId: number;
  playerId: number;
  createdAt: Date;
}

export interface MatchStarterRecord {
  clubId: number;
  id: number;
  name: string;
  position: PlayerPosition;
  condition: PlayerCondition;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  playerClubId: number | null;
  deletedAt: Date | null;
  snapshotAt: Date;
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
  async listMatchStarters(
    homeClubId: number,
    awayClubId: number,
    transaction: Transaction,
  ): Promise<MatchStarterRecord[]> {
    const lineups = await Lineup.findAll({
      attributes: [
        'clubId',
        'playerId',
        [fn('statement_timestamp'), 'snapshotAt'],
      ],
      where: { clubId: { [Op.in]: [homeClubId, awayClubId] } },
      include: [
        {
          association: 'player',
          required: true,
          paranoid: false,
          attributes: [
            'id',
            'name',
            'position',
            'condition',
            'shooting',
            'passing',
            'dribbling',
            'defending',
            'clubId',
            'deletedAt',
          ],
        },
      ],
      order: [
        ['clubId', 'ASC'],
        [
          literal(
            `CASE "player"."posicao" WHEN 'GOL' THEN 1 WHEN 'ZAG' THEN 2 WHEN 'LAT' THEN 3 WHEN 'MEI' THEN 4 WHEN 'ATA' THEN 5 END`,
          ),
          'ASC',
        ],
        [literal('"player"."nome_busca" COLLATE "ucs_basic"'), 'ASC'],
        ['playerId', 'ASC'],
      ],
      transaction,
    });

    return lineups.map((lineup) => {
      const player = lineup.player;
      if (!player) throw new Error('Titular da escalação não encontrado.');
      return {
        clubId: lineup.clubId,
        id: player.id,
        name: player.name,
        position: player.position,
        condition: player.condition,
        shooting: player.shooting,
        passing: player.passing,
        dribbling: player.dribbling,
        defending: player.defending,
        playerClubId: player.clubId,
        deletedAt: player.deletedAt,
        snapshotAt: lineup.get('snapshotAt') as Date,
      };
    });
  },

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
