import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import type { Express } from 'express';
import { QueryTypes, Sequelize } from 'sequelize';
import request from 'supertest';
import type { ClubCreate } from '../src/repositories/club.repository.js';
import type { PlayerCreate } from '../src/repositories/player.repository.js';
import { resetTestDatabase } from './helpers/reset-test-database.js';

const execFileAsync = promisify(execFile);
const originalDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseName = `passe_test_${randomBytes(6).toString('hex')}`;

let adminDatabase: Sequelize;
let database: Sequelize;
let app: Express;
let clubRepository: typeof import('../src/repositories/club.repository.js').clubRepository;
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

const names = [
  'Rui Prado',
  'Zeca Lima',
  'Davi Lins',
  'Lauro Neves',
  'Otto Rangel',
];

type Position = PlayerCreate['position'];

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
  ({ clubRepository } = await import('../src/repositories/club.repository.js'));
  ({ playerRepository } =
    await import('../src/repositories/player.repository.js'));
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

async function createClub(name = 'Águias FC', acronym = 'AGU') {
  const data: ClubCreate = {
    name,
    normalizedName: name.toLowerCase(),
    searchName: name
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Mn}/gu, ''),
    acronym,
  };
  return (await clubRepository.create(data)).id;
}

async function createPlayer(
  name: string,
  position: Position,
  clubId: number | null,
  condition: 'APTO' | 'MAL_CONDICIONADO' | 'DOENTE' = 'APTO',
) {
  const player = await playerRepository.create({
    ...playerData,
    name,
    searchName: name
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Mn}/gu, ''),
    position,
  });
  if (clubId !== null) {
    expect(await playerRepository.assignToClub(player.id, clubId)).toBe(true);
  }
  if (condition !== 'APTO') {
    expect(await playerRepository.updateCondition(player.id, condition)).toBe(
      true,
    );
  }
  return player.id;
}

async function createFive(
  clubId: number,
  positions: readonly Position[] = ['GOL', 'ZAG', 'LAT', 'MEI', 'ATA'],
  playerNames: readonly string[] = names,
) {
  const ids: number[] = [];
  for (let index = 0; index < 5; index++) {
    ids.push(
      await createPlayer(
        playerNames[index],
        positions[index],
        clubId,
        index === 2 ? 'MAL_CONDICIONADO' : 'APTO',
      ),
    );
  }
  return ids;
}

function put(clubId: number | string, body: Record<string, unknown>) {
  return request(app).put(`/api/v1/clubs/${clubId}/lineup`).send(body);
}

async function storedLineup(clubId: number) {
  const clubs = await database.query<{
    formacao: string | null;
    caixa: string;
  }>('SELECT formacao, caixa FROM clubes WHERE id = :clubId', {
    type: QueryTypes.SELECT,
    replacements: { clubId },
  });
  const rows = await database.query<{
    clube_id: number;
    jogador_id: number;
    criado_em: Date;
  }>(
    'SELECT clube_id, jogador_id, criado_em FROM escalacoes WHERE clube_id = :clubId ORDER BY jogador_id',
    { type: QueryTypes.SELECT, replacements: { clubId } },
  );
  return { club: clubs[0], rows };
}

const formations = [
  {
    formation: '3-1',
    positions: ['GOL', 'ZAG', 'LAT', 'LAT', 'ATA'],
    playerNames: [
      'Rui Prado',
      'Zeca Lima',
      'Ana-Lima Rosa',
      'Ana Lima Rosa',
      'Otto Rangel',
    ],
    orderedIndices: [0, 1, 3, 2, 4],
  },
  {
    formation: '2-2',
    positions: ['GOL', 'LAT', 'ZAG', 'ATA', 'ATA'],
    playerNames: names,
    orderedIndices: [0, 2, 1, 3, 4],
  },
  {
    formation: '2-1-1',
    positions: ['GOL', 'ZAG', 'LAT', 'MEI', 'ATA'],
    playerNames: names,
    orderedIndices: [0, 1, 2, 3, 4],
  },
  {
    formation: '1-2-1',
    positions: ['GOL', 'LAT', 'MEI', 'MEI', 'ATA'],
    playerNames: names,
    orderedIndices: [0, 1, 2, 3, 4],
  },
] as const;

describe('PUT /api/v1/clubs/{id}/lineup — RN19, V1–V9, B20', () => {
  it.each(formations)(
    'aceita $formation, ignora a ordem de entrada e devolve os jogadores completos na ordem RN11',
    async ({ formation, positions, playerNames, orderedIndices }) => {
      const clubId = await createClub();
      const ids = await createFive(clubId, positions, playerNames);
      const inputIds = [ids[4], ids[2], ids[0], ids[3], ids[1]];
      const response = await put(clubId, {
        formation,
        player_ids: inputIds,
        cash: 999,
        name: 'Ignorado',
      });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
      expect(response.body).toEqual({
        club_id: clubId,
        formation,
        complete: true,
        players: orderedIndices.map((index) => ({
          id: ids[index],
          name: playerNames[index],
          position: positions[index],
          agility: 50,
          age: 25,
          condition: index === 2 ? 'MAL_CONDICIONADO' : 'APTO',
          base_value: 3,
          market_value: index === 2 ? 2.55 : 3,
          pace: 50,
          shooting: 50,
          passing: 50,
          dribbling: 50,
          defending: 50,
          physical: 50,
          potential: 50,
          overall: 50,
          club_id: clubId,
        })),
      });

      const stored = await storedLineup(clubId);
      expect(stored.club).toEqual({ formacao: formation, caixa: '300.00' });
      expect(stored.rows.map((row) => row.jogador_id)).toEqual(
        [...ids].sort((a, b) => a - b),
      );
      expect(
        new Set(stored.rows.map((row) => row.criado_em.getTime())).size,
      ).toBe(1);
    },
  );

  it('substitui a formação e todos os vínculos, sem alterar o caixa', async () => {
    const clubId = await createClub();
    const ids = await createFive(clubId);
    const newDefenderId = await createPlayer('Ana Lima', 'LAT', clubId);
    expect(
      (await put(clubId, { formation: '2-1-1', player_ids: ids })).status,
    ).toBe(200);

    const replacementIds = [ids[0], ids[1], ids[2], newDefenderId, ids[4]];
    const response = await put(clubId, {
      formation: '3-1',
      player_ids: replacementIds,
    });
    expect(response.status).toBe(200);
    expect(
      response.body.players.map((player: { id: number }) => player.id),
    ).toEqual([ids[0], ids[1], newDefenderId, ids[2], ids[4]]);
    const stored = await storedLineup(clubId);
    expect(stored.club).toEqual({ formacao: '3-1', caixa: '300.00' });
    expect(stored.rows.map((row) => row.jogador_id)).toEqual(
      [...replacementIds].sort((a, b) => a - b),
    );
    expect(stored.rows.map((row) => row.jogador_id)).not.toContain(ids[3]);
  });

  it.each([
    ['formation ausente', (ids: number[]) => ({ player_ids: ids })],
    [
      'formation nula',
      (ids: number[]) => ({ formation: null, player_ids: ids }),
    ],
    [
      'formation com espaços',
      (ids: number[]) => ({ formation: ' 2-1-1 ', player_ids: ids }),
    ],
    [
      'formation desconhecida',
      (ids: number[]) => ({ formation: '4-0', player_ids: ids }),
    ],
    [
      'formation numérica',
      (ids: number[]) => ({ formation: 311, player_ids: ids }),
    ],
    [
      'nome de campo errado',
      (ids: number[]) => ({ formation: '2-1-1', playerIds: ids }),
    ],
    ['player_ids ausente', () => ({ formation: '2-1-1' })],
    ['player_ids nulo', () => ({ formation: '2-1-1', player_ids: null })],
    ['player_ids objeto', () => ({ formation: '2-1-1', player_ids: {} })],
    [
      'quatro ids',
      (ids: number[]) => ({ formation: '2-1-1', player_ids: ids.slice(0, 4) }),
    ],
    [
      'seis ids',
      (ids: number[]) => ({ formation: '2-1-1', player_ids: [...ids, 6] }),
    ],
    [
      'ids repetidos',
      (ids: number[]) => ({
        formation: '2-1-1',
        player_ids: [ids[0], ids[0], ...ids.slice(2)],
      }),
    ],
    [
      'id zero',
      (ids: number[]) => ({
        formation: '2-1-1',
        player_ids: [0, ...ids.slice(1)],
      }),
    ],
    [
      'id negativo',
      (ids: number[]) => ({
        formation: '2-1-1',
        player_ids: [-1, ...ids.slice(1)],
      }),
    ],
    [
      'id fracionário',
      (ids: number[]) => ({
        formation: '2-1-1',
        player_ids: [1.5, ...ids.slice(1)],
      }),
    ],
    [
      'id em texto',
      (ids: number[]) => ({
        formation: '2-1-1',
        player_ids: ['1', ...ids.slice(1)],
      }),
    ],
    [
      'id booleano',
      (ids: number[]) => ({
        formation: '2-1-1',
        player_ids: [true, ...ids.slice(1)],
      }),
    ],
    [
      'id nulo',
      (ids: number[]) => ({
        formation: '2-1-1',
        player_ids: [null, ...ids.slice(1)],
      }),
    ],
    [
      'id acima do inteiro do banco',
      (ids: number[]) => ({
        formation: '2-1-1',
        player_ids: [2_147_483_648, ...ids.slice(1)],
      }),
    ],
  ] as const)('recusa %s com 400 sem gravar', async (_label, bodyFor) => {
    const clubId = await createClub();
    const ids = await createFive(clubId);
    const before = await storedLineup(clubId);
    const response = await put(clubId, bodyFor(ids));
    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(expect.any(String));
    expect(response.body.message.length).toBeGreaterThan(0);
    expect(await storedLineup(clubId)).toEqual(before);
  });

  it.each(['[]', '"texto"', '10', 'null', '{'])(
    'recusa corpo JSON não objeto ou malformado: %s',
    async (rawBody) => {
      const clubId = await createClub();
      const response = await request(app)
        .put(`/api/v1/clubs/${clubId}/lineup`)
        .set('Content-Type', 'application/json')
        .send(rawBody);
      expect(response.status).toBe(400);
      expect(response.body.message).toEqual(expect.any(String));
      expect(await storedLineup(clubId)).toEqual({
        club: { formacao: null, caixa: '300.00' },
        rows: [],
      });
    },
  );

  it.each(['abc', '0', '-1', '1.5', '01', '2147483648', '999'])(
    'responde 404 para id de clube inexistente ou inválido: %s',
    async (urlId) => {
      const clubId = await createClub();
      const ids = await createFive(clubId);
      const response = await put(urlId, {
        formation: '2-1-1',
        player_ids: ids,
      });
      expect(response.status).toBe(404);
      expect(response.body.message).toEqual(expect.any(String));
      expect(await storedLineup(clubId)).toEqual({
        club: { formacao: null, caixa: '300.00' },
        rows: [],
      });
    },
  );

  it('responde 404 para jogador inexistente ou excluído, sem gravar', async () => {
    const clubId = await createClub();
    const ids = await createFive(clubId);
    const freePlayerId = await createPlayer('Ana Lima', 'LAT', null);
    expect(await playerRepository.softDelete(freePlayerId)).toBe(true);

    for (const missingId of [999, freePlayerId]) {
      const response = await put(clubId, {
        formation: '2-1-1',
        player_ids: [...ids.slice(0, 4), missingId],
      });
      expect(response.status).toBe(404);
      expect(response.body.message).toEqual(expect.any(String));
      expect(await storedLineup(clubId)).toEqual({
        club: { formacao: null, caixa: '300.00' },
        rows: [],
      });
    }
  });

  it.each(['livre', 'outro clube', 'DOENTE', 'setores errados', 'sem goleiro'])(
    'responde 409 para %s sem gravar',
    async (reason) => {
      const clubId = await createClub();
      const ids = await createFive(clubId);
      const selectedIds = [...ids];
      let formation = '2-1-1';
      if (reason === 'livre') {
        selectedIds[4] = await createPlayer('Ana Lima', 'ATA', null);
      } else if (reason === 'outro clube') {
        const otherClubId = await createClub('Delta FC', 'DFC');
        selectedIds[4] = await createPlayer('Ana Lima', 'ATA', otherClubId);
      } else if (reason === 'DOENTE') {
        expect(await playerRepository.updateCondition(ids[4], 'DOENTE')).toBe(
          true,
        );
      } else if (reason === 'setores errados') {
        formation = '3-1';
      } else {
        selectedIds[0] = await createPlayer('Ana Lima', 'MEI', clubId);
      }

      const response = await put(clubId, {
        formation,
        player_ids: selectedIds,
      });
      expect(response.status).toBe(409);
      expect(response.body.message).toEqual(expect.any(String));
      expect(await storedLineup(clubId)).toEqual({
        club: { formacao: null, caixa: '300.00' },
        rows: [],
      });
    },
  );

  it('preserva a escalação anterior quando a nova formação é inválida', async () => {
    const clubId = await createClub();
    const ids = await createFive(clubId);
    expect(
      (await put(clubId, { formation: '2-1-1', player_ids: ids })).status,
    ).toBe(200);
    const before = await storedLineup(clubId);

    const response = await put(clubId, {
      formation: '3-1',
      player_ids: ids,
    });
    expect(response.status).toBe(409);
    expect(await storedLineup(clubId)).toEqual(before);
  });

  it('faz rollback também quando uma constraint falha depois de atualizar a formação', async () => {
    const clubId = await createClub();
    const otherClubId = await createClub('Delta FC', 'DFC');
    const ids = await createFive(clubId);
    const newDefenderId = await createPlayer('Ana Lima', 'LAT', clubId);
    expect(
      (await put(clubId, { formation: '2-1-1', player_ids: ids })).status,
    ).toBe(200);
    const before = await storedLineup(clubId);
    await database.query(
      `INSERT INTO escalacoes (clube_id, jogador_id, criado_em)
       VALUES (:otherClubId, :newDefenderId, CURRENT_TIMESTAMP)`,
      { replacements: { otherClubId, newDefenderId } },
    );

    const response = await put(clubId, {
      formation: '3-1',
      player_ids: [ids[0], ids[1], ids[2], newDefenderId, ids[4]],
    });
    expect(response.status).toBe(409);
    expect(response.body.message).toEqual(expect.any(String));
    expect(await storedLineup(clubId)).toEqual(before);
    expect(
      (await storedLineup(otherClubId)).rows.map((row) => row.jogador_id),
    ).toEqual([newDefenderId]);
  });

  it('serializa dois PUTs simultâneos do mesmo clube sem misturar titulares', async () => {
    const clubId = await createClub();
    const firstIds = await createFive(clubId);
    const secondNames = [
      'Ana Lima',
      'Beto Prado',
      'Ciro Lins',
      'Eva Neves',
      'Ivo Rangel',
    ];
    const secondIds = await createFive(
      clubId,
      ['GOL', 'ZAG', 'LAT', 'MEI', 'ATA'],
      secondNames,
    );

    const [first, second] = await Promise.all([
      put(clubId, { formation: '2-1-1', player_ids: firstIds }),
      put(clubId, { formation: '2-1-1', player_ids: secondIds }),
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const stored = await storedLineup(clubId);
    expect(stored.club).toEqual({ formacao: '2-1-1', caixa: '300.00' });
    expect([
      [...firstIds].sort((a, b) => a - b).join(','),
      [...secondIds].sort((a, b) => a - b).join(','),
    ]).toContain(stored.rows.map((row) => row.jogador_id).join(','));
    expect(stored.rows).toHaveLength(5);
  });
});
