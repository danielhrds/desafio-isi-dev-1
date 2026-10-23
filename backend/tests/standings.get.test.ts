import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import type { Express } from 'express';
import { Sequelize } from 'sequelize';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import { resetTestDatabase } from './helpers/reset-test-database.js';

const execFileAsync = promisify(execFile);
const originalDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseName = `passe_test_${randomBytes(6).toString('hex')}`;

let adminDatabase: Sequelize;
let database: Sequelize;
let app: Express;
let clubRepository: typeof import('../src/repositories/club.repository.js').clubRepository;
let Match: typeof import('../src/models/match.model.js').Match;

beforeAll(async () => {
  if (!originalDatabaseUrl) throw new Error('DATABASE_URL é necessária.');
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
  ({ clubRepository } = await import('../src/repositories/club.repository.js'));
  ({ Match } = await import('../src/models/match.model.js'));
}, 60_000);

afterEach(async () => {
  vi.restoreAllMocks();
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

async function club(name: string, acronym: string) {
  return clubRepository.create({
    name,
    normalizedName: name.toLowerCase(),
    searchName: name
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Mn}/gu, ''),
    acronym,
  });
}

async function match(
  homeClubId: number,
  awayClubId: number,
  homeGoals: number,
  awayGoals: number,
) {
  await Match.create({
    homeClubId,
    awayClubId,
    homeGoals,
    awayGoals,
    homeFormation: '2-1-1',
    awayFormation: '2-1-1',
    playedAt: new Date('2026-11-12T18:00:00Z'),
  });
}

test('RN21/B22: sem clubes retorna 200 [] e ignora query desconhecida', async () => {
  const response = await request(app).get('/api/v1/standings?unknown=value');
  expect(response.status).toBe(200);
  expect(response.body).toEqual([]);
});

test('RN21/B22: clubes sem partidas têm estatísticas zeradas e nome/id desempata', async () => {
  const accented = await club('Águias FC', 'AGU');
  const delta = await club('Delta FC', 'DEL');
  const plain = await club('Aguias FC', 'AFC');

  const response = await request(app).get('/api/v1/standings');
  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    [accented, plain, delta].map((entry, index) => ({
      position: index + 1,
      club_id: entry.id,
      club_name: entry.name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
      goal_difference: 0,
      points: 0,
    })),
  );
});

test('RN21/B22: exemplo normativo com seis clubes e quatro partidas', async () => {
  const aguias = await club('Águias FC', 'AGU');
  const delta = await club('Delta FC', 'DEL');
  const gama = await club('Gama SC', 'GAM');
  const epsilon = await club('Épsilon EC', 'EPS');
  const mangue = await club('Mangue FC', 'MAN');
  const tubaroes = await club('Tubarões EC', 'TUB');
  await match(aguias.id, delta.id, 1, 2);
  await match(gama.id, epsilon.id, 2, 1);
  await match(epsilon.id, aguias.id, 3, 2);
  await match(delta.id, gama.id, 0, 1);

  const querySpy = vi.spyOn(database, 'query');
  const response = await request(app).get('/api/v1/standings');
  const selects = querySpy.mock.calls
    .map(([sql]) => String(sql))
    .filter((sql) => sql.trimStart().startsWith('SELECT'));
  querySpy.mockRestore();

  expect(response.status).toBe(200);
  expect(selects).toHaveLength(2);
  expect(selects[0]).toContain('FROM "clubes"');
  expect(selects[0]).not.toContain('"caixa"');
  expect(selects[0]).not.toContain('"formacao"');
  expect(selects[1]).toContain('FROM "partidas"');
  expect(selects[1]).not.toContain('duelos_partida');
  expect(selects[1]).not.toContain('jogada_em');
  expect(selects[1]).not.toContain('formacao_mandante');
  expect(response.body).toEqual([
    {
      position: 1,
      club_id: gama.id,
      club_name: 'Gama SC',
      played: 2,
      wins: 2,
      draws: 0,
      losses: 0,
      goals_for: 3,
      goals_against: 1,
      goal_difference: 2,
      points: 6,
    },
    {
      position: 2,
      club_id: epsilon.id,
      club_name: 'Épsilon EC',
      played: 2,
      wins: 1,
      draws: 0,
      losses: 1,
      goals_for: 4,
      goals_against: 4,
      goal_difference: 0,
      points: 3,
    },
    {
      position: 3,
      club_id: delta.id,
      club_name: 'Delta FC',
      played: 2,
      wins: 1,
      draws: 0,
      losses: 1,
      goals_for: 2,
      goals_against: 2,
      goal_difference: 0,
      points: 3,
    },
    {
      position: 4,
      club_id: mangue.id,
      club_name: 'Mangue FC',
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
      goal_difference: 0,
      points: 0,
    },
    {
      position: 5,
      club_id: tubaroes.id,
      club_name: 'Tubarões EC',
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
      goal_difference: 0,
      points: 0,
    },
    {
      position: 6,
      club_id: aguias.id,
      club_name: 'Águias FC',
      played: 2,
      wins: 0,
      draws: 0,
      losses: 2,
      goals_for: 3,
      goals_against: 5,
      goal_difference: -2,
      points: 0,
    },
  ]);
});

test('RN21/B22: empate e partida posterior recalculam a tabela sem persistência', async () => {
  const alpha = await club('Alpha FC', 'ALF');
  const bravo = await club('Bravo FC', 'BRV');
  await match(alpha.id, bravo.id, 2, 2);

  const drawn = await request(app).get('/api/v1/standings');
  expect(drawn.status).toBe(200);
  expect(
    drawn.body.map((row: { club_id: number; points: number }) => [
      row.club_id,
      row.points,
    ]),
  ).toEqual([
    [alpha.id, 1],
    [bravo.id, 1],
  ]);
  expect(drawn.body[0]).toMatchObject({
    played: 1,
    wins: 0,
    draws: 1,
    losses: 0,
    goals_for: 2,
    goals_against: 2,
    goal_difference: 0,
  });

  await match(bravo.id, alpha.id, 2, 1);
  const updated = await request(app).get('/api/v1/standings');
  expect(updated.status).toBe(200);
  expect(updated.body).toEqual([
    {
      position: 1,
      club_id: bravo.id,
      club_name: 'Bravo FC',
      played: 2,
      wins: 1,
      draws: 1,
      losses: 0,
      goals_for: 4,
      goals_against: 3,
      goal_difference: 1,
      points: 4,
    },
    {
      position: 2,
      club_id: alpha.id,
      club_name: 'Alpha FC',
      played: 2,
      wins: 0,
      draws: 1,
      losses: 1,
      goals_for: 3,
      goals_against: 4,
      goal_difference: -1,
      points: 1,
    },
  ]);
});
