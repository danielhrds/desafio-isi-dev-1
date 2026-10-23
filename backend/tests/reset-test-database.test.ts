import type { Sequelize } from 'sequelize';
import { expect, it, vi } from 'vitest';
import { resetTestDatabase } from './helpers/reset-test-database.js';

it.each(['passe', 'passe_test_development'])(
  'recusa limpar o banco %s antes de abrir uma transação',
  async (databaseName) => {
    const transaction = vi.fn();
    const database = {
      getDatabaseName: () => databaseName,
      transaction,
    } as unknown as Sequelize;

    await expect(resetTestDatabase(database)).rejects.toThrow(
      'A limpeza é permitida somente nos bancos temporários dos testes.',
    );
    expect(transaction).not.toHaveBeenCalled();
  },
);
