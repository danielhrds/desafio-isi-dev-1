import { Transaction } from 'sequelize';
import { sequelize } from '../database/sequelize.js';
import { AppError } from '../errors/app.error.js';
import type { ClubRecord } from '../repositories/club.repository.js';
import { clubRepository } from '../repositories/club.repository.js';
import {
  lineupRepository,
  type MatchStarterRecord,
} from '../repositories/lineup.repository.js';
import { matchRepository } from '../repositories/match.repository.js';
import type { CreateMatchInput } from '../schemas/match.schema.js';
import { calculateMatchDuels } from './match-calculations.js';
import { detailedMatchResponse } from './match-response.js';

function completeStarters(
  club: ClubRecord,
  rows: MatchStarterRecord[],
): Array<MatchStarterRecord & { condition: 'APTO' | 'MAL_CONDICIONADO' }> {
  if (
    club.formation === null ||
    rows.length !== 5 ||
    rows[0].position !== 'GOL' ||
    rows.slice(1).some((row) => row.position === 'GOL') ||
    rows.some(
      (row) =>
        row.playerClubId !== club.id ||
        row.deletedAt !== null ||
        row.condition === 'DOENTE',
    )
  ) {
    throw new AppError(409, 'Clube sem escalação completa.');
  }
  return rows as Array<
    MatchStarterRecord & { condition: 'APTO' | 'MAL_CONDICIONADO' }
  >;
}

export const matchService = {
  async getMatchById(id: number) {
    const match = await matchRepository.findByIdWithDuels(id);
    if (!match) throw new AppError(404, 'Partida não encontrada.');

    const [homeClub, awayClub] = await Promise.all([
      clubRepository.findById(match.homeClubId),
      clubRepository.findById(match.awayClubId),
    ]);
    if (!homeClub || !awayClub) {
      throw new Error('Clube de partida histórica não encontrado.');
    }

    return detailedMatchResponse(match, homeClub, awayClub);
  },

  async playMatch(input: CreateMatchInput) {
    return sequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
      async (transaction) => {
        const lockedClubs = new Map<number, ClubRecord>();
        for (const id of [input.home_club_id, input.away_club_id].sort(
          (a, b) => a - b,
        )) {
          const club = await clubRepository.findById(id, {
            transaction,
            forUpdate: true,
          });
          if (!club) throw new AppError(404, 'Clube não encontrado.');
          lockedClubs.set(id, club);
        }

        const homeClub = lockedClubs.get(input.home_club_id)!;
        const awayClub = lockedClubs.get(input.away_club_id)!;
        const rows = await lineupRepository.listMatchStarters(
          homeClub.id,
          awayClub.id,
          transaction,
        );
        const home = completeStarters(
          homeClub,
          rows.filter((row) => row.clubId === homeClub.id),
        );
        const away = completeStarters(
          awayClub,
          rows.filter((row) => row.clubId === awayClub.id),
        );
        const duels = calculateMatchDuels(homeClub.id, home, awayClub.id, away);
        const match = await matchRepository.createWithDuels(
          {
            homeClubId: homeClub.id,
            awayClubId: awayClub.id,
            homeGoals: duels.slice(0, 3).filter((duel) => duel.goal).length,
            awayGoals: duels.slice(3).filter((duel) => duel.goal).length,
            homeFormation: homeClub.formation!,
            awayFormation: awayClub.formation!,
            playedAt: rows[0].snapshotAt,
          },
          duels,
          transaction,
        );
        return detailedMatchResponse(match, homeClub, awayClub);
      },
    );
  },
};
