import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { QueryTypes, Sequelize } from 'sequelize';
import request from 'supertest';
import type { Express } from 'express';
import { resetTestDatabase } from './helpers/reset-test-database.js';

const execFileAsync = promisify(execFile);
const originalDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseName = `passe_test_${randomBytes(6).toString('hex')}`;

let adminDatabase: Sequelize;
let database: Sequelize;
let app: Express;

const validPlayer = {
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

beforeAll(async () => {
  if (!originalDatabaseUrl)
    throw new Error('DATABASE_URL é necessária para os testes de integração.');
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
  if (database) await resetTestDatabase(database);
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

async function playerCount(): Promise<number> {
  const rows = await database.query<{ count: string }>(
    'SELECT count(*) FROM jogadores',
    {
      type: QueryTypes.SELECT,
    },
  );
  return Number(rows[0].count);
}

describe('POST /api/v1/players — B01, B03, RN02–RN06', () => {
  it('V4/RN07: persiste e encontra nome de 100 caracteres cuja busca normalizada tem 199', async () => {
    const name = `${'가'.repeat(49)} ${'나'.repeat(50)}`;
    const searchName = `${'가'.repeat(49)} ${'나'.repeat(50)}`;
    const created = await request(app)
      .post('/api/v1/players')
      .send({ ...validPlayer, name });

    expect(created.status).toBe(201);
    expect(created.body.name).toBe(name);
    const rows = await database.query<{ nome: string; nome_busca: string }>(
      'SELECT nome, nome_busca FROM jogadores',
      { type: QueryTypes.SELECT },
    );
    expect(rows).toEqual([{ nome: name, nome_busca: searchName }]);
    const listed = await request(app)
      .get('/api/v1/players')
      .query({ search: name });
    expect(listed.status).toBe(200);
    expect(
      listed.body.data.map((player: { name: string }) => player.name),
    ).toEqual([name]);
    expect(listed.body.meta.total_items).toBe(1);
  });

  it('cria jogador APTO e livre, normaliza nome, ignora campos controlados e calcula valores', async () => {
    const response = await request(app)
      .post('/api/v1/players')
      .send({
        ...validPlayer,
        name: '  Méia   Lua  ',
        id: 77,
        condition: 'DOENTE',
        club_id: 8,
        base_value: 999,
        market_value: 999,
        overall: 1,
        unknown: 'ignored',
      });

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/api/v1/players/1');
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual({
      id: 1,
      name: 'Méia Lua',
      position: 'MEI',
      agility: 85,
      age: 25,
      condition: 'APTO',
      base_value: 40,
      market_value: 40,
      pace: 70,
      shooting: 68,
      passing: 82,
      dribbling: 79,
      defending: 55,
      physical: 64,
      potential: 86,
      overall: 75,
      club_id: null,
    });
    const rows = await database.query<{
      nome: string;
      nome_busca: string;
      valor_base: string;
      condicao: string;
      clube_id: number | null;
    }>(
      'SELECT nome, nome_busca, valor_base, condicao, clube_id FROM jogadores',
      { type: QueryTypes.SELECT },
    );
    expect(rows).toEqual([
      {
        nome: 'Méia Lua',
        nome_busca: 'meia lua',
        valor_base: '40.00',
        condicao: 'APTO',
        clube_id: null,
      },
    ]);
  });

  it('aplica bônus de idade ao mercado no cadastro, separadamente do valor base', async () => {
    const response = await request(app)
      .post('/api/v1/players')
      .send({ ...validPlayer, age: 21 });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      overall: 75,
      base_value: 44.4,
      market_value: 48.84,
    });
  });

  it.each([
    ['corpo array', [validPlayer]],
    ['campo ausente', { ...validPlayer, agility: undefined }],
    [
      'campo com outro nome',
      { ...validPlayer, agility: undefined, Agility: 85 },
    ],
    ['campo nulo', { ...validPlayer, agility: null }],
    ['tipo textual numérico', { ...validPlayer, agility: '85' }],
    ['número fracionário', { ...validPlayer, age: 25.5 }],
    ['enum em minúsculas', { ...validPlayer, position: 'mei' }],
    ['nome vazio após normalizar', { ...validPlayer, name: '    ' }],
    ['nome com uma palavra', { ...validPlayer, name: 'Meia' }],
    ['nome com dígito', { ...validPlayer, name: 'Meia 1' }],
    ['nome com tabulação', { ...validPlayer, name: 'Meia\tLua' }],
    ['idade menor que 16', { ...validPlayer, age: 15 }],
    ['idade maior que 45', { ...validPlayer, age: 46 }],
    ['agilidade menor que 1', { ...validPlayer, agility: 0 }],
    ['agilidade acima de 100', { ...validPlayer, agility: 101 }],
    ['atributo abaixo de 1', { ...validPlayer, pace: 0 }],
    ['atributo acima de 99', { ...validPlayer, pace: 100 }],
    ['potencial abaixo de 1', { ...validPlayer, potential: 0 }],
    ['potencial acima de 99', { ...validPlayer, potential: 100 }],
    ['idade 35 e agilidade 86', { ...validPlayer, age: 35, agility: 86 }],
    [
      'soma dos atributos 481',
      {
        ...validPlayer,
        pace: 99,
        shooting: 99,
        passing: 99,
        dribbling: 99,
        defending: 84,
        physical: 1,
        potential: 99,
      },
    ],
    ['potencial abaixo do maior atributo', { ...validPlayer, potential: 81 }],
    [
      'idade 33 e potencial acima do maior atributo',
      { ...validPlayer, age: 33, potential: 86 },
    ],
    [
      'nome com 101 pontos de código',
      { ...validPlayer, name: `A ${'á'.repeat(99)}` },
    ],
    [
      'nome com 101 pontos de código suplementares',
      { ...validPlayer, name: `A ${'𐐀'.repeat(99)}` },
    ],
  ])('recusa %s sem gravar nada', async (_label, body) => {
    const response = await request(app).post('/api/v1/players').send(body);
    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toMatchObject({ message: expect.any(String) });
    expect(response.body.message.length).toBeGreaterThan(0);
    expect(await playerCount()).toBe(0);
  });

  it('recusa JSON malformado sem persistência', async () => {
    const response = await request(app)
      .post('/api/v1/players')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'JSON inválido.' });
    expect(await playerCount()).toBe(0);
  });

  it('responde 404 em rota inexistente com JSON e message', async () => {
    const response = await request(app).get('/api/v1/unknown');
    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual({ message: 'Rota não encontrada.' });
  });

  it('aceita idade 35 com agilidade 85 e potencial igual ao maior atributo', async () => {
    const response = await request(app)
      .post('/api/v1/players')
      .send({ ...validPlayer, age: 35, potential: 82 });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ base_value: 40, market_value: 36 });
    expect(await playerCount()).toBe(1);
  });

  it.each([
    [
      'limite mínimo de nome e idade',
      { ...validPlayer, name: 'A B', age: 16, agility: 100 },
    ],
    [
      'nome com 100 pontos de código',
      { ...validPlayer, name: `A ${'á'.repeat(98)}` },
    ],
    [
      'nome com 100 pontos de código suplementares',
      { ...validPlayer, name: `A ${'𐐀'.repeat(98)}` },
    ],
    [
      'soma dos seis atributos igual a 480',
      {
        ...validPlayer,
        pace: 80,
        shooting: 80,
        passing: 80,
        dribbling: 80,
        defending: 80,
        physical: 80,
        potential: 80,
      },
    ],
    [
      'idade 45, agilidade 85 e potencial igual ao maior atributo',
      {
        ...validPlayer,
        age: 45,
        agility: 85,
        potential: 82,
      },
    ],
  ])('aceita %s', async (_label, body) => {
    const response = await request(app).post('/api/v1/players').send(body);
    expect(response.status).toBe(201);
    expect(await playerCount()).toBe(1);
  });
});
