import type { PlayerDetail } from './player.js';

export interface ClubListItem {
  id: number;
  name: string;
  acronym: string;
}

export interface ClubSummary extends ClubListItem {
  cash: number;
  squad_value: number;
  net_worth: number;
}

export interface ClubContract {
  purchase_value: number;
  loyalty_until: string;
  remaining_days: number;
  penalty_rate: number;
}

export interface ClubRosterPlayer extends Omit<PlayerDetail, 'club_id'> {
  club_id: number;
  contract: ClubContract;
}

export interface ClubDetail extends ClubSummary {
  players: ClubRosterPlayer[];
}

export const clubFormations = ['3-1', '2-2', '2-1-1', '1-2-1'] as const;

export type ClubFormation = (typeof clubFormations)[number];

export interface ClubLineup {
  club_id: number;
  formation: ClubFormation | null;
  complete: boolean;
  players: PlayerDetail[];
}

export interface SaveClubLineupInput {
  formation: ClubFormation;
  player_ids: number[];
}

export interface CreateClubInput {
  name: string;
  acronym: string;
}

export type ClubSort = 'name' | 'net_worth_asc' | 'net_worth_desc';
