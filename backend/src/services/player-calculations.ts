import { Decimal } from 'decimal.js';
import type {
  PlayerCondition,
  PlayerPosition,
} from '../models/player.model.js';

export interface PlayerAttributes {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

const weights: Record<PlayerPosition, PlayerAttributes> = {
  GOL: {
    pace: 10,
    shooting: 0,
    passing: 20,
    dribbling: 0,
    defending: 40,
    physical: 30,
  },
  ZAG: {
    pace: 10,
    shooting: 0,
    passing: 15,
    dribbling: 0,
    defending: 45,
    physical: 30,
  },
  LAT: {
    pace: 25,
    shooting: 0,
    passing: 20,
    dribbling: 15,
    defending: 25,
    physical: 15,
  },
  MEI: {
    pace: 10,
    shooting: 15,
    passing: 35,
    dribbling: 25,
    defending: 5,
    physical: 10,
  },
  ATA: {
    pace: 20,
    shooting: 40,
    passing: 10,
    dribbling: 20,
    defending: 0,
    physical: 10,
  },
};

export function calculateOverall(
  position: PlayerPosition,
  attributes: PlayerAttributes,
): number {
  const weight = weights[position];
  const weightedSum =
    attributes.pace * weight.pace +
    attributes.shooting * weight.shooting +
    attributes.passing * weight.passing +
    attributes.dribbling * weight.dribbling +
    attributes.defending * weight.defending +
    attributes.physical * weight.physical;

  return Math.round(weightedSum / 100);
}

export function calculateBaseValue(
  overall: number,
  potential: number,
  registrationAge: number,
): string {
  let value = new Decimal(Math.max(0, Math.min(overall, 60) - 40))
    .mul('0.50')
    .plus(new Decimal(Math.max(0, Math.min(overall, 75) - 60)).mul(2))
    .plus(new Decimal(Math.max(0, overall - 75)).mul(6));

  if (registrationAge <= 21) {
    value = value.mul(new Decimal(100 + potential - overall).div(100));
  }

  return Decimal.max(
    1,
    value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
  ).toFixed(2);
}

export function calculateMarketValue(
  baseValue: string,
  condition: PlayerCondition,
  agility: number,
  age: number,
): string {
  let conditionDiscount = new Decimal(
    condition === 'APTO' ? 0 : condition === 'MAL_CONDICIONADO' ? 15 : 30,
  );

  if (condition !== 'APTO') {
    if (agility >= 80) conditionDiscount = conditionDiscount.div(2);
    else if (agility <= 30) conditionDiscount = conditionDiscount.plus(10);
  }

  const ageAdjustment = age <= 21 ? 10 : age >= 32 ? -10 : 0;
  const percentage = Decimal.max(
    -40,
    new Decimal(ageAdjustment).minus(conditionDiscount),
  );
  const value = new Decimal(baseValue)
    .mul(new Decimal(100).plus(percentage))
    .div(100);
  return Decimal.max(
    1,
    value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
  ).toFixed(2);
}
