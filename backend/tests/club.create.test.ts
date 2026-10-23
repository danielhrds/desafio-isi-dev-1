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

const validClub = { name: 'Águias FC', acronym: 'AGU' };

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

async function clubRows() {
  return database.query<{
    nome: string;
    nome_normalizado: string;
    nome_busca: string;
    sigla: string;
    caixa: string;
    formacao: string | null;
  }>(
    'SELECT nome, nome_normalizado, nome_busca, sigla, caixa, formacao FROM clubes ORDER BY id',
    { type: QueryTypes.SELECT },
  );
}

describe('POST /api/v1/clubs — RN10, V1–V7 e B09', () => {
  it.each([
    [
      'nome de busca expandido',
      `A${'가'.repeat(55)} BCD`,
      'ABC',
      `a${'가'.repeat(55)} bcd`,
      `a${'가'.repeat(55)} bcd`,
      'ABD',
    ],
    [
      'nome em minúsculas expandido',
      `İ${'A'.repeat(55)} BCD`,
      'IBC',
      `i\u0307${'a'.repeat(55)} bcd`,
      `i${'a'.repeat(55)} bcd`,
      'IBD',
    ],
  ])(
    'V4/RN10: preserva %s além de 60 caracteres auxiliares e mantém unicidade',
    async (
      _label,
      name,
      acronym,
      normalizedName,
      searchName,
      duplicateAcronym,
    ) => {
      const created = await request(app)
        .post('/api/v1/clubs')
        .send({ name, acronym });
      expect(created.status).toBe(201);
      expect(created.body.name).toBe(name);
      expect(await clubRows()).toEqual([
        expect.objectContaining({
          nome: name,
          nome_normalizado: normalizedName,
          nome_busca: searchName,
        }),
      ]);
      const duplicate = await request(app).post('/api/v1/clubs').send({
        name: name.toUpperCase(),
        acronym: duplicateAcronym,
      });
      expect(duplicate.status).toBe(409);
      expect(await clubRows()).toHaveLength(1);
    },
  );

  it('cria com 300 moedas, normaliza nome e ignora campos controlados', async () => {
    const response = await request(app).post('/api/v1/clubs').send({
      name: '  Águias   FC  ',
      acronym: 'AGU',
      id: 90,
      cash: 999,
      squad_value: 999,
      net_worth: 999,
      formation: '3-1',
      unknown: 'ignored',
    });

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/api/v1/clubs/1');
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual({
      id: 1,
      name: 'Águias FC',
      acronym: 'AGU',
      cash: 300,
      squad_value: 0,
      net_worth: 300,
    });
    expect(await clubRows()).toEqual([
      {
        nome: 'Águias FC',
        nome_normalizado: 'águias fc',
        nome_busca: 'aguias fc',
        sigla: 'AGU',
        caixa: '300.00',
        formacao: null,
      },
    ]);
  });

  it.each([
    ['mínimo realizável de nome', { name: 'A BC', acronym: 'ABC' }],
    ['cinco palavras', { name: 'A B C D E', acronym: 'ABC' }],
    ['acento preservado', { name: 'Épsilon FC', acronym: 'EPS' }],
    ['hífen entre letras', { name: 'Ana-Maria FC', acronym: 'AMF' }],
    ['ponto antes da primeira letra', { name: '.Águias FC', acronym: 'AGU' }],
    ['hífen antes da primeira letra', { name: '-Águias FC', acronym: 'AGU' }],
    [
      'nome de 60 pontos de código',
      { name: `A ${'B'.repeat(58)}`, acronym: 'ABB' },
    ],
  ])('aceita %s', async (_label, body) => {
    const response = await request(app).post('/api/v1/clubs').send(body);
    expect(response.status).toBe(201);
    expect(response.body.name).toBe(body.name);
    expect(await clubRows()).toHaveLength(1);
  });

  it.each([
    ['array', [validClub]],
    ['campo ausente', { name: 'Águias FC' }],
    ['campo nulo', { name: null, acronym: 'AGU' }],
    ['tipo incorreto', { name: 123, acronym: 'AGU' }],
    ['nome vazio', { name: '   ', acronym: 'AGU' }],
    ['uma palavra', { name: 'Águias', acronym: 'AGU' }],
    ['seis palavras', { name: 'A B C D E F', acronym: 'ABC' }],
    ['61 pontos de código', { name: `A ${'B'.repeat(59)}`, acronym: 'ABB' }],
    [
      '61 pontos de código suplementares',
      { name: `A${'𐐀'.repeat(57)} BC`, acronym: 'ABC' },
    ],
    ['nome com dígito', { name: 'Águias 2', acronym: 'AGU' }],
    ['controle', { name: 'Águias\tFC', acronym: 'AGU' }],
    ['palavra sem letra', { name: 'Águias -', acronym: 'AGU' }],
    ['sigla minúscula', { name: 'Águias FC', acronym: 'agu' }],
    ['sigla com acento', { name: 'Águias FC', acronym: 'ÁGU' }],
    ['sigla repetida', { name: 'A A A', acronym: 'AAA' }],
    ['primeira letra errada', { name: 'Águias FC', acronym: 'GUI' }],
    ['letras fora de ordem', { name: 'Águias FC', acronym: 'AUG' }],
    [
      'sigla camelCase',
      { name: 'Águias FC', acronym: undefined, acroNym: 'AGU' },
    ],
  ])('recusa %s sem gravar', async (_label, body) => {
    const response = await request(app).post('/api/v1/clubs').send(body);
    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body.message).toEqual(expect.any(String));
    expect(await clubRows()).toEqual([]);
  });

  it('recusa JSON malformado sem gravar', async () => {
    const response = await request(app)
      .post('/api/v1/clubs')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'JSON inválido.' });
    expect(await clubRows()).toEqual([]);
  });

  it('distingue nome com outra caixa de nome com outro acento', async () => {
    expect(
      (await request(app).post('/api/v1/clubs').send(validClub)).status,
    ).toBe(201);

    const duplicateName = await request(app).post('/api/v1/clubs').send({
      name: '  águias   fc  ',
      acronym: 'AFC',
    });
    expect(duplicateName.status).toBe(409);
    expect(duplicateName.body.message).toEqual(expect.any(String));

    const differentAccent = await request(app).post('/api/v1/clubs').send({
      name: 'Aguias FC',
      acronym: 'AGI',
    });
    expect(differentAccent.status).toBe(201);
    expect((await clubRows()).map((row) => row.nome)).toEqual([
      'Águias FC',
      'Aguias FC',
    ]);
  });

  it('recusa sigla duplicada sem gravar outro clube', async () => {
    await request(app).post('/api/v1/clubs').send(validClub);
    const response = await request(app).post('/api/v1/clubs').send({
      name: 'Aguias FC',
      acronym: 'AGU',
    });
    expect(response.status).toBe(409);
    expect(response.body.message).toEqual(expect.any(String));
    expect(await clubRows()).toHaveLength(1);
  });

  it('aceita 20 clubes e recusa o 21º sem efeitos', async () => {
    for (let index = 0; index < 20; index += 1) {
      const letter = String.fromCharCode(65 + index);
      const response = await request(app)
        .post('/api/v1/clubs')
        .send({
          name: `Clube A${letter}`,
          acronym: `CA${letter}`,
        });
      expect(response.status).toBe(201);
    }

    const rejected = await request(app).post('/api/v1/clubs').send({
      name: 'Clube AU',
      acronym: 'CAU',
    });
    expect(rejected.status).toBe(409);
    expect(rejected.body.message).toEqual(expect.any(String));
    expect(await clubRows()).toHaveLength(20);
  });

  it('sob duas criações simultâneas no limite, persiste somente uma', async () => {
    for (let index = 0; index < 19; index += 1) {
      const letter = String.fromCharCode(65 + index);
      await request(app)
        .post('/api/v1/clubs')
        .send({
          name: `Clube A${letter}`,
          acronym: `CA${letter}`,
        });
    }

    const responses = await Promise.all([
      request(app)
        .post('/api/v1/clubs')
        .send({ name: 'Clube AT', acronym: 'CAT' }),
      request(app)
        .post('/api/v1/clubs')
        .send({ name: 'Clube AU', acronym: 'CAU' }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(await clubRows()).toHaveLength(20);
  });
});
