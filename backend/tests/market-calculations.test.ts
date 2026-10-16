import { AppError } from '../src/errors/app.error.js';
import {
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
