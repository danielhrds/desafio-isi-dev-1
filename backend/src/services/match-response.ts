import type {
  MatchRecord,
  MatchWithDuelsRecord,
} from '../repositories/match.repository.js';
import { formatBrasiliaDateTime } from '../validation/brasilia-datetime.js';

export function matchSummaryResponse(
  match: MatchRecord,
  homeClubName: string,
  awayClubName: string,
) {
  return {
    id: match.id,
    played_at: formatBrasiliaDateTime(match.playedAt),
    home: {
      club_id: match.homeClubId,
      club_name: homeClubName,
      formation: match.homeFormation,
      goals: match.homeGoals,
    },
    away: {
      club_id: match.awayClubId,
      club_name: awayClubName,
      formation: match.awayFormation,
      goals: match.awayGoals,
    },
    result:
      match.homeGoals > match.awayGoals
        ? 'MANDANTE'
        : match.homeGoals < match.awayGoals
          ? 'VISITANTE'
          : 'EMPATE',
  };
}

export function detailedMatchResponse(
  match: MatchWithDuelsRecord,
  homeClubName: string,
  awayClubName: string,
) {
  return {
    ...matchSummaryResponse(match, homeClubName, awayClubName),
    duels: match.duels.map((duel) => ({
      order: duel.order,
      attacking_club_id: duel.attackingClubId,
      attacker: {
        player_id: duel.attackerId,
        player_name: duel.attackerName,
        position: duel.attackerPosition,
        condition: duel.attackerCondition,
        attribute: duel.attackAttribute,
        value: duel.attackValue,
      },
      defender: {
        player_id: duel.defenderId,
        player_name: duel.defenderName,
        position: duel.defenderPosition,
        condition: duel.defenderCondition,
        attribute: duel.defenseAttribute,
        value: duel.defenseValue,
      },
      goal: duel.goal,
    })),
  };
}
