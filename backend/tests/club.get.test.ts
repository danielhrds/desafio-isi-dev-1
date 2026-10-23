import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import type { Express } from 'express';
import { DateTime } from 'luxon';
import { QueryTypes, Sequelize } from 'sequelize';
import request from 'supertest';
import { resetTestDatabase } from './helpers/reset-test-database.js';

const execFileAsync = promisify(execFile);
const originalDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseName = `passe_test_${randomBytes(6).toString('hex')}`;

let adminDatabase: Sequelize;
let database: Sequelize;
let app: Express;

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

async function createClub(): Promise<number> {
  const response = await request(app)
    .post('/api/v1/clubs')
    .send({ name: 'Águias FC', acronym: 'AGU' });
  expect(response.status).toBe(201);
  return response.body.id as number;
}

async function createPlayer(
  name = 'Meia Lua',
  position = 'MEI',
): Promise<number> {
  const response = await request(app)
    .post('/api/v1/players')
    .send({ ...playerBody, name, position });
  expect(response.status).toBe(201);
  return response.body.id as number;
}

async function buy(
  playerId: number,
  clubId: number,
  loyaltyUntil = futureDate(),
) {
  const response = await request(app)
    .post(`/api/v1/players/${playerId}/buy`)
    .send({ club_id: clubId, loyalty_until: loyaltyUntil });
  expect(response.status).toBe(200);
  return response;
}

describe('GET /api/v1/clubs/{id} — RN11, RN15, B13', () => {
  it('retorna clube vazio com 200 e elenco vazio', async () => {
    const clubId = await createClub();
    const response = await request(app).get(`/api/v1/clubs/${clubId}`);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual({
      id: clubId,
      name: 'Águias FC',
      acronym: 'AGU',
      cash: 300,
      squad_value: 0,
      net_worth: 300,
      players: [],
    });
  });

  it.each(['abc', '0', '-1', '01', '1.5', '2147483648', '999'])(
    'retorna 404 para clube ou id inexistente %s',
    async (id) => {
      await createClub();
      const response = await request(app).get(`/api/v1/clubs/${id}`);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: expect.any(String) });
    },
  );

  it('compõe elenco, contrato e patrimônio após compras e atualiza mercado sem mudar compra', async () => {
    const clubId = await createClub();
    const firstId = await createPlayer('Meia Lua');
    const secondId = await createPlayer('Meia Sol');
    await database.query(
      `UPDATE jogadores SET valor_base = '40.00',
       condicao = 'MAL_CONDICIONADO' WHERE id = :id`,
      { replacements: { id: firstId } },
    );
    await database.query(
      "UPDATE jogadores SET valor_base = '40.00', idade = 20 WHERE id = :id",
      { replacements: { id: secondId } },
    );
    const loyaltyUntil = futureDate();
    expect((await buy(firstId, clubId, loyaltyUntil)).body.value).toBe(37);
    expect((await buy(secondId, clubId, loyaltyUntil)).body.value).toBe(44);

    const first = await request(app).get(`/api/v1/clubs/${clubId}`);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      id: clubId,
      cash: 214.95,
      squad_value: 81,
      net_worth: 295.95,
    });
    expect(
      first.body.players.map((player: { id: number }) => player.id),
    ).toEqual([firstId, secondId]);
    expect(first.body.players[0]).toMatchObject({
      name: 'Meia Lua',
      position: 'MEI',
      agility: 85,
      age: 25,
      condition: 'MAL_CONDICIONADO',
      base_value: 40,
      market_value: 37,
      overall: 75,
      club_id: clubId,
      contract: {
        purchase_value: 37,
        loyalty_until: `${loyaltyUntil.slice(0, 16)}:00-03:00`,
        remaining_days: 120,
        penalty_rate: 10,
      },
    });
    expect(first.body.players[1]).toMatchObject({
      age: 20,
      market_value: 44,
      contract: { purchase_value: 44, remaining_days: 120 },
    });
    const playerResponse = await request(app).get(`/api/v1/players/${firstId}`);
    expect(playerResponse.status).toBe(200);
    const { contract, ...clubPlayer } = first.body.players[0];
    expect(contract).toBeDefined();
    expect(clubPlayer).toEqual(playerResponse.body);

    await database.query(
      "UPDATE jogadores SET condicao = 'APTO' WHERE id = :id",
      { replacements: { id: firstId } },
    );
    const second = await request(app).get(`/api/v1/clubs/${clubId}`);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({
      cash: 214.95,
      squad_value: 84,
      net_worth: 298.95,
    });
    expect(second.body.players[0]).toMatchObject({
      market_value: 40,
      contract: { purchase_value: 37, remaining_days: 120 },
    });
    expect((await request(app).get('/api/v1/clubs')).body[0]).toMatchObject({
      squad_value: 84,
      net_worth: 298.95,
    });
    const rows = await database.query<{
      caixa: string;
      valor_compra: string;
    }>(
      `SELECT c.caixa, ct.valor_compra FROM clubes c
       JOIN contratos ct ON ct.clube_id = c.id ORDER BY ct.id`,
      { type: QueryTypes.SELECT },
    );
    expect(rows).toEqual([
      { caixa: '214.95', valor_compra: '37.00' },
      { caixa: '214.95', valor_compra: '44.00' },
    ]);
  });

  it('ordena por posição, nome Unicode normalizado e id', async () => {
    const clubId = await createClub();
    const fixtures = [
      ['Otto Atacante', 'ATA'],
      ['Meia Lua', 'MEI'],
      ['Ana-Maria Costa', 'LAT'],
      ['Álvaro Zaga', 'ZAG'],
      ['Ana Lima', 'LAT'],
      ['Alvaro Zaga', 'ZAG'],
      ['Goleiro Zeta', 'GOL'],
    ] as const;
    const ids: number[] = [];
    for (const [name, position] of fixtures) {
      const playerId = await createPlayer(name, position);
      ids.push(playerId);
      await database.query(
        "UPDATE jogadores SET valor_base = '10.00' WHERE id = :id",
        { replacements: { id: playerId } },
      );
      await buy(playerId, clubId);
    }

    const response = await request(app).get(`/api/v1/clubs/${clubId}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      cash: 230,
      squad_value: 70,
      net_worth: 300,
    });
    expect(
      response.body.players.map((player: { id: number }) => player.id),
    ).toEqual([ids[6], ids[3], ids[5], ids[4], ids[2], ids[1], ids[0]]);
  });

  it('soma valores individuais arredondados antes de calcular o patrimônio', async () => {
    const clubId = await createClub();
    for (const name of ['Meia Lua', 'Meia Sol', 'Meia Mar']) {
      const playerId = await createPlayer(name);
      await database.query(
        `UPDATE jogadores SET valor_base = '1.50',
         condicao = 'MAL_CONDICIONADO', agilidade = 80 WHERE id = :id`,
        { replacements: { id: playerId } },
      );
      await buy(playerId, clubId);
    }

    // 1,50 × 0,925 = 1,3875 → 1,39 por jogador; 3 × 1,39 = 4,17.
    const response = await request(app).get(`/api/v1/clubs/${clubId}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      cash: 295.83,
      squad_value: 4.17,
      net_worth: 300,
    });
    expect(
      response.body.players.map(
        (player: { market_value: number }) => player.market_value,
      ),
    ).toEqual([1.39, 1.39, 1.39]);
  });

  it('mantém contrato ativo vencido no elenco com dias e taxa zerados', async () => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    await buy(playerId, clubId);
    await database.query(
      'UPDATE contratos SET fidelidade_ate = :past WHERE jogador_id = :id',
      {
        replacements: {
          past: new Date(Date.now() - 86_400_000),
          id: playerId,
        },
      },
    );

    const response = await request(app).get(`/api/v1/clubs/${clubId}`);
    expect(response.status).toBe(200);
    expect(response.body.players).toHaveLength(1);
    expect(response.body.players[0].contract).toMatchObject({
      remaining_days: 0,
      penalty_rate: 0,
    });
    const rows = await database.query<{ situacao: string }>(
      'SELECT situacao FROM contratos WHERE jogador_id = :id',
      { type: QueryTypes.SELECT, replacements: { id: playerId } },
    );
    expect(rows).toEqual([{ situacao: 'ATIVO' }]);
  });
});
