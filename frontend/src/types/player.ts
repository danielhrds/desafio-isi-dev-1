export type PlayerPosition = 'GOL' | 'ZAG' | 'LAT' | 'MEI' | 'ATA';

export type PlayerCondition = 'APTO' | 'MAL_CONDICIONADO' | 'DOENTE';

export type PlayerSort =
  'name' | 'value_asc' | 'value_desc' | 'age_asc' | 'age_desc' | 'position';

export interface PlayerListFilters {
  search?: string;
  position?: PlayerPosition;
  condition?: PlayerCondition;
  free?: boolean;
  club_id?: number;
  min_age?: number;
  max_age?: number;
  min_value?: number;
  max_value?: number;
  sort?: PlayerSort;
}

export interface PlayerListItem {
  id: number;
  name: string;
  position: PlayerPosition;
  overall: number;
  agility: number;
  age: number;
  condition: PlayerCondition;
  base_value: number;
  market_value: number;
  club_id: number | null;
}

export interface CreatePlayerInput {
  name: string;
  position: PlayerPosition;
  agility: number;
  age: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  potential: number;
}

export interface PlayerDetail extends PlayerListItem {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  potential: number;
}

export interface PlayerListMeta {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
}

export interface PlayerListResponse {
  data: PlayerListItem[];
  meta: PlayerListMeta;
}
