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

async function createPlayer() {
  const response = await request(app).post('/api/v1/players').send(playerBody);
  expect(response.status).toBe(201);
  return response.body;
}

async function storedPlayer() {
  const rows = await database.query<{
    nome: string;
    posicao: string;
    idade: number;
    condicao: string;
    valor_base: string;
    excluido_em: Date | null;
    atualizado_em: Date;
  }>(
    `SELECT nome, posicao, idade, condicao, valor_base,
            excluido_em, atualizado_em FROM jogadores WHERE id = 1`,
    { type: QueryTypes.SELECT },
  );
  return rows[0];
}

describe('GET /api/v1/players/{id} — V8, RN05, RN06 e B03', () => {
  it('retorna todos os campos do jogador com overall e mercado atuais sem gravar nada', async () => {
    const created = await createPlayer();
    const before = await storedPlayer();

    const response = await request(app).get('/api/v1/players/1');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual(created);
    expect(response.body).toMatchObject({
      base_value: 40,
      market_value: 40,
      overall: 75,
      club_id: null,
    });
    expect(await storedPlayer()).toEqual(before);
  });

  it('reflete posição e idade editadas, sem recalcular o valor base', async () => {
    await createPlayer();
    const updated = await request(app).put('/api/v1/players/1').send({
      name: 'Meia Lua',
      position: 'ATA',
      agility: 70,
      age: 32,
    });
    expect(updated.status).toBe(200);

    const response = await request(app).get('/api/v1/players/1');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(updated.body);
    expect(response.body).toMatchObject({
      position: 'ATA',
      age: 32,
      base_value: 40,
      overall: 72,
      market_value: 36,
    });
    expect((await storedPlayer()).valor_base).toBe('40.00');
  });

  it.each([
    ['MAL_CONDICIONADO', 85, 25, 37],
    ['DOENTE', 10, 40, 24],
  ] as const)(
    'RN05: condição %s, agilidade %i e idade %i mostram mercado %f',
    async (condition, agility, age, marketValue) => {
      await createPlayer();
      await database.query(
        `UPDATE jogadores SET condicao = :condition,
           agilidade = :agility, idade = :age WHERE id = 1`,
        { replacements: { condition, agility, age } },
      );
      const before = await storedPlayer();

      const response = await request(app).get('/api/v1/players/1');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        condition,
        agility,
        age,
        base_value: 40,
        market_value: marketValue,
      });
      expect(await storedPlayer()).toEqual(before);
    },
  );

  it('retorna club_id atual sem modificar o vínculo', async () => {
    await createPlayer();
    await database.query(
      `INSERT INTO clubes (nome, nome_normalizado, nome_busca, sigla)
       VALUES ('Águias FC', 'águias fc', 'aguias fc', 'AGU')`,
    );
    await database.query('UPDATE jogadores SET clube_id = 1 WHERE id = 1');
    const before = await storedPlayer();

    const response = await request(app).get('/api/v1/players/1');
    expect(response.status).toBe(200);
    expect(response.body.club_id).toBe(1);
    expect(await storedPlayer()).toEqual(before);
  });

  it.each(['abc', '0', '-1', '1.5', '01', '2147483648'])(
    'V8: id %s retorna 404 com message sem gravar nada',
    async (id) => {
      await createPlayer();
      const before = await storedPlayer();
      const response = await request(app).get(`/api/v1/players/${id}`);
      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
      expect(response.body).toMatchObject({ message: expect.any(String) });
      expect(response.body.message.length).toBeGreaterThan(0);
      expect(await storedPlayer()).toEqual(before);
    },
  );

  it('jogador inexistente retorna 404', async () => {
    const response = await request(app).get('/api/v1/players/999');
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ message: expect.any(String) });
  });

  it('jogador excluído retorna 404', async () => {
    await createPlayer();
    await database.query(
      'UPDATE jogadores SET excluido_em = NOW() WHERE id = 1',
    );
    const before = await storedPlayer();
    const response = await request(app).get('/api/v1/players/1');
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ message: expect.any(String) });
    expect(await storedPlayer()).toEqual(before);
  });

  it('ignora corpo e query params enviados numa consulta por id', async () => {
    const created = await createPlayer();
    const response = await request(app)
      .get('/api/v1/players/1?unexpected=value')
      .send({ name: 'Outro Nome', market_value: 999 });
    expect(response.status).toBe(200);
    expect(response.body).toEqual(created);
  });

  it('ignora JSON malformado enviado em uma consulta (V1)', async () => {
    const created = await createPlayer();
    const response = await request(app)
      .get('/api/v1/players/1')
      .set('Content-Type', 'application/json')
      .send('{"unexpected":');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(created);
  });
});
