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
    id: number;
    nome: string;
    clube_id: number | null;
    excluido_em: Date | null;
  }>('SELECT id, nome, clube_id, excluido_em FROM jogadores WHERE id = 1', {
    type: QueryTypes.SELECT,
  });
  return rows[0];
}

describe('DELETE /api/v1/players/{id} — RN09, V8 e B08', () => {
  it('marca o jogador livre como excluído, responde 204 sem corpo e preserva a linha', async () => {
    const response = await request(app)
      .delete('/api/v1/players/1?ignored=value')
      .send({ club_id: 999 });
    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(response.body).toEqual({});

    const row = await playerRow();
    expect(row).toMatchObject({ id: 1, nome: 'Meia Lua', clube_id: null });
    expect(row.excluido_em).toBeInstanceOf(Date);

    const byId = await request(app).get('/api/v1/players/1');
    expect(byId.status).toBe(404);
    const listed = await request(app).get('/api/v1/players');
    expect(listed.status).toBe(200);
    expect(listed.body).toMatchObject({
      data: [],
      meta: { total_items: 0, total_pages: 0 },
    });

    const again = await request(app).delete('/api/v1/players/1');
    expect(again.status).toBe(404);
    expect(again.body).toMatchObject({ message: expect.any(String) });
    expect(await playerRow()).toEqual(row);
  });

  it('jogador excluído também é inexistente no PUT', async () => {
    const removed = await request(app).delete('/api/v1/players/1');
    expect(removed.status).toBe(204);
    const before = await playerRow();
    const response = await request(app).put('/api/v1/players/1').send({
      name: 'Meia Lua',
      position: 'MEI',
      agility: 85,
      age: 26,
    });
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ message: expect.any(String) });
    expect(await playerRow()).toEqual(before);
  });

  it('recusa exclusão de jogador com clube, sem alterar a linha', async () => {
    await database.query(
      `INSERT INTO clubes (nome, nome_normalizado, nome_busca, sigla)
       VALUES ('Águias FC', 'águias fc', 'aguias fc', 'AGU')`,
    );
    await database.query('UPDATE jogadores SET clube_id = 1 WHERE id = 1');
    const before = await playerRow();

    const response = await request(app).delete('/api/v1/players/1');
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ message: expect.any(String) });
    expect(await playerRow()).toEqual(before);
    expect((await request(app).get('/api/v1/players/1')).status).toBe(200);
  });

  it.each(['abc', '0', '-1', '1.5', '01', '2147483648'])(
    'V8: id %s retorna 404 sem alteração',
    async (id) => {
      const before = await playerRow();
      const response = await request(app).delete(`/api/v1/players/${id}`);
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ message: expect.any(String) });
      expect(await playerRow()).toEqual(before);
    },
  );

  it('id de jogador inexistente retorna 404 sem alteração', async () => {
    const before = await playerRow();
    const response = await request(app).delete('/api/v1/players/999');
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ message: expect.any(String) });
    expect(await playerRow()).toEqual(before);
  });

  it('revalida clube após esperar escrita concorrente na linha', async () => {
    await database.query(
      `INSERT INTO clubes (nome, nome_normalizado, nome_busca, sigla)
       VALUES ('Águias FC', 'águias fc', 'aguias fc', 'AGU')`,
    );
    const transaction = await database.transaction();
    let committed = false;
    try {
      await database.query('SELECT id FROM jogadores WHERE id = 1 FOR UPDATE', {
        transaction,
      });
      await database.query('UPDATE jogadores SET clube_id = 1 WHERE id = 1', {
        transaction,
      });
      const pending = request(app)
        .delete('/api/v1/players/1')
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
      expect(await playerRow()).toMatchObject({
        clube_id: 1,
        excluido_em: null,
      });
    } finally {
      if (!committed) await transaction.rollback();
    }
  }, 10_000);
});
