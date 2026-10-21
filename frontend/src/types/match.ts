import type { ClubFormation } from './club.js';
import type { PlayerCondition, PlayerPosition } from './player.js';

export type MatchResult = 'MANDANTE' | 'VISITANTE' | 'EMPATE';
export type MatchAttackAttribute = 'shooting' | 'passing' | 'dribbling';

export interface MatchClubScore {
  club_id: number;
  club_name: string;
  formation: ClubFormation;
  goals: number;
}

export interface MatchSummary {
  id: number;
  played_at: string;
  home: MatchClubScore;
  away: MatchClubScore;
  result: MatchResult;
}

export interface MatchDuelPlayer {
  player_id: number;
  player_name: string;
  position: PlayerPosition;
  condition: Exclude<PlayerCondition, 'DOENTE'>;
  attribute: MatchAttackAttribute | 'defending';
  value: number;
}

export interface MatchDuel {
  order: number;
  attacking_club_id: number;
  attacker: MatchDuelPlayer;
  defender: MatchDuelPlayer;
  goal: boolean;
}

export interface MatchDetail extends MatchSummary {
  duels: MatchDuel[];
}
