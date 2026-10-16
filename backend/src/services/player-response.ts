import type { PlayerRecord } from '../repositories/player.repository.js';
import {
  calculateMarketValue,
  calculateOverall,
} from './player-calculations.js';

export function playerResponse(player: PlayerRecord, marketValue?: string) {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    agility: player.agility,
    age: player.age,
    condition: player.condition,
    base_value: Number(player.baseValue),
    market_value: Number(
      marketValue ??
        calculateMarketValue(
          player.baseValue,
          player.condition,
          player.agility,
          player.age,
        ),
    ),
    pace: player.pace,
    shooting: player.shooting,
    passing: player.passing,
    dribbling: player.dribbling,
    defending: player.defending,
    physical: player.physical,
    potential: player.potential,
    overall: calculateOverall(player.position, player),
    club_id: player.clubId,
  };
}
