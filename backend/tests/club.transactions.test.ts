import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import type { Express } from 'express';
import { DateTime } from 'luxon';
import { QueryTypes, Sequelize } from 'sequelize';
import request from 'supertest';
import type { TransactionCreate } from '../src/repositories/transaction.repository.js';
import { resetTestDatabase } from './helpers/reset-test-database.js';

const execFileAsync = promisify(execFile);
const originalDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseName = `passe_test_${randomBytes(6).toString('hex')}`;
const zeroSummary = {
  total_spent: 0,
  total_received: 0,
  total_fees: 0,
  total_penalties: 0,
  total_profit: 0,
};

const playerBody = {
  name: 'Meia Lua',
  position: 'MEI',
  agility: 85,
  age: 25,
  pace: 70,
  shooting: 68,
  passing: 82,
  dribbling: 79,
  defending: 55,
  physical: 64,
  potential: 86,
};

let adminDatabase: Sequelize;
let database: Sequelize;
let app: Express;
let transactionRepository: typeof import('../src/repositories/transaction.repository.js').transactionRepository;

function futureDate(days = 120): string {
  return DateTime.utc()
    .plus({ days })
    .setZone('UTC-3')
    .toFormat("yyyy-MM-dd'T'HH:mmZZ");
}

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
  ({ app } = await import('../src/app.js'));
  ({ transactionRepository } =
    await import('../src/repositories/transaction.repository.js'));
}, 60_000);

afterEach(async () => {
  if (database) {
    await resetTestDatabase(database);
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

async function createClub(name = 'Águias FC', acronym = 'AGU') {
  const response = await request(app)
    .post('/api/v1/clubs')
    .send({ name, acronym });
  expect(response.status).toBe(201);
  return response.body.id as number;
}

async function createPlayer(name = 'Meia Lua') {
  const response = await request(app)
    .post('/api/v1/players')
    .send({ ...playerBody, name });
  expect(response.status).toBe(201);
  return response.body.id as number;
}

async function buyPlayer(playerId: number, clubId: number) {
  const response = await request(app)
    .post(`/api/v1/players/${playerId}/buy`)
    .send({ club_id: clubId, loyalty_until: futureDate() });
  expect(response.status).toBe(200);
  return response.body as { id: number; created_at: string };
}

function listTransactions(clubId: number, query?: Record<string, string>) {
  const call = request(app).get(`/api/v1/clubs/${clubId}/transactions`);
  return query ? call.query(query) : call;
}

async function countRecords() {
  const rows = await database.query<{
    transaction_count: string;
    contract_count: string;
    club_cash: string;
  }>(
    `SELECT (SELECT COUNT(*) FROM transacoes) AS transaction_count,
            (SELECT COUNT(*) FROM contratos) AS contract_count,
            (SELECT COALESCE(SUM(caixa), 0) FROM clubes) AS club_cash`,
    { type: QueryTypes.SELECT },
  );
  return rows[0];
}

async function createHistoryWithSales() {
  const clubId = await createClub();
  const otherClubId = await createClub('Delta FC', 'DEL');
  const firstPlayerId = await createPlayer();
  const secondPlayerId = await createPlayer('Lino Matos');
  const otherPlayerId = await createPlayer('Davi Lins');
  const firstPurchase = await buyPlayer(firstPlayerId, clubId);
  const secondPurchase = await buyPlayer(secondPlayerId, clubId);
  await buyPlayer(otherPlayerId, otherClubId);

  const saleTime = new Date(Date.now() + 60_000);
  const firstSale: TransactionCreate = {
    clubId,
    playerId: firstPlayerId,
    playerName: 'Meia Lua',
    type: 'VENDA',
    value: '45.00',
    fee: '0.50',
    penalty: '4.50',
    profit: '5.00',
    cashChange: '40.00',
    createdAt: saleTime,
  };
  const secondSale: TransactionCreate = {
    clubId,
    playerId: secondPlayerId,
    playerName: 'Lino Matos',
    type: 'VENDA',
    value: '25.00',
    fee: '0.00',
    penalty: '2.50',
    profit: '-15.00',
    cashChange: '22.50',
    createdAt: saleTime,
  };
  const firstSaleEntry = await transactionRepository.create(firstSale);
  const secondSaleEntry = await transactionRepository.create(secondSale);

  // Reproduz o estado que a futura operação de venda deixará no banco.
  await database.query(
    'UPDATE jogadores SET clube_id = NULL WHERE id IN (:playerIds)',
    { replacements: { playerIds: [firstPlayerId, secondPlayerId] } },
  );
  await database.query(
    `UPDATE contratos SET situacao = 'RESCINDIDO', encerrado_em = :saleTime
     WHERE clube_id = :clubId AND jogador_id IN (:playerIds)`,
    {
      replacements: {
        saleTime,
        clubId,
        playerIds: [firstPlayerId, secondPlayerId],
      },
    },
  );
  await database.query('UPDATE clubes SET caixa = :cash WHERE id = :clubId', {
    replacements: { cash: '278.50', clubId },
  });

  return {
    clubId,
    otherClubId,
    firstPlayerId,
    secondPlayerId,
    otherPlayerId,
    firstPurchase,
    secondPurchase,
    firstSaleEntry,
    secondSaleEntry,
    saleTime,
  };
}

describe('GET /api/v1/clubs/{id}/transactions — RN09, RN17, B18', () => {
  it('retorna lista e resumo zerados para clube sem transações', async () => {
    const clubId = await createClub();
    const before = await countRecords();
    const response = await listTransactions(clubId);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual({ data: [], summary: zeroSummary });
    expect(await countRecords()).toEqual(before);
  });

  it('usa a compra real, preserva snapshots e soma a taxa dentro do gasto', async () => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    const purchase = await buyPlayer(playerId, clubId);

    const update = await request(app).put(`/api/v1/players/${playerId}`).send({
      name: 'Meia Nova',
      position: 'MEI',
      agility: 20,
      age: 32,
    });
    expect(update.status).toBe(200);
    expect(update.body.market_value).not.toBe(40);

    const before = await countRecords();
    const response = await listTransactions(clubId);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          id: purchase.id,
          club_id: clubId,
          player_id: playerId,
          player_name: 'Meia Lua',
          type: 'COMPRA',
          value: 40,
          fee: 2,
          penalty: 0,
          profit: null,
          cash_change: -42,
          created_at: purchase.created_at,
        },
      ],
      summary: {
        total_spent: 42,
        total_received: 0,
        total_fees: 2,
        total_penalties: 0,
        total_profit: 0,
      },
    });
    expect(await countRecords()).toEqual(before);
  });

  it('ordena por data e id, isola o clube e soma compras e vendas com lucro negativo', async () => {
    const history = await createHistoryWithSales();
    const before = await countRecords();
    const response = await listTransactions(history.clubId);

    expect(response.status).toBe(200);
    expect(response.body.data.map((entry: { id: number }) => entry.id)).toEqual(
      [
        history.secondSaleEntry.id,
        history.firstSaleEntry.id,
        history.secondPurchase.id,
        history.firstPurchase.id,
      ],
    );
    expect(response.body.data[0]).toMatchObject({
      player_name: 'Lino Matos',
      type: 'VENDA',
      value: 25,
      fee: 0,
      penalty: 2.5,
      profit: -15,
      cash_change: 22.5,
    });
    expect(response.body.data[1]).toMatchObject({
      player_name: 'Meia Lua',
      type: 'VENDA',
      value: 45,
      fee: 0.5,
      penalty: 4.5,
      profit: 5,
      cash_change: 40,
    });
    expect(response.body.data[0].created_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/,
    );
    expect(Date.parse(response.body.data[0].created_at)).toBe(
      Math.floor(history.saleTime.getTime() / 1_000) * 1_000,
    );
    expect(response.body.summary).toEqual({
      total_spent: 84,
      total_received: 62.5,
      total_fees: 4.5,
      total_penalties: 7,
      total_profit: -10,
    });
    const cash = await database.query<{ caixa: string }>(
      'SELECT caixa FROM clubes WHERE id = :clubId',
      {
        type: QueryTypes.SELECT,
        replacements: { clubId: history.clubId },
      },
    );
    expect(Number(cash[0].caixa)).toBe(300 - 84 + 62.5);
    expect(await countRecords()).toEqual(before);

    const otherClub = await listTransactions(history.otherClubId);
    expect(otherClub.body.data).toHaveLength(1);
    expect(otherClub.body.summary).toEqual({
      ...zeroSummary,
      total_spent: 42,
      total_fees: 2,
    });
  });

  it.each([
    [
      { type: 'COMPRA' },
      [1, 2],
      { ...zeroSummary, total_spent: 84, total_fees: 4 },
    ],
    [
      { type: 'VENDA' },
      [4, 5],
      {
        ...zeroSummary,
        total_received: 62.5,
        total_fees: 0.5,
        total_penalties: 7,
        total_profit: -10,
      },
    ],
    [
      { type: 'COMPRA,VENDA' },
      [1, 2, 4, 5],
      {
        total_spent: 84,
        total_received: 62.5,
        total_fees: 4.5,
        total_penalties: 7,
        total_profit: -10,
      },
    ],
    [
      { type: 'VENDA,COMPRA' },
      [1, 2, 4, 5],
      {
        total_spent: 84,
        total_received: 62.5,
        total_fees: 4.5,
        total_penalties: 7,
        total_profit: -10,
      },
    ],
  ] as const)(
    'filtra tipos com %j e calcula apenas seus totais',
    async (query, expectedIds, expectedSummary) => {
      const history = await createHistoryWithSales();
      const response = await listTransactions(history.clubId, query);
      expect(response.status).toBe(200);
      expect(
        response.body.data.map((entry: { id: number }) => entry.id).sort(),
      ).toEqual([...expectedIds].sort());
      expect(response.body.summary).toEqual(expectedSummary);
    },
  );

  it('combina type e player_id e zera resultados para jogador existente sem registros no clube', async () => {
    const history = await createHistoryWithSales();
    const response = await listTransactions(history.clubId, {
      player_id: String(history.firstPlayerId),
    });
    expect(response.status).toBe(200);
    expect(response.body.data.map((entry: { id: number }) => entry.id)).toEqual(
      [history.firstSaleEntry.id, history.firstPurchase.id],
    );
    expect(response.body.summary).toEqual({
      total_spent: 42,
      total_received: 40,
      total_fees: 2.5,
      total_penalties: 4.5,
      total_profit: 5,
    });

    const combined = await listTransactions(history.clubId, {
      type: 'COMPRA',
      player_id: String(history.firstPlayerId),
    });
    expect(combined.status).toBe(200);
    expect(combined.body.data.map((entry: { id: number }) => entry.id)).toEqual(
      [history.firstPurchase.id],
    );
    expect(combined.body.summary).toEqual({
      ...zeroSummary,
      total_spent: 42,
      total_fees: 2,
    });

    const noRecords = await listTransactions(history.clubId, {
      player_id: String(history.otherPlayerId),
    });
    expect(noRecords.status).toBe(200);
    expect(noRecords.body).toEqual({ data: [], summary: zeroSummary });
  });

  it('mantém o histórico do jogador excluído, mas recusa player_id dele', async () => {
    const history = await createHistoryWithSales();
    const deleted = await request(app).delete(
      `/api/v1/players/${history.firstPlayerId}`,
    );
    expect(deleted.status).toBe(204);

    const all = await listTransactions(history.clubId);
    expect(all.status).toBe(200);
    expect(
      all.body.data.filter(
        (entry: { player_id: number }) =>
          entry.player_id === history.firstPlayerId,
      ),
    ).toHaveLength(2);

    const filtered = await listTransactions(history.clubId, {
      player_id: String(history.firstPlayerId),
    });
    expect(filtered.status).toBe(404);
    expect(filtered.body.message).toEqual(expect.any(String));
  });

  it.each(['abc', '0', '-1', '1.5', '01', '2147483648'])(
    'retorna 404 para id inválido de clube: %s',
    async (id) => {
      const response = await request(app).get(
        `/api/v1/clubs/${id}/transactions`,
      );
      expect(response.status).toBe(404);
      expect(response.body.message).toEqual(expect.any(String));
    },
  );

  it('retorna 404 para clube ou jogador inexistente', async () => {
    const clubId = await createClub();
    const missingClub = await listTransactions(999);
    expect(missingClub.status).toBe(404);
    expect(missingClub.body.message).toEqual(expect.any(String));

    const missingPlayer = await listTransactions(clubId, {
      player_id: '999',
    });
    expect(missingPlayer.status).toBe(404);
    expect(missingPlayer.body.message).toEqual(expect.any(String));
  });

  it.each([
    '',
    'compra',
    'COMPRA,compra',
    'COMPRA,COMPRA',
    'VENDA,VENDA',
    'COMPRA,VENDA,COMPRA',
    'COMPRA, VENDA',
    'COMPRA,',
  ])('retorna 400 para type inválido: %j', async (type) => {
    const clubId = await createClub();
    const before = await countRecords();
    const response = await listTransactions(clubId, { type });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Tipo de transação inválido.');
    expect(await countRecords()).toEqual(before);
  });

  it.each(['', '0', '-1', '01', '1.5', '1e2', 'abc', '2147483648'])(
    'retorna 400 para player_id inválido: %j',
    async (player_id) => {
      const clubId = await createClub();
      const before = await countRecords();
      const response = await listTransactions(clubId, { player_id });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('ID de jogador inválido.');
      expect(await countRecords()).toEqual(before);
    },
  );

  it('ignora parâmetros desconhecidos e o corpo enviado no GET', async () => {
    const clubId = await createClub();
    const response = await request(app)
      .get(`/api/v1/clubs/${clubId}/transactions?unknown=value`)
      .send({ type: 'VENDA' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [], summary: zeroSummary });
  });
});
