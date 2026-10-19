import { Op, type Transaction } from 'sequelize';
import { MatchDuel } from '../models/match-duel.model.js';
import { Match } from '../models/match.model.js';

export type MatchCreate = Omit<MatchRecord, 'id'>;
export type MatchDuelCreate = Omit<MatchDuelRecord, 'id' | 'matchId'>;

export interface MatchRecord {
  id: number;
  homeClubId: number;
  awayClubId: number;
  homeGoals: number;
  awayGoals: number;
  homeFormation: Match['homeFormation'];
  awayFormation: Match['awayFormation'];
  playedAt: Date;
}

export type MatchScoreRecord = Pick<
  MatchRecord,
  'homeClubId' | 'awayClubId' | 'homeGoals' | 'awayGoals'
>;

export interface MatchDuelRecord {
  id: number;
  matchId: number;
  order: number;
  attackingClubId: number;
  attackerId: number;
  defenderId: number;
  attackerName: string;
  defenderName: string;
  attackerPosition: MatchDuel['attackerPosition'];
  defenderPosition: MatchDuel['defenderPosition'];
  attackerCondition: MatchDuel['attackerCondition'];
  defenderCondition: MatchDuel['defenderCondition'];
  attackAttribute: MatchDuel['attackAttribute'];
  defenseAttribute: MatchDuel['defenseAttribute'];
  attackValue: number;
  defenseValue: number;
  goal: boolean;
}

export interface MatchWithDuelsRecord extends MatchRecord {
  duels: MatchDuelRecord[];
}

export interface MatchSummaryRecord extends MatchRecord {
  homeClubName: string;
  awayClubName: string;
}

export interface MatchDetailRecord extends MatchSummaryRecord {
  duels: MatchDuelRecord[];
}

interface RepositoryOptions {
  transaction?: Transaction;
}

function toMatchRecord(match: Match): MatchRecord {
  return {
    id: match.id,
    homeClubId: match.homeClubId,
    awayClubId: match.awayClubId,
    homeGoals: match.homeGoals,
    awayGoals: match.awayGoals,
    homeFormation: match.homeFormation,
    awayFormation: match.awayFormation,
    playedAt: match.playedAt,
  };
}

function toMatchSummaryRecord(match: Match): MatchSummaryRecord {
  if (!match.homeClub || !match.awayClub) {
    throw new Error('Clube de partida histórica não encontrado.');
  }
  return {
    ...toMatchRecord(match),
    homeClubName: match.homeClub.name,
    awayClubName: match.awayClub.name,
  };
}

function toDuelRecord(duel: MatchDuel): MatchDuelRecord {
  return {
    id: duel.id,
    matchId: duel.matchId,
    order: duel.order,
    attackingClubId: duel.attackingClubId,
    attackerId: duel.attackerId,
    defenderId: duel.defenderId,
    attackerName: duel.attackerName,
    defenderName: duel.defenderName,
    attackerPosition: duel.attackerPosition,
    defenderPosition: duel.defenderPosition,
    attackerCondition: duel.attackerCondition,
    defenderCondition: duel.defenderCondition,
    attackAttribute: duel.attackAttribute,
    defenseAttribute: duel.defenseAttribute,
    attackValue: duel.attackValue,
    defenseValue: duel.defenseValue,
    goal: duel.goal,
  };
}

export const matchRepository = {
  async listScores(
    options: RepositoryOptions = {},
  ): Promise<MatchScoreRecord[]> {
    return Match.findAll({
      attributes: ['homeClubId', 'awayClubId', 'homeGoals', 'awayGoals'],
      raw: true,
      transaction: options.transaction,
    });
  },

  async createWithDuels(
    data: MatchCreate,
    duels: MatchDuelCreate[],
    transaction: Transaction,
  ): Promise<MatchWithDuelsRecord> {
    const match = await Match.create(data, { transaction });
    const createdDuels = await MatchDuel.bulkCreate(
      duels.map((duel) => ({ ...duel, matchId: match.id })),
      { transaction },
    );
    return {
      ...toMatchRecord(match),
      duels: createdDuels.map(toDuelRecord).sort((a, b) => a.order - b.order),
    };
  },

  async findByIdWithDuels(
    id: number,
    options: RepositoryOptions = {},
  ): Promise<MatchDetailRecord | null> {
    const match = await Match.findByPk(id, {
      include: [
        { association: 'homeClub', attributes: ['name'] },
        { association: 'awayClub', attributes: ['name'] },
      ],
      transaction: options.transaction,
    });
    if (!match) return null;

    const duels = await MatchDuel.findAll({
      where: { matchId: id },
      order: [['order', 'ASC']],
      transaction: options.transaction,
    });
    return {
      ...toMatchSummaryRecord(match),
      duels: duels.map(toDuelRecord),
    };
  },

  async list(
    clubId?: number,
    options: RepositoryOptions = {},
  ): Promise<MatchSummaryRecord[]> {
    const matches = await Match.findAll({
      where:
        clubId === undefined
          ? undefined
          : { [Op.or]: [{ homeClubId: clubId }, { awayClubId: clubId }] },
      include: [
        { association: 'homeClub', attributes: ['name'] },
        { association: 'awayClub', attributes: ['name'] },
      ],
      order: [
        ['playedAt', 'DESC'],
        ['id', 'DESC'],
      ],
      transaction: options.transaction,
    });
    return matches.map(toMatchSummaryRecord);
  },
};
