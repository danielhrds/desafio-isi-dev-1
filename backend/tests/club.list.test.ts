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
    await database.query(
      'TRUNCATE TABLE jogadores, clubes RESTART IDENTITY CASCADE',
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

async function createClub(name: string, acronym: string): Promise<number> {
  const response = await request(app)
    .post('/api/v1/clubs')
    .send({ name, acronym });
  expect(response.status).toBe(201);
  return response.body.id as number;
}

async function insertPlayer(
  clubId: number,
  overrides: {
    name?: string;
    baseValue?: string;
    condition?: 'APTO' | 'MAL_CONDICIONADO' | 'DOENTE';
    agility?: number;
    age?: number;
    rating?: number;
  } = {},
): Promise<number> {
  const name = overrides.name ?? 'Meia Lua';
  const rows = await database.query<{ id: number }>(
    `INSERT INTO jogadores
       (nome, nome_busca, posicao, agilidade, idade, valor_base, condicao,
        clube_id, velocidade, finalizacao, passe, drible, defesa, fisico, potencial)
     VALUES
       (:name, :searchName, 'MEI', :agility, :age, :baseValue, :condition,
        :clubId, :pace, :shooting, :passing, :dribbling, :defending, :physical, :potential)
     RETURNING id`,
    {
      type: QueryTypes.SELECT,
      replacements: {
        name,
        searchName: name.toLowerCase(),
        agility: overrides.agility ?? 85,
        age: overrides.age ?? 25,
        baseValue: overrides.baseValue ?? '40.00',
        condition: overrides.condition ?? 'APTO',
        clubId,
        pace: overrides.rating ?? 70,
        shooting: overrides.rating ?? 68,
        passing: overrides.rating ?? 82,
        dribbling: overrides.rating ?? 79,
        defending: overrides.rating ?? 55,
        physical: overrides.rating ?? 64,
        potential: overrides.rating ?? 86,
      },
    },
  );
  return rows[0].id;
}

describe('GET /api/v1/clubs — RN11, B09 e B17', () => {
  it('devolve array vazio com 200 e JSON', async () => {
    const response = await request(app).get('/api/v1/clubs');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual([]);
  });

  it('lista os campos mínimos sem incluir elenco ou campos internos', async () => {
    await createClub('Águias FC', 'AGU');
    const response = await request(app).get('/api/v1/clubs');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: 1,
        name: 'Águias FC',
        acronym: 'AGU',
        cash: 300,
        squad_value: 0,
        net_worth: 300,
      },
    ]);
  });

  it('soma valores de mercado atuais e caixa com precisão decimal', async () => {
    const clubId = await createClub('Águias FC', 'AGU');
    await database.query(
      'UPDATE clubes SET caixa = 261.15 WHERE id = :clubId',
      {
        replacements: { clubId },
      },
    );
    await insertPlayer(clubId, {
      name: 'Meia Lua',
      condition: 'MAL_CONDICIONADO',
      agility: 85,
      age: 25,
    });
    const secondId = await insertPlayer(clubId, {
      name: 'Meia Sol',
      condition: 'DOENTE',
      agility: 30,
      age: 32,
    });

    const first = await request(app).get('/api/v1/clubs');
    expect(first.status).toBe(200);
    expect(first.body).toEqual([
      {
        id: clubId,
        name: 'Águias FC',
        acronym: 'AGU',
        cash: 261.15,
        squad_value: 61,
        net_worth: 322.15,
      },
    ]);

    await database.query(
      `UPDATE jogadores SET condicao = 'APTO', idade = 25 WHERE id = :id`,
      { replacements: { id: secondId } },
    );
    const second = await request(app).get('/api/v1/clubs');
    expect(second.body[0]).toMatchObject({
      squad_value: 77,
      net_worth: 338.15,
    });
  });

  it('soma os valores de mercado já arredondados de cada jogador', async () => {
    const clubId = await createClub('Águias FC', 'AGU');
    for (const name of ['Meia Lua', 'Meia Sol', 'Meia Mar']) {
      await insertPlayer(clubId, {
        name,
        baseValue: '1.50',
        condition: 'MAL_CONDICIONADO',
        agility: 80,
        rating: 43,
      });
    }

    // Cada jogador vale 1,50 × 0,925 = 1,3875 → 1,39; 3 × 1,39 = 4,17.
    const response = await request(app).get('/api/v1/clubs');
    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({
      cash: 300,
      squad_value: 4.17,
      net_worth: 304.17,
    });
  });

  it('não inclui jogador excluído logicamente no valor do elenco', async () => {
    const clubId = await createClub('Águias FC', 'AGU');
    const playerId = await insertPlayer(clubId, { baseValue: '40.00' });
    await database.query(
      'UPDATE jogadores SET excluido_em = NOW() WHERE id = :playerId',
      { replacements: { playerId } },
    );

    const response = await request(app).get('/api/v1/clubs');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: clubId,
        name: 'Águias FC',
        acronym: 'AGU',
        cash: 300,
        squad_value: 0,
        net_worth: 300,
      },
    ]);
  });

  it.each([
    ['sem sort', '', ['Águias FC', 'Aguias FC', 'Delta FC', 'Épsilon FC']],
    [
      'name',
      '?sort=name',
      ['Águias FC', 'Aguias FC', 'Delta FC', 'Épsilon FC'],
    ],
    [
      'net_worth_asc',
      '?sort=net_worth_asc',
      ['Delta FC', 'Águias FC', 'Aguias FC', 'Épsilon FC'],
    ],
    [
      'net_worth_desc',
      '?sort=net_worth_desc',
      ['Águias FC', 'Aguias FC', 'Épsilon FC', 'Delta FC'],
    ],
  ])(
    'ordena por %s com desempate por nome e id',
    async (_label, query, names) => {
      await createClub('Águias FC', 'AGU');
      await createClub('Aguias FC', 'AGI');
      const deltaId = await createClub('Delta FC', 'DLF');
      const epsilonId = await createClub('Épsilon FC', 'EPS');
      await database.query('UPDATE clubes SET caixa = 250 WHERE id = :id', {
        replacements: { id: deltaId },
      });
      await database.query('UPDATE clubes SET caixa = 290 WHERE id = :id', {
        replacements: { id: epsilonId },
      });
      await insertPlayer(deltaId, { baseValue: '40.00' });
      await insertPlayer(epsilonId, { name: 'Meia Sol', baseValue: '10.00' });

      const response = await request(app).get(`/api/v1/clubs${query}`);
      expect(response.status).toBe(200);
      expect(response.body.map((club: { name: string }) => club.name)).toEqual(
        names,
      );
      expect(
        response.body.find(
          (club: { name: string }) => club.name === 'Delta FC',
        ),
      ).toMatchObject({ cash: 250, squad_value: 40, net_worth: 290 });
    },
  );

  it.each([
    'NAME',
    'net_worth',
    'name,net_worth_desc',
    'net_worth_desc,net_worth_asc',
    '',
  ])('recusa sort inválido %j com 400', async (sort) => {
    await createClub('Águias FC', 'AGU');
    const response = await request(app).get('/api/v1/clubs').query({ sort });
    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(expect.any(String));
    expect(
      await database.query<{ count: string }>('SELECT count(*) FROM clubes', {
        type: QueryTypes.SELECT,
      }),
    ).toEqual([{ count: '1' }]);
  });
});
