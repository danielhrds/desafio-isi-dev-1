import { Transaction } from 'sequelize';
import { sequelize } from '../database/sequelize.js';
import { clubRepository } from '../repositories/club.repository.js';
import { matchRepository } from '../repositories/match.repository.js';

interface ClubStanding {
  clubId: number;
  clubName: string;
  alphabeticalOrder: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

function points(standing: ClubStanding): number {
  return standing.wins * 3 + standing.draws;
}

function goalDifference(standing: ClubStanding): number {
  return standing.goalsFor - standing.goalsAgainst;
}

export const standingsService = {
  async getStandings() {
    const { clubs, scores } = await sequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
      async (transaction) => {
        const clubs = await clubRepository.listNames({ transaction });
        return {
          clubs,
          scores:
            clubs.length === 0
              ? []
              : await matchRepository.listScores({ transaction }),
        };
      },
    );

    const standings = clubs.map((club, alphabeticalOrder): ClubStanding => ({
      clubId: club.id,
      clubName: club.name,
      alphabeticalOrder,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    }));
    const byClubId = new Map(
      standings.map((standing) => [standing.clubId, standing]),
    );

    for (const score of scores) {
      const home = byClubId.get(score.homeClubId);
      const away = byClubId.get(score.awayClubId);
      if (!home || !away) {
        throw new Error('Clube de partida histórica não encontrado.');
      }

      home.played++;
      away.played++;
      home.goalsFor += score.homeGoals;
      home.goalsAgainst += score.awayGoals;
      away.goalsFor += score.awayGoals;
      away.goalsAgainst += score.homeGoals;

      if (score.homeGoals > score.awayGoals) {
        home.wins++;
        away.losses++;
      } else if (score.homeGoals < score.awayGoals) {
        away.wins++;
        home.losses++;
      } else {
        home.draws++;
        away.draws++;
      }
    }

    standings.sort(
      (left, right) =>
        points(right) - points(left) ||
        goalDifference(right) - goalDifference(left) ||
        right.goalsFor - left.goalsFor ||
        left.alphabeticalOrder - right.alphabeticalOrder,
    );

    return standings.map((standing, index) => ({
      position: index + 1,
      club_id: standing.clubId,
      club_name: standing.clubName,
      played: standing.played,
      wins: standing.wins,
      draws: standing.draws,
      losses: standing.losses,
      goals_for: standing.goalsFor,
      goals_against: standing.goalsAgainst,
      goal_difference: goalDifference(standing),
      points: points(standing),
    }));
  },
};
