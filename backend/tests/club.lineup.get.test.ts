import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import type { Express } from 'express';
import { Sequelize } from 'sequelize';
import request from 'supertest';
import type { PlayerCreate } from '../src/repositories/player.repository.js';

const execFileAsync = promisify(execFile);
const originalDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseName = 'passe_test_' + randomBytes(6).toString('hex');

let adminDatabase: Sequelize;
let database: Sequelize;
let app: Express;
let clubRepository: typeof import('../src/repositories/club.repository.js').clubRepository;
let lineupRepository: typeof import('../src/repositories/lineup.repository.js').lineupRepository;
let playerRepository: typeof import('../src/repositories/player.repository.js').playerRepository;

const playerData: PlayerCreate = {
  name: 'Rui Prado',
  searchName: 'rui prado',
  position: 'GOL',
  agility: 50,
  age: 25,
  baseValue: '3.00',
  pace: 50,
  shooting: 50,
  passing: 50,
  dribbling: 50,
  defending: 50,
  physical: 50,
  potential: 50,
};

type Position = PlayerCreate['position'];
type FixturePlayer = { name: string; position: Position };

beforeAll(async () => {
  if (!originalDatabaseUrl) {
    throw new Error('DATABASE_URL é necessária para os testes de integração.');
  }

  const adminUrl = new URL(originalDatabaseUrl);
  adminUrl.pathname = '/postgres';
  adminDatabase = new Sequelize(adminUrl.toString(), { logging: false });
  await adminDatabase.query('CREATE DATABASE "' + testDatabaseName + '"');

  const testUrl = new URL(originalDatabaseUrl);
  testUrl.pathname = '/' + testDatabaseName;
  process.env.DATABASE_URL = testUrl.toString();
  await execFileAsync('npm', ['run', 'db:migrate'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
  });

  ({ sequelize: database } = await import('../src/database/sequelize.js'));
  ({ app } = await import('../src/app.js'));
  ({ clubRepository } = await import('../src/repositories/club.repository.js'));
  ({ lineupRepository } =
    await import('../src/repositories/lineup.repository.js'));
  ({ playerRepository } =
    await import('../src/repositories/player.repository.js'));
}, 60_000);

afterEach(async () => {
  if (database) {
    await database.query(
      'TRUNCATE TABLE escalacoes, transacoes, contratos, jogadores, clubes RESTART IDENTITY CASCADE',
    );
  }
});

afterAll(async () => {
  if (database) await database.close();
  if (adminDatabase) {
    await adminDatabase.query(
      'DROP DATABASE IF EXISTS "' + testDatabaseName + '" WITH (FORCE)',
    );
    await adminDatabase.close();
  }
  process.env.DATABASE_URL = originalDatabaseUrl;
});

async function createClub() {
  const club = await clubRepository.create({
    name: 'Águias FC',
    normalizedName: 'águias fc',
    searchName: 'aguias fc',
    acronym: 'AGU',
  });
  return club.id;
}

async function createPlayers(
  clubId: number,
  players: readonly FixturePlayer[],
) {
  const ids: number[] = [];
  for (const { name, position } of players) {
    const player = await playerRepository.create({
      ...playerData,
      name,
      searchName: name
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Mn}/gu, ''),
      position,
    });
    expect(await playerRepository.assignToClub(player.id, clubId)).toBe(true);
    ids.push(player.id);
  }
  return ids;
}

function expectedPlayer(
  id: number,
  name: string,
  position: Position,
  clubId: number,
  condition: 'APTO' | 'MAL_CONDICIONADO' = 'APTO',
) {
  return {
    id,
    name,
    position,
    agility: 50,
    age: 25,
    condition,
    base_value: 3,
    market_value: condition === 'APTO' ? 3 : 2.55,
    pace: 50,
    shooting: 50,
    passing: 50,
    dribbling: 50,
    defending: 50,
    physical: 50,
    potential: 50,
    overall: 50,
    club_id: clubId,
  };
}

function get(clubId: number | string) {
  return request(app).get('/api/v1/clubs/' + clubId + '/lineup');
}

function put(clubId: number, formation: string, playerIds: number[]) {
  return request(app)
    .put('/api/v1/clubs/' + clubId + '/lineup')
    .send({ formation, player_ids: playerIds });
}

describe('GET /api/v1/clubs/{id}/lineup — RN19, V8, B20', () => {
  it('devolve formação nula e lista vazia para clube que nunca escalou, mesmo com elenco', async () => {
    const clubId = await createClub();
    await createPlayers(clubId, [{ name: 'Rui Prado', position: 'GOL' }]);

    const response = await get(clubId);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual({
      club_id: clubId,
      formation: null,
      complete: false,
      players: [],
    });
  });

  it('devolve somente titulares com todos os campos, na ordem de posição e nome', async () => {
    const clubId = await createClub();
    const fixture = [
      { name: 'Rui Prado', position: 'GOL' },
      { name: 'Zeca Lima', position: 'ZAG' },
      { name: 'Beto Lima', position: 'LAT' },
      { name: 'Ana Lima', position: 'LAT' },
      { name: 'Otto Rangel', position: 'ATA' },
      { name: 'Lauro Neves', position: 'MEI' },
    ] as const;
    const ids = await createPlayers(clubId, fixture);
    expect(
      await playerRepository.updateCondition(ids[2], 'MAL_CONDICIONADO'),
    ).toBe(true);
    const inputIds = [ids[4], ids[2], ids[0], ids[3], ids[1]];
    expect((await put(clubId, '3-1', inputIds)).status).toBe(200);

    const response = await get(clubId);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      club_id: clubId,
      formation: '3-1',
      complete: true,
      players: [
        expectedPlayer(ids[0], 'Rui Prado', 'GOL', clubId),
        expectedPlayer(ids[1], 'Zeca Lima', 'ZAG', clubId),
        expectedPlayer(ids[3], 'Ana Lima', 'LAT', clubId),
        expectedPlayer(ids[2], 'Beto Lima', 'LAT', clubId, 'MAL_CONDICIONADO'),
        expectedPlayer(ids[4], 'Otto Rangel', 'ATA', clubId),
      ],
    });
    expect(
      response.body.players.map((player: { id: number }) => player.id),
    ).not.toContain(ids[5]);
  });

  it('mantém a formação e mostra quatro titulares após a remoção de um vínculo', async () => {
    const clubId = await createClub();
    const fixture = [
      { name: 'Rui Prado', position: 'GOL' },
      { name: 'Zeca Lima', position: 'ZAG' },
      { name: 'Davi Lins', position: 'LAT' },
      { name: 'Lauro Neves', position: 'MEI' },
      { name: 'Otto Rangel', position: 'ATA' },
    ] as const;
    const ids = await createPlayers(clubId, fixture);
    expect((await put(clubId, '2-1-1', ids)).status).toBe(200);
    await database.transaction(async (transaction) => {
      expect(
        await lineupRepository.removeByPlayerId(ids[2], { transaction }),
      ).toBe(true);
    });

    const response = await get(clubId);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      club_id: clubId,
      formation: '2-1-1',
      complete: false,
      players: [
        expectedPlayer(ids[0], 'Rui Prado', 'GOL', clubId),
        expectedPlayer(ids[1], 'Zeca Lima', 'ZAG', clubId),
        expectedPlayer(ids[3], 'Lauro Neves', 'MEI', clubId),
        expectedPlayer(ids[4], 'Otto Rangel', 'ATA', clubId),
      ],
    });
  });

  it('mantém a formação mesmo quando não resta nenhum titular e volta a ficar completa após PUT', async () => {
    const clubId = await createClub();
    const fixture = [
      { name: 'Rui Prado', position: 'GOL' },
      { name: 'Zeca Lima', position: 'ZAG' },
      { name: 'Davi Lins', position: 'LAT' },
      { name: 'Lauro Neves', position: 'MEI' },
      { name: 'Otto Rangel', position: 'ATA' },
    ] as const;
    const ids = await createPlayers(clubId, fixture);
    expect((await put(clubId, '2-1-1', ids)).status).toBe(200);
    await database.transaction(async (transaction) => {
      for (const id of ids) {
        expect(
          await lineupRepository.removeByPlayerId(id, { transaction }),
        ).toBe(true);
      }
    });

    expect((await get(clubId)).body).toEqual({
      club_id: clubId,
      formation: '2-1-1',
      complete: false,
      players: [],
    });
    expect((await put(clubId, '2-1-1', ids)).status).toBe(200);
    const response = await get(clubId);
    expect(response.status).toBe(200);
    expect(response.body.complete).toBe(true);
    expect(
      response.body.players.map((player: { id: number }) => player.id),
    ).toEqual(ids);
  });

  it('usa os dados atuais do titular após edição e mudança para MAL_CONDICIONADO', async () => {
    const clubId = await createClub();
    const fixture = [
      { name: 'Rui Prado', position: 'GOL' },
      { name: 'Zeca Lima', position: 'ZAG' },
      { name: 'Davi Lins', position: 'LAT' },
      { name: 'Lauro Neves', position: 'MEI' },
      { name: 'Otto Rangel', position: 'ATA' },
    ] as const;
    const ids = await createPlayers(clubId, fixture);
    expect((await put(clubId, '2-1-1', ids)).status).toBe(200);
    expect(
      await playerRepository.updateProfile(ids[2], {
        name: 'Ana Costa',
        searchName: 'ana costa',
        position: 'LAT',
        agility: 80,
        age: 32,
      }),
    ).toBe(true);
    expect(
      await playerRepository.updateCondition(ids[2], 'MAL_CONDICIONADO'),
    ).toBe(true);

    const response = await get(clubId);
    expect(response.status).toBe(200);
    expect(response.body.complete).toBe(true);
    expect(response.body.players[2]).toEqual({
      ...expectedPlayer(ids[2], 'Ana Costa', 'LAT', clubId, 'MAL_CONDICIONADO'),
      agility: 80,
      age: 32,
      market_value: 2.48,
    });
  });

  it.each(['abc', '0', '-1', '1.5', '01', '2147483648', '999'])(
    'responde 404 com message para id de clube inexistente ou inválido: %s',
    async (urlId) => {
      const response = await get(urlId);
      expect(response.status).toBe(404);
      expect(response.body.message).toEqual(expect.any(String));
      expect(response.body.message.length).toBeGreaterThan(0);
    },
  );
});
