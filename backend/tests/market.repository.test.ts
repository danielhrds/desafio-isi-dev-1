import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { QueryTypes, Sequelize } from 'sequelize';
import type { ClubCreate } from '../src/repositories/club.repository.js';
import type { PlayerCreate } from '../src/repositories/player.repository.js';
import type { TransactionCreate } from '../src/repositories/transaction.repository.js';

const execFileAsync = promisify(execFile);
const originalDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseName = `passe_test_${randomBytes(6).toString('hex')}`;
const purchaseTime = new Date('2026-11-02T13:15:00.000Z');
const saleTime = new Date('2026-11-05T19:40:00.000Z');
const loyaltyUntil = new Date('2027-03-02T13:15:00.000Z');

let adminDatabase: Sequelize;
let database: Sequelize;
let clubRepository: typeof import('../src/repositories/club.repository.js').clubRepository;
let playerRepository: typeof import('../src/repositories/player.repository.js').playerRepository;
let contractRepository: typeof import('../src/repositories/contract.repository.js').contractRepository;
let transactionRepository: typeof import('../src/repositories/transaction.repository.js').transactionRepository;

const aguias: ClubCreate = {
  name: 'Águias FC',
  normalizedName: 'águias fc',
  searchName: 'aguias fc',
  acronym: 'AGU',
};

const playerData: PlayerCreate = {
  name: 'Meia Lua',
  searchName: 'meia lua',
  position: 'MEI',
  agility: 85,
  age: 25,
  baseValue: '40.00',
  pace: 70,
  shooting: 68,
  passing: 82,
  dribbling: 79,
  defending: 55,
  physical: 64,
  potential: 86,
};

beforeAll(async () => {
  if (!originalDatabaseUrl) {
    throw new Error('DATABASE_URL é necessária para os testes de integração.');
  }

  const adminUrl = new URL(originalDatabaseUrl);
  adminUrl.pathname = '/postgres';
  adminDatabase = new Sequelize(adminUrl.toString(), { logging: false });
  await adminDatabase.query(`CREATE DATABASE "${testDatabaseName}"`);

  const testUrl = new URL(originalDatabaseUrl);
  testUrl.pathname = `/${testDatabaseName}`;
  process.env.DATABASE_URL = testUrl.toString();

  await execFileAsync('npm', ['run', 'db:migrate'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
  });

  ({ sequelize: database } = await import('../src/database/sequelize.js'));
  ({ clubRepository } = await import('../src/repositories/club.repository.js'));
  ({ playerRepository } =
    await import('../src/repositories/player.repository.js'));
  ({ contractRepository } =
    await import('../src/repositories/contract.repository.js'));
  ({ transactionRepository } =
    await import('../src/repositories/transaction.repository.js'));
}, 60_000);

afterEach(async () => {
  if (database) {
    await database.query(
      'TRUNCATE TABLE transacoes, contratos, jogadores, clubes RESTART IDENTITY CASCADE',
    );
  }
});

afterAll(async () => {
  if (database) await database.close();
  if (adminDatabase) {
    await adminDatabase.query(
      `DROP DATABASE IF EXISTS "${testDatabaseName}" WITH (FORCE)`,
    );
    await adminDatabase.close();
  }
  process.env.DATABASE_URL = originalDatabaseUrl;
});

async function createActors() {
  const club = await clubRepository.create(aguias);
  const player = await playerRepository.create(playerData);
  return { club, player };
}

function purchaseTransaction(
  clubId: number,
  playerId: number,
): TransactionCreate {
  return {
    clubId,
    playerId,
    playerName: 'Meia Lua',
    type: 'COMPRA',
    value: '37.00',
    fee: '1.85',
    penalty: '0.00',
    profit: null,
    cashChange: '-38.85',
    createdAt: purchaseTime,
  };
}

describe('B3/RN12/RN17: tabelas, models e repositories do mercado', () => {
  it('migra as colunas exigidas com PK, FKs, NUMERIC e timestamptz', async () => {
    const columns = await database.query<{
      table_name: string;
      column_name: string;
      data_type: string;
      numeric_precision: number | null;
      numeric_scale: number | null;
      is_nullable: string;
    }>(
      `SELECT table_name, column_name, data_type, numeric_precision,
              numeric_scale, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name IN ('contratos', 'transacoes')`,
      { type: QueryTypes.SELECT },
    );
    const names = (table: string) =>
      columns
        .filter((column) => column.table_name === table)
        .map((column) => column.column_name)
        .sort();

    expect(names('contratos')).toEqual(
      [
        'id',
        'jogador_id',
        'clube_id',
        'valor_compra',
        'fidelidade_ate',
        'situacao',
        'iniciado_em',
        'encerrado_em',
      ].sort(),
    );
    expect(names('transacoes')).toEqual(
      [
        'id',
        'clube_id',
        'jogador_id',
        'nome_jogador',
        'tipo',
        'valor',
        'taxa',
        'multa',
        'lucro',
        'variacao_caixa',
        'criado_em',
      ].sort(),
    );

    for (const [table, name, precision, scale] of [
      ['contratos', 'valor_compra', 6, 2],
      ['transacoes', 'valor', 6, 2],
      ['transacoes', 'taxa', 6, 2],
      ['transacoes', 'multa', 6, 2],
      ['transacoes', 'lucro', 7, 2],
      ['transacoes', 'variacao_caixa', 8, 2],
    ] as const) {
      expect(
        columns.find(
          (column) =>
            column.table_name === table && column.column_name === name,
        ),
      ).toMatchObject({
        data_type: 'numeric',
        numeric_precision: precision,
        numeric_scale: scale,
      });
    }
    for (const name of ['fidelidade_ate', 'iniciado_em', 'encerrado_em']) {
      expect(
        columns.find(
          (column) =>
            column.table_name === 'contratos' && column.column_name === name,
        )?.data_type,
      ).toBe('timestamp with time zone');
    }
    expect(
      columns.find(
        (column) =>
          column.table_name === 'transacoes' &&
          column.column_name === 'criado_em',
      )?.data_type,
    ).toBe('timestamp with time zone');
    for (const [table, name] of [
      ['contratos', 'encerrado_em'],
      ['transacoes', 'lucro'],
    ]) {
      expect(
        columns.find(
          (column) =>
            column.table_name === table && column.column_name === name,
        )?.is_nullable,
      ).toBe('YES');
    }

    const constraints = await database.query<{
      table_name: string;
      type: string;
      definition: string;
    }>(
      `SELECT c.conrelid::regclass::text AS table_name, c.contype AS type,
              pg_get_constraintdef(c.oid) AS definition
       FROM pg_constraint c
       WHERE c.conrelid IN ('contratos'::regclass, 'transacoes'::regclass)`,
      { type: QueryTypes.SELECT },
    );
    for (const table of ['contratos', 'transacoes']) {
      expect(constraints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            table_name: table,
            type: 'p',
            definition: 'PRIMARY KEY (id)',
          }),
          expect.objectContaining({
            table_name: table,
            type: 'f',
            definition: expect.stringContaining(
              'FOREIGN KEY (jogador_id) REFERENCES jogadores(id)',
            ),
          }),
          expect.objectContaining({
            table_name: table,
            type: 'f',
            definition: expect.stringContaining(
              'FOREIGN KEY (clube_id) REFERENCES clubes(id)',
            ),
          }),
        ]),
      );
    }
  });

  it('guarda contrato ativo com valor decimal e instantes exatos, depois o encerra', async () => {
    const { club, player } = await createActors();
    const created = await contractRepository.create({
      clubId: club.id,
      playerId: player.id,
      purchaseValue: '37.00',
      loyaltyUntil,
      status: 'ATIVO',
      startedAt: purchaseTime,
    });

    expect(created).toEqual({
      id: 1,
      clubId: club.id,
      playerId: player.id,
      purchaseValue: '37.00',
      loyaltyUntil,
      status: 'ATIVO',
      startedAt: purchaseTime,
      endedAt: null,
    });
    expect(await contractRepository.findActiveByPlayerId(player.id)).toEqual(
      created,
    );
    expect(await contractRepository.listActiveByClubId(club.id)).toEqual([
      created,
    ]);
    expect(await contractRepository.findActiveByPlayerId(999)).toBeNull();
    expect(
      await contractRepository.close(created.id, 'RESCINDIDO', saleTime),
    ).toBe(true);
    expect(
      await contractRepository.close(created.id, 'ENCERRADO', saleTime),
    ).toBe(false);
    expect(await contractRepository.findActiveByPlayerId(player.id)).toBeNull();
    expect(await contractRepository.listActiveByClubId(club.id)).toEqual([]);

    const rows = await database.query<{
      situacao: string;
      valor_compra: string;
      encerrado_em: Date;
    }>('SELECT situacao, valor_compra, encerrado_em FROM contratos', {
      type: QueryTypes.SELECT,
    });
    expect(rows).toEqual([
      {
        situacao: 'RESCINDIDO',
        valor_compra: '37.00',
        encerrado_em: saleTime,
      },
    ]);
  });

  it('restringe FKs e dois contratos ATIVO simultâneos para o mesmo jogador', async () => {
    const { club, player } = await createActors();
    const otherPlayer = await playerRepository.create({
      ...playerData,
      name: 'Zeca Lima',
      searchName: 'zeca lima',
    });
    const first = await contractRepository.create({
      clubId: club.id,
      playerId: player.id,
      purchaseValue: '37.00',
      loyaltyUntil,
      status: 'ATIVO',
      startedAt: purchaseTime,
    });
    await expect(
      contractRepository.create({
        clubId: club.id,
        playerId: player.id,
        purchaseValue: '40.00',
        loyaltyUntil,
        status: 'ATIVO',
        startedAt: saleTime,
      }),
    ).rejects.toMatchObject({ parent: { code: '23505' } });
    await expect(
      contractRepository.create({
        clubId: 999,
        playerId: otherPlayer.id,
        purchaseValue: '40.00',
        loyaltyUntil,
        status: 'ATIVO',
        startedAt: saleTime,
      }),
    ).rejects.toMatchObject({ parent: { code: '23503' } });
    expect(
      await contractRepository.close(first.id, 'ENCERRADO', saleTime),
    ).toBe(true);
    const second = await contractRepository.create({
      clubId: club.id,
      playerId: player.id,
      purchaseValue: '40.00',
      loyaltyUntil,
      status: 'ATIVO',
      startedAt: saleTime,
    });
    expect(second.status).toBe('ATIVO');
    expect(second.id).not.toBe(first.id);
    expect(await contractRepository.findActiveByPlayerId(player.id)).toEqual(
      second,
    );
  });

  it('lista snapshots por clube, tipo e jogador, com data e id decrescentes', async () => {
    const { club, player } = await createActors();
    const otherClub = await clubRepository.create({
      name: 'Delta FC',
      normalizedName: 'delta fc',
      searchName: 'delta fc',
      acronym: 'DFC',
    });
    const otherPlayer = await playerRepository.create({
      ...playerData,
      name: 'Zeca Lima',
      searchName: 'zeca lima',
    });
    const buy = await transactionRepository.create(
      purchaseTransaction(club.id, player.id),
    );
    const sale = await transactionRepository.create({
      ...purchaseTransaction(club.id, player.id),
      playerName: 'Meia Zeta',
      type: 'VENDA',
      value: '40.00',
      fee: '0.30',
      penalty: '4.00',
      profit: '3.00',
      cashChange: '35.70',
      createdAt: saleTime,
    });
    const sameTime = await transactionRepository.create({
      ...purchaseTransaction(club.id, otherPlayer.id),
      createdAt: saleTime,
    });
    await transactionRepository.create(
      purchaseTransaction(otherClub.id, player.id),
    );

    expect(await transactionRepository.listByClubId(club.id)).toEqual([
      sameTime,
      sale,
      buy,
    ]);
    expect(
      (
        await transactionRepository.listByClubId(club.id, {
          types: ['VENDA'],
        })
      ).map((row) => row.id),
    ).toEqual([sale.id]);
    expect(
      (
        await transactionRepository.listByClubId(club.id, {
          types: ['VENDA', 'COMPRA'],
          playerId: player.id,
        })
      ).map((row) => row.id),
    ).toEqual([sale.id, buy.id]);
    expect(
      await transactionRepository.listByClubId(club.id, {
        playerId: 999,
      }),
    ).toEqual([]);
    expect(
      await transactionRepository.hasSaleByClubAndPlayer(club.id, player.id),
    ).toBe(true);
    expect(
      await transactionRepository.hasSaleByClubAndPlayer(
        otherClub.id,
        player.id,
      ),
    ).toBe(false);

    const rows = await database.query<{
      nome_jogador: string;
      lucro: string | null;
      variacao_caixa: string;
    }>(
      'SELECT nome_jogador, lucro, variacao_caixa FROM transacoes WHERE id IN (:ids) ORDER BY id',
      { type: QueryTypes.SELECT, replacements: { ids: [buy.id, sale.id] } },
    );
    expect(rows).toEqual([
      { nome_jogador: 'Meia Lua', lucro: null, variacao_caixa: '-38.85' },
      { nome_jogador: 'Meia Zeta', lucro: '3.00', variacao_caixa: '35.70' },
    ]);
  });

  it('mantém histórico após exclusão lógica do jogador', async () => {
    const { club, player } = await createActors();
    const buy = await transactionRepository.create(
      purchaseTransaction(club.id, player.id),
    );
    expect(await playerRepository.softDelete(player.id)).toBe(true);
    expect(await playerRepository.findActiveById(player.id)).toBeNull();
    expect(await transactionRepository.listByClubId(club.id)).toEqual([buy]);
  });

  it('propaga a transação do service e desfaz contrato e histórico juntos', async () => {
    const { club, player } = await createActors();
    const transaction = await database.transaction();
    try {
      const contract = await contractRepository.create(
        {
          clubId: club.id,
          playerId: player.id,
          purchaseValue: '37.00',
          loyaltyUntil,
          status: 'ATIVO',
          startedAt: purchaseTime,
        },
        { transaction },
      );
      const entry = await transactionRepository.create(
        purchaseTransaction(club.id, player.id),
        { transaction },
      );
      expect(
        await contractRepository.findActiveByPlayerId(player.id, {
          transaction,
          forUpdate: true,
        }),
      ).toEqual(contract);
      expect(
        await transactionRepository.listByClubId(club.id, {}, { transaction }),
      ).toEqual([entry]);
    } finally {
      await transaction.rollback();
    }
    expect(await contractRepository.findActiveByPlayerId(player.id)).toBeNull();
    expect(await transactionRepository.listByClubId(club.id)).toEqual([]);
  });
});
