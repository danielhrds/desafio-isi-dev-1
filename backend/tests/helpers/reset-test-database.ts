import type { Sequelize } from 'sequelize';

export async function resetTestDatabase(database: Sequelize): Promise<void> {
  if (!/^passe_test_[a-f0-9]{12}$/.test(database.getDatabaseName())) {
    throw new Error(
      'A limpeza é permitida somente nos bancos temporários dos testes.',
    );
  }

  await database.transaction(async (transaction) => {
    await database.query(
      `DELETE FROM duelos_partida;
       DELETE FROM partidas;
       DELETE FROM escalacoes;
       DELETE FROM transacoes;
       DELETE FROM contratos;
       DELETE FROM jogadores;
       DELETE FROM clubes;
       SELECT setval(pg_get_serial_sequence(table_name, 'id'), 1, false)
       FROM unnest(ARRAY['duelos_partida', 'partidas', 'transacoes', 'contratos', 'jogadores', 'clubes']) AS reset_tables(table_name);`,
      { transaction },
    );
  });
}
