export type PlayerPosition = 'GOL' | 'ZAG' | 'LAT' | 'MEI' | 'ATA';

export type PlayerCondition = 'APTO' | 'MAL_CONDICIONADO' | 'DOENTE';

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
