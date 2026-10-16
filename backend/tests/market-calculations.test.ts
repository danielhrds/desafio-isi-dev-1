import { AppError } from '../src/errors/app.error.js';
import {
  calculateRemainingDaysAndPenaltyRate,
  calculatePurchaseFee,
  validateLoyaltyPeriod,
} from '../src/services/market-calculations.js';
import {
  formatBrasiliaDateTime,
  isBrasiliaDateTime,
} from '../src/validation/brasilia-datetime.js';

describe('RN13: taxa de compra em moeda', () => {
  it.each([
    ['1.00', '0.00'],
    ['28.00', '0.00'],
    ['30.00', '0.00'],
    ['30.01', '1.50'],
    ['47.62', '2.38'],
    ['124.36', '6.22'],
    ['30.10', '1.51'],
  ])('%s → taxa %s', (marketValue, expected) => {
    expect(calculatePurchaseFee(marketValue)).toBe(expected);
  });
});

describe('RN15: dias restantes e percentual de multa', () => {
  const now = new Date('2026-11-02T13:15:00.000Z');
  const day = 86_400_000;

  it.each([
    ['fidelidade vencida', -1, 0, 0],
    ['fim neste instante', 0, 0, 0],
    ['um milissegundo restante', 1, 1, 5],
    ['dez dias e duas horas', 10 * day + 2 * 3_600_000, 11, 5],
    ['trinta dias exatos', 30 * day, 30, 5],
    ['trinta dias e um milissegundo', 30 * day + 1, 31, 10],
    ['cento e oitenta dias exatos', 180 * day, 180, 10],
    ['cento e oitenta dias e um milissegundo', 180 * day + 1, 181, 20],
  ])('%s → %i dias e %i%%', (_label, offset, remainingDays, penaltyRate) => {
    const loyaltyUntil = new Date(now.getTime() + offset);
    expect(calculateRemainingDaysAndPenaltyRate(loyaltyUntil, now)).toEqual({
      remainingDays,
      penaltyRate,
    });
  });
});

describe('RN01: data e limite da fidelidade', () => {
  it.each(['2028-02-29T10:15-03:00', '2027-03-02T00:00-03:00'])(
    'aceita %s',
    (value) => {
      expect(isBrasiliaDateTime(value)).toBe(true);
    },
  );

  it.each([
    '2027-02-29T10:15-03:00',
    '2027-02-30T10:15-03:00',
    '2027-03-02T24:00-03:00',
    '2027-03-02T10:60-03:00',
    '2027-03-02T10:15:00-03:00',
    '2027-03-02T10:15Z',
    '2027-03-02T10:15-02:00',
    '2027-03-02T10:15',
  ])('recusa %s', (value) => {
    expect(isBrasiliaDateTime(value)).toBe(false);
  });

  it('compara instantes exatos: futuro, 1.095 dias e 1 ms além', () => {
    const now = new Date('2026-11-02T13:15:00.000Z');
    const limit = now.getTime() + 1_095 * 86_400_000;

    expect(() => validateLoyaltyPeriod(new Date(now.getTime()), now)).toThrow(
      AppError,
    );
    expect(() =>
      validateLoyaltyPeriod(new Date(now.getTime() - 1), now),
    ).toThrow(AppError);
    expect(() =>
      validateLoyaltyPeriod(new Date(now.getTime() + 1), now),
    ).not.toThrow();
    expect(() => validateLoyaltyPeriod(new Date(limit), now)).not.toThrow();
    expect(() => validateLoyaltyPeriod(new Date(limit + 1), now)).toThrow(
      AppError,
    );
  });

  it('formata instantes no offset fixo -03:00', () => {
    expect(formatBrasiliaDateTime(new Date('2026-11-02T13:15:00.000Z'))).toBe(
      '2026-11-02T10:15:00-03:00',
    );
  });
});
