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

export interface CreateClubInput {
  name: string;
  acronym: string;
}

export type ClubSort = 'name' | 'net_worth_asc' | 'net_worth_desc';
