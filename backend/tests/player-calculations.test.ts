import {
  calculateBaseValue,
  calculateMarketValue,
  calculateOverall,
} from '../src/services/player-calculations.js';

describe('RN06: overall por posição', () => {
  it.each([
    ['MEI', [68, 65, 80, 78, 52, 60], 73],
    ['ATA', [78, 75, 73, 82, 48, 68], 76],
    ['LAT', [72, 70, 78, 76, 70, 66], 72],
    ['ZAG', [50, 90, 60, 40, 80, 75], 73],
    ['GOL', [55, 30, 65, 40, 72, 68], 68],
  ] as const)(
    '%s usa os pesos da sua posição',
    (position, values, expected) => {
      expect(
        calculateOverall(position, {
          pace: values[0],
          shooting: values[1],
          passing: values[2],
          dribbling: values[3],
          defending: values[4],
          physical: values[5],
        }),
      ).toBe(expected);
    },
  );
});

describe('RN06: valor base progressivo e arredondamento final', () => {
  it.each([
    [40, 66, 36, '1.00'],
    [45, 90, 18, '3.63'],
    [60, 70, 30, '10.00'],
    [61, 70, 30, '12.00'],
    [70, 84, 21, '34.20'],
    [70, 84, 22, '30.00'],
    [75, 86, 25, '40.00'],
    [76, 80, 22, '46.00'],
    [85, 92, 27, '100.00'],
  ])(
    'overall %i, potencial %i, idade %i → %s',
    (overall, potential, age, expected) => {
      expect(calculateBaseValue(overall, potential, age)).toBe(expected);
    },
  );
});

describe('RN02–RN05: valor de mercado', () => {
  it.each([
    ['82.00', 'APTO', 20, 25, '82.00'],
    ['82.00', 'APTO', 50, 19, '90.20'],
    ['82.00', 'MAL_CONDICIONADO', 50, 25, '69.70'],
    ['82.00', 'MAL_CONDICIONADO', 80, 21, '84.05'],
    ['82.00', 'MAL_CONDICIONADO', 30, 33, '53.30'],
    ['82.00', 'DOENTE', 90, 25, '69.70'],
    ['82.00', 'DOENTE', 30, 25, '49.20'],
    ['82.00', 'DOENTE', 10, 40, '49.20'],
    ['9.50', 'MAL_CONDICIONADO', 85, 25, '8.79'],
    ['1.00', 'MAL_CONDICIONADO', 50, 35, '1.00'],
  ] as const)(
    '%s, %s, agilidade %i, idade %i → %s',
    (base, condition, agility, age, expected) => {
      expect(calculateMarketValue(base, condition, agility, age)).toBe(
        expected,
      );
    },
  );
});
