import type { MatchDuelCreate } from '../repositories/match.repository.js';
import type { MatchStarterRecord } from '../repositories/lineup.repository.js';
import type { AttackAttribute } from '../models/match-duel.model.js';

type Starter = Omit<
  MatchStarterRecord,
  'clubId' | 'playerClubId' | 'deletedAt' | 'snapshotAt'
> & {
  condition: 'APTO' | 'MAL_CONDICIONADO';
};

function effectiveValue(
  value: number,
  condition: Starter['condition'],
): number {
  return condition === 'MAL_CONDICIONADO'
    ? Math.floor((value * 85 + 50) / 100)
    : value;
}

function attackAttribute(position: Starter['position']): AttackAttribute {
  switch (position) {
    case 'ATA':
      return 'shooting';
    case 'MEI':
      return 'passing';
    case 'ZAG':
    case 'LAT':
      return 'dribbling';
    case 'GOL':
      throw new Error('Goleiro não pode atacar.');
  }
}

export function calculateMatchDuels(
  homeClubId: number,
  home: Starter[],
  awayClubId: number,
  away: Starter[],
): MatchDuelCreate[] {
  const duels: MatchDuelCreate[] = [];
  const pairings = [
    { attacker: 4, defender: 0 },
    { attacker: 3, defender: 1 },
    { attacker: 2, defender: 2 },
  ];

  for (const [attackingClubId, attackers, defenders] of [
    [homeClubId, home, away],
    [awayClubId, away, home],
  ] as const) {
    for (const pairing of pairings) {
      const attacker = attackers[pairing.attacker];
      const defender = defenders[pairing.defender];
      const attribute = attackAttribute(attacker.position);
      const attackValue = effectiveValue(
        attacker[attribute],
        attacker.condition,
      );
      const defenseValue = effectiveValue(
        defender.defending,
        defender.condition,
      );

      duels.push({
        order: duels.length + 1,
        attackingClubId,
        attackerId: attacker.id,
        defenderId: defender.id,
        attackerName: attacker.name,
        defenderName: defender.name,
        attackerPosition: attacker.position,
        defenderPosition: defender.position,
        attackerCondition: attacker.condition,
        defenderCondition: defender.condition,
        attackAttribute: attribute,
        defenseAttribute: 'defending',
        attackValue,
        defenseValue,
        goal: attackValue > defenseValue,
      });
    }
  }
  return duels;
}
