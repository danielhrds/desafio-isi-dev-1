import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import type { Express } from 'express';
import { QueryTypes, Sequelize } from 'sequelize';
import request from 'supertest';

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

const updateBody = {
  name: 'Meia Lua',
  position: 'MEI',
  agility: 85,
  age: 25,
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

beforeEach(async () => {
  const created = await request(app).post('/api/v1/players').send(playerBody);
  expect(created.status).toBe(201);
});

afterEach(async () => {
  if (database)
    await database.query(
      'TRUNCATE TABLE jogadores, clubes RESTART IDENTITY CASCADE',
    );
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

async function playerRow() {
  const rows = await database.query<{
    nome: string;
    nome_busca: string;
    posicao: string;
    agilidade: number;
    idade: number;
    valor_base: string;
    potencial: number;
    passe: number;
    clube_id: number | null;
    excluido_em: Date | null;
  }>(
    `SELECT nome, nome_busca, posicao, agilidade, idade, valor_base,
             potencial, passe, clube_id, excluido_em FROM jogadores WHERE id = 1`,
    { type: QueryTypes.SELECT },
  );
  return rows[0];
}

describe('PUT /api/v1/players/{id} — RN08, V1–V9', () => {
  it('edita os quatro campos e recalcula overall/mercado sem mudar base, indicadores ou potencial', async () => {
    const response = await request(app).put('/api/v1/players/1').send({
      name: '  Méia   Zeta  ',
      position: 'ATA',
      agility: 70,
      age: 32,
      base_value: 999,
      market_value: 999,
      overall: 1,
      pace: 1,
      potential: 1,
      condition: 'DOENTE',
      club_id: 8,
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual({
      id: 1,
      name: 'Méia Zeta',
      position: 'ATA',
      agility: 70,
      age: 32,
      condition: 'APTO',
      base_value: 40,
      market_value: 36,
      pace: 70,
      shooting: 68,
      passing: 82,
      dribbling: 79,
      defending: 55,
      physical: 64,
      potential: 86,
      overall: 72,
      club_id: null,
    });
    expect(await playerRow()).toMatchObject({
      nome: 'Méia Zeta',
      nome_busca: 'meia zeta',
      posicao: 'ATA',
      agilidade: 70,
      idade: 32,
      valor_base: '40.00',
      potencial: 86,
      passe: 82,
      clube_id: null,
    });
  });

  it('aceita idade 33 sem forçar potencial igual ao maior atributo', async () => {
    const response = await request(app)
      .put('/api/v1/players/1')
      .send({
        ...updateBody,
        age: 33,
        potential: 82,
      });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      age: 33,
      potential: 86,
      base_value: 40,
      market_value: 36,
    });
    expect((await playerRow()).potencial).toBe(86);
  });

  it.each([
    [34, 90],
    [35, 85],
  ])(
    'aceita idade %i com agilidade %i no limite permitido',
    async (age, agility) => {
      const response = await request(app)
        .put('/api/v1/players/1')
        .send({ ...updateBody, age, agility });
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        age,
        agility,
        base_value: 40,
        market_value: 36,
      });
      expect(await playerRow()).toMatchObject({
        idade: age,
        agilidade: agility,
      });
    },
  );

  it.each([['abc'], ['0'], ['-1'], ['1.5'], ['01'], ['2147483648']])(
    'V8: id %s retorna 404 sem alteração',
    async (id) => {
      const before = await playerRow();
      const response = await request(app)
        .put(`/api/v1/players/${id}`)
        .send(updateBody);
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ message: expect.any(String) });
      expect(await playerRow()).toEqual(before);
    },
  );

  it('V8: jogador excluído retorna 404 sem alteração', async () => {
    await database.query(
      'UPDATE jogadores SET excluido_em = NOW() WHERE id = 1',
    );
    const before = await playerRow();
    const response = await request(app)
      .put('/api/v1/players/1')
      .send(updateBody);
    expect(response.status).toBe(404);
    expect(await playerRow()).toEqual(before);
  });

  it.each([
    ['campo obrigatório ausente', { ...updateBody, age: undefined }],
    ['campo obrigatório nulo', { ...updateBody, position: null }],
    ['agilidade textual', { ...updateBody, agility: '85' }],
    ['idade fracionária', { ...updateBody, age: 25.5 }],
    ['posição em minúsculas', { ...updateBody, position: 'mei' }],
    ['nome vazio', { ...updateBody, name: '   ' }],
    ['nome com controle', { ...updateBody, name: 'Meia\nLua' }],
    ['idade 35 com agilidade 86', { ...updateBody, age: 35, agility: 86 }],
  ])('V1–V6: %s retorna 400 sem alteração', async (_label, body) => {
    const before = await playerRow();
    const response = await request(app).put('/api/v1/players/1').send(body);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ message: expect.any(String) });
    expect(await playerRow()).toEqual(before);
  });

  it.each([
    [
      'name ausente',
      { ...updateBody, name: undefined },
      'O campo name é obrigatório.',
    ],
    [
      'position ausente',
      { ...updateBody, position: undefined },
      'O campo position é obrigatório.',
    ],
    [
      'agility ausente',
      { ...updateBody, agility: undefined },
      'O campo agility é obrigatório.',
    ],
    [
      'age ausente',
      { ...updateBody, age: undefined },
      'O campo age é obrigatório.',
    ],
    [
      'name numérico',
      { ...updateBody, name: 123 },
      'O campo name deve ser um texto.',
    ],
    [
      'position inválida',
      { ...updateBody, position: 'mei' },
      'O campo position deve ser GOL, ZAG, LAT, MEI ou ATA.',
    ],
    [
      'agility textual',
      { ...updateBody, agility: '85' },
      'O campo agility deve ser um número inteiro.',
    ],
    [
      'agility fracionária',
      { ...updateBody, agility: 85.5 },
      'O campo agility deve ser um número inteiro.',
    ],
    [
      'agility fora da faixa',
      { ...updateBody, agility: 101 },
      'O campo agility deve estar entre 1 e 100.',
    ],
    [
      'age textual',
      { ...updateBody, age: '25' },
      'O campo age deve ser um número inteiro.',
    ],
    [
      'age fracionária',
      { ...updateBody, age: 25.5 },
      'O campo age deve ser um número inteiro.',
    ],
    [
      'age fora da faixa',
      { ...updateBody, age: 15 },
      'O campo age deve estar entre 16 e 45.',
    ],
  ])(
    'V2/V5/V6: %s informa o campo sem alterar o jogador',
    async (_label, body, message) => {
      const before = await playerRow();
      const response = await request(app).put('/api/v1/players/1').send(body);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message });
      expect(await playerRow()).toEqual(before);
    },
  );

  it('V1: corpo em array informa o formato esperado sem alterar o jogador', async () => {
    const before = await playerRow();
    const response = await request(app).put('/api/v1/players/1').send([]);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: 'O corpo do PUT deve ser um objeto JSON.',
    });
    expect(await playerRow()).toEqual(before);
  });

  it('RN08: idade menor que a atual retorna 409 sem alteração', async () => {
    const raised = await request(app)
      .put('/api/v1/players/1')
      .send({ ...updateBody, age: 30 });
    expect(raised.status).toBe(200);
    const before = await playerRow();
    const response = await request(app)
      .put('/api/v1/players/1')
      .send({ ...updateBody, age: 29 });
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ message: expect.any(String) });
    expect(await playerRow()).toEqual(before);
  });

  it('RN08: jogador com clube mantém posição, mas rejeita mudança de posição', async () => {
    await database.query(`INSERT INTO clubes (nome, nome_normalizado, nome_busca, sigla)
      VALUES ('Águias FC', 'águias fc', 'aguias fc', 'AGU')`);
    await database.query('UPDATE jogadores SET clube_id = 1 WHERE id = 1');
    const allowed = await request(app)
      .put('/api/v1/players/1')
      .send({ ...updateBody, age: 26 });
    expect(allowed.status).toBe(200);
    expect(allowed.body).toMatchObject({
      position: 'MEI',
      club_id: 1,
      age: 26,
    });
    const before = await playerRow();
    const denied = await request(app)
      .put('/api/v1/players/1')
      .send({ ...updateBody, position: 'ATA', age: 27 });
    expect(denied.status).toBe(409);
    expect(denied.body).toMatchObject({ message: expect.any(String) });
    expect(await playerRow()).toEqual(before);
  });

  it('V8: jogador inexistente retorna 404', async () => {
    const response = await request(app)
      .put('/api/v1/players/2')
      .send(updateBody);
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ message: expect.any(String) });
  });

  it('serializa PUT com outra atualização da mesma linha e revalida a idade', async () => {
    const transaction = await database.transaction();
    let committed = false;
    try {
      await database.query('SELECT id FROM jogadores WHERE id = 1 FOR UPDATE', {
        transaction,
      });
      await database.query('UPDATE jogadores SET idade = 31 WHERE id = 1', {
        transaction,
      });
      const pending = request(app)
        .put('/api/v1/players/1')
        .send({ ...updateBody, age: 30 })
        .then((response) => response);

      const deadline = Date.now() + 5_000;
      let blocked = false;
      while (Date.now() < deadline) {
        const rows = await adminDatabase.query<{ waiting: boolean }>(
          `SELECT EXISTS (SELECT 1 FROM pg_stat_activity
             WHERE datname = :databaseName AND wait_event_type = 'Lock'
               AND query ILIKE '%jogadores%') AS waiting`,
          {
            type: QueryTypes.SELECT,
            replacements: { databaseName: testDatabaseName },
          },
        );
        if (rows[0].waiting) {
          blocked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(blocked).toBe(true);
      await transaction.commit();
      committed = true;

      const response = await pending;
      expect(response.status).toBe(409);
      expect((await playerRow()).idade).toBe(31);
    } finally {
      if (!committed) await transaction.rollback();
    }
  }, 10_000);
});
