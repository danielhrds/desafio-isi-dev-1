import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import type { Express } from 'express';
import { DateTime } from 'luxon';
import { QueryTypes, Sequelize } from 'sequelize';
import request, { type Response } from 'supertest';
import type { TransactionCreate } from '../src/repositories/transaction.repository.js';

const execFileAsync = promisify(execFile);
const originalDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseName = `passe_test_${randomBytes(6).toString('hex')}`;
const header =
  'data_hora;tipo;jogador;valor;taxa_ou_comissao;multa;lucro;variacao_caixa\n';
const purchaseTime = new Date('2026-11-02T13:15:00.000Z');
const saleTime = new Date('2026-11-05T19:40:00.000Z');
const specialName = 'Zé; "Foguete" Lima';
const escapedName = '"Zé; ""Foguete"" Lima"';

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

function futureDate(): string {
  return DateTime.utc()
    .plus({ days: 120 })
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

function exportRequest(clubId: number, query?: Record<string, string>) {
  const call = request(app).get(`/api/v1/clubs/${clubId}/transactions/export`);
  return query ? call.query(query) : call;
}

function readBytes(
  response: Response,
  callback: (error: Error | null, body?: Buffer) => void,
) {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', callback);
}

function exportBytes(clubId: number, query?: Record<string, string>) {
  return exportRequest(clubId, query).buffer(true).parse(readBytes);
}

async function countTransactions() {
  const rows = await database.query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM transacoes',
    { type: QueryTypes.SELECT },
  );
  return Number(rows[0].count);
}

async function createFixtureHistory() {
  const clubId = await createClub();
  const specialPlayerId = await createPlayer(specialName);
  const otherPlayerId = await createPlayer('Lino Matos');

  const entries: TransactionCreate[] = [
    {
      clubId,
      playerId: specialPlayerId,
      playerName: specialName,
      type: 'COMPRA',
      value: '37.00',
      fee: '1.85',
      penalty: '0.00',
      profit: null,
      cashChange: '-38.85',
      createdAt: purchaseTime,
    },
    {
      clubId,
      playerId: otherPlayerId,
      playerName: 'Lino Matos',
      type: 'COMPRA',
      value: '40.00',
      fee: '2.00',
      penalty: '0.00',
      profit: null,
      cashChange: '-42.00',
      createdAt: purchaseTime,
    },
    {
      clubId,
      playerId: specialPlayerId,
      playerName: specialName,
      type: 'VENDA',
      value: '40.00',
      fee: '0.30',
      penalty: '4.00',
      profit: '3.00',
      cashChange: '35.70',
      createdAt: saleTime,
    },
    {
      clubId,
      playerId: otherPlayerId,
      playerName: 'Lino Matos',
      type: 'VENDA',
      value: '25.00',
      fee: '0.00',
      penalty: '2.50',
      profit: '-15.00',
      cashChange: '22.50',
      createdAt: saleTime,
    },
  ];
  for (const entry of entries) {
    await transactionRepository.create(entry);
  }

  const lines = {
    specialPurchase: `2026-11-02T10:15:00-03:00;COMPRA;${escapedName};37,00;1,85;0,00;;-38,85\n`,
    otherPurchase:
      '2026-11-02T10:15:00-03:00;COMPRA;Lino Matos;40,00;2,00;0,00;;-42,00\n',
    specialSale: `2026-11-05T16:40:00-03:00;VENDA;${escapedName};40,00;0,30;4,00;3,00;35,70\n`,
    otherSale:
      '2026-11-05T16:40:00-03:00;VENDA;Lino Matos;25,00;0,00;2,50;-15,00;22,50\n',
  };

  return { clubId, specialPlayerId, otherPlayerId, lines };
}

describe('GET /api/v1/clubs/{id}/transactions/export — RN18, B19', () => {
  it('retorna exatamente o cabeçalho UTF-8 sem BOM e com LF final quando vazio', async () => {
    const clubId = await createClub();
    const response = await exportBytes(clubId);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/csv(?:;|$)/);
    expect(response.headers['content-disposition']).toBe(
      `attachment; filename="club-${clubId}-transactions.csv"`,
    );
    expect(response.body).toEqual(Buffer.from(header, 'utf8'));
    expect(await countTransactions()).toBe(0);
  });

  it('exporta uma compra feita pela API, com valores em centavos e lucro vazio', async () => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    const purchase = await request(app)
      .post(`/api/v1/players/${playerId}/buy`)
      .send({ club_id: clubId, loyalty_until: futureDate() });
    expect(purchase.status).toBe(200);
    const response = await exportBytes(clubId);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      Buffer.from(
        header +
          `${purchase.body.created_at};COMPRA;Meia Lua;40,00;2,00;0,00;;-42,00\n`,
        'utf8',
      ),
    );
    expect(await countTransactions()).toBe(1);
  });

  it('usa snapshots e ordem data/id, escapa nome e preserva lucro negativo', async () => {
    const { clubId, specialPlayerId, lines } = await createFixtureHistory();
    const before = await countTransactions();

    const updated = await request(app)
      .put(`/api/v1/players/${specialPlayerId}`)
      .send({
        name: 'Novo Nome',
        position: 'MEI',
        agility: 20,
        age: 32,
      });
    expect(updated.status).toBe(200);

    const response = await exportBytes(clubId);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      Buffer.from(
        header +
          lines.otherSale +
          lines.specialSale +
          lines.otherPurchase +
          lines.specialPurchase,
        'utf8',
      ),
    );
    expect(await countTransactions()).toBe(before);
  });

  it.each(['COMPRA', 'VENDA', 'COMPRA,VENDA', 'VENDA,COMPRA'])(
    'aceita type=%s e exporta só as linhas correspondentes',
    async (type) => {
      const { clubId, lines } = await createFixtureHistory();
      const response = await exportBytes(clubId, { type });
      expect(response.status).toBe(200);

      const sales = lines.otherSale + lines.specialSale;
      const purchases = lines.otherPurchase + lines.specialPurchase;
      const expected =
        type === 'COMPRA'
          ? purchases
          : type === 'VENDA'
            ? sales
            : sales + purchases;
      expect(response.body).toEqual(Buffer.from(header + expected, 'utf8'));
    },
  );

  it('combina type e player_id e usa só o cabeçalho quando não há registros', async () => {
    const { clubId, specialPlayerId, lines } = await createFixtureHistory();
    const response = await exportBytes(clubId, {
      type: 'VENDA',
      player_id: String(specialPlayerId),
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      Buffer.from(header + lines.specialSale, 'utf8'),
    );

    const otherClubId = await createClub('Delta FC', 'DEL');
    const noRecords = await exportBytes(otherClubId, {
      player_id: String(specialPlayerId),
    });
    expect(noRecords.status).toBe(200);
    expect(noRecords.body).toEqual(Buffer.from(header, 'utf8'));
  });

  it('mantém transações de jogador excluído, mas recusa o filtro por esse jogador', async () => {
    const { clubId, specialPlayerId, lines } = await createFixtureHistory();
    const deleted = await request(app).delete(
      `/api/v1/players/${specialPlayerId}`,
    );
    expect(deleted.status).toBe(204);

    const all = await exportBytes(clubId);
    expect(all.status).toBe(200);
    expect((all.body as Buffer).includes(Buffer.from(lines.specialSale))).toBe(
      true,
    );

    const filtered = await exportRequest(clubId, {
      player_id: String(specialPlayerId),
    });
    expect(filtered.status).toBe(404);
    expect(filtered.headers['content-type']).toMatch(/^application\/json/);
    expect(filtered.body.message).toEqual(expect.any(String));
  });

  it.each([
    [{ type: '' }, 'Tipo de transação inválido.'],
    [{ type: 'compra' }, 'Tipo de transação inválido.'],
    [{ type: 'COMPRA,COMPRA' }, 'Tipo de transação inválido.'],
    [{ type: 'COMPRA, VENDA' }, 'Tipo de transação inválido.'],
    [{ player_id: '' }, 'ID de jogador inválido.'],
    [{ player_id: '0' }, 'ID de jogador inválido.'],
    [{ player_id: '01' }, 'ID de jogador inválido.'],
    [{ player_id: '1.5' }, 'ID de jogador inválido.'],
  ] as const)('recusa o filtro %j com JSON e 400', async (query, message) => {
    const clubId = await createClub();
    const response = await exportRequest(clubId, query);
    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual({ message });
    expect(await countTransactions()).toBe(0);
  });

  it('recusa clube inexistente ou inválido e jogador inexistente com JSON e 404', async () => {
    const clubId = await createClub();
    for (const path of [
      '/api/v1/clubs/999/transactions/export',
      '/api/v1/clubs/01/transactions/export',
      '/api/v1/clubs/abc/transactions/export',
      `/api/v1/clubs/${clubId}/transactions/export?player_id=999`,
    ]) {
      const response = await request(app).get(path);
      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
      expect(response.body.message).toEqual(expect.any(String));
    }
    expect(await countTransactions()).toBe(0);
  });

  it('ignora query param desconhecido e corpo enviado no GET', async () => {
    const clubId = await createClub();
    const response = await request(app)
      .get(`/api/v1/clubs/${clubId}/transactions/export?unknown=value`)
      .send({ type: 'VENDA' })
      .buffer(true)
      .parse(readBytes);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(Buffer.from(header, 'utf8'));
  });
});
