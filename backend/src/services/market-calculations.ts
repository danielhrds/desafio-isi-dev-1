import { Decimal } from 'decimal.js';
import { AppError } from '../errors/app.error.js';

const loyaltyLimitMilliseconds = 1_095 * 24 * 60 * 60 * 1_000;
const dayMilliseconds = 24 * 60 * 60 * 1_000;

export function calculateRemainingDaysAndPenaltyRate(
  loyaltyUntil: Date,
  now: Date,
): { remainingDays: number; penaltyRate: number } {
  const remainingDays = Math.max(
    0,
    Math.ceil((loyaltyUntil.getTime() - now.getTime()) / dayMilliseconds),
  );
  const penaltyRate =
    remainingDays === 0
      ? 0
      : remainingDays <= 30
        ? 5
        : remainingDays <= 180
          ? 10
          : 20;
  return { remainingDays, penaltyRate };
}

export function validateLoyaltyPeriod(loyaltyUntil: Date, now: Date): void {
  const difference = loyaltyUntil.getTime() - now.getTime();
  if (difference <= 0 || difference > loyaltyLimitMilliseconds) {
    throw new AppError(400, 'Fim da fidelidade fora do período permitido.');
  }
}

export function calculatePurchaseFee(marketValue: string): string {
  const value = new Decimal(marketValue);
  return value.gt(30)
    ? value.mul('0.05').toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
    : '0.00';
}

export function calculateSalePenalty(
  marketValue: string,
  penaltyRate: number,
): string {
  return Decimal.min(
    new Decimal(marketValue)
      .mul(penaltyRate)
      .div(100)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    new Decimal(10),
  ).toFixed(2);
}

export function calculateSaleCommission(profit: string): string {
  const amount = new Decimal(profit);
  if (amount.lte(0)) return '0.00';
  return Decimal.min(amount, new Decimal(10))
    .mul('0.10')
    .plus(Decimal.max(amount.minus(10), new Decimal(0)).mul('0.20'))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
}
