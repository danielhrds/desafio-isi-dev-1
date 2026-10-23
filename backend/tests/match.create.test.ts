import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import type { Express } from 'express';
import { QueryTypes, Sequelize } from 'sequelize';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
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
let MatchDuel: typeof import('../src/models/match-duel.model.js').MatchDuel;

const basePlayer: PlayerCreate = {
  name: '',
  searchName: '',
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
  ({ playerRepository } =
    await import('../src/repositories/player.repository.js'));
  ({ MatchDuel } = await import('../src/models/match-duel.model.js'));
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

async function player(
  name: string,
  position: PlayerCreate['position'],
  clubId: number,
  attributes: Partial<PlayerCreate> = {},
  condition: 'APTO' | 'MAL_CONDICIONADO' = 'APTO',
) {
  const created = await playerRepository.create({
    ...basePlayer,
    ...attributes,
    name,
    searchName: name
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Mn}/gu, ''),
    position,
  });
  expect(await playerRepository.assignToClub(created.id, clubId)).toBe(true);
  if (condition !== 'APTO') {
    expect(await playerRepository.updateCondition(created.id, condition)).toBe(
      true,
    );
  }
  return created.id;
}

async function fixture(awayLineup = true) {
  const home = await club('Águias FC', 'AGU');
  const away = await club('Delta FC', 'DEL');
  const homeIds = [
    await player('Rui Prado', 'GOL', home.id, { defending: 77 }),
    await player(
      'Davi Lins',
      'LAT',
      home.id,
      { dribbling: 74, defending: 66 },
      'MAL_CONDICIONADO',
    ),
    await player('Téo Brandão', 'ZAG', home.id, { defending: 84 }),
    await player('Lauro Neves', 'MEI', home.id, { passing: 82 }),
    await player('Otto Rangel', 'ATA', home.id, { shooting: 75 }),
  ];
  const awayIds = [
    await player('Ivo Teles', 'GOL', away.id, { defending: 72 }),
    await player('Hugo Vaz', 'ZAG', away.id, { defending: 84 }),
    await player('Lino Matos', 'LAT', away.id, {
      defending: 63,
      dribbling: 79,
    }),
    await player('Nei Soares', 'MEI', away.id, { passing: 70 }),
    await player('Ugo Falcão', 'ATA', away.id, { shooting: 81 }),
  ];
  expect(
    (
      await request(app).put(`/api/v1/clubs/${home.id}/lineup`).send({
        formation: '2-1-1',
        player_ids: homeIds,
      })
    ).status,
  ).toBe(200);
  if (awayLineup) {
    expect(
      (
        await request(app).put(`/api/v1/clubs/${away.id}/lineup`).send({
          formation: '2-1-1',
          player_ids: awayIds,
        })
      ).status,
    ).toBe(200);
  }
  return { home, away, homeIds, awayIds };
}

function post(homeClubId: number, awayClubId: number) {
  return request(app).post('/api/v1/matches').send({
    home_club_id: homeClubId,
    away_club_id: awayClubId,
  });
}

async function counts() {
  const [row] = await database.query<{ matches: number; duels: number }>(
    'SELECT (SELECT count(*)::int FROM partidas) AS matches, (SELECT count(*)::int FROM duelos_partida) AS duels',
    { type: QueryTypes.SELECT },
  );
  return row;
}

test('RN20/B21: exemplo normativo 1 x 2, seis duelos, ordem e snapshot', async () => {
  const { home, away, homeIds, awayIds } = await fixture();
  const beforePlayers = await database.query<{
    id: number;
    nome: string;
    condicao: string;
  }>('SELECT id, nome, condicao FROM jogadores ORDER BY id', {
    type: QueryTypes.SELECT,
  });
  const beforeClubs = await database.query<{
    id: number;
    caixa: string;
    formacao: string;
  }>('SELECT id, caixa, formacao FROM clubes ORDER BY id', {
    type: QueryTypes.SELECT,
  });
  const beforeLineups = await database.query<{
    clube_id: number;
    jogador_id: number;
  }>(
    'SELECT clube_id, jogador_id FROM escalacoes ORDER BY clube_id, jogador_id',
    { type: QueryTypes.SELECT },
  );

  const response = await post(home.id, away.id);
  expect(response.status).toBe(201);
  expect(response.headers['content-type']).toMatch(/application\/json/);
  expect(response.headers.location).toBe(`/api/v1/matches/${response.body.id}`);
  expect(response.body.played_at).toMatch(
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d-03:00$/,
  );
  expect(response.body).toMatchObject({
    home: {
      club_id: home.id,
      club_name: home.name,
      formation: '2-1-1',
      goals: 1,
    },
    away: {
      club_id: away.id,
      club_name: away.name,
      formation: '2-1-1',
      goals: 2,
    },
    result: 'VISITANTE',
  });
  expect(response.body.duels).toHaveLength(6);
  expect(
    response.body.duels.map(
      (duel: {
        order: number;
        attacking_club_id: number;
        attacker: { player_id: number };
        defender: { player_id: number };
        goal: boolean;
      }) => [
        duel.order,
        duel.attacking_club_id,
        duel.attacker.player_id,
        duel.defender.player_id,
        duel.goal,
      ],
    ),
  ).toEqual([
    [1, home.id, homeIds[4], awayIds[0], true],
    [2, home.id, homeIds[3], awayIds[1], false],
    [3, home.id, homeIds[1], awayIds[2], false],
    [4, away.id, awayIds[4], homeIds[0], true],
    [5, away.id, awayIds[3], homeIds[2], false],
    [6, away.id, awayIds[2], homeIds[1], true],
  ]);
  expect(
    response.body.duels.map(
      (duel: {
        attacker: { attribute: string; value: number };
        defender: { value: number };
      }) => [duel.attacker.attribute, duel.attacker.value, duel.defender.value],
    ),
  ).toEqual([
    ['shooting', 75, 72],
    ['passing', 82, 84],
    ['dribbling', 63, 63],
    ['shooting', 81, 77],
    ['passing', 70, 84],
    ['dribbling', 79, 56],
  ]);
  expect(response.body.duels[2]).toMatchObject({
    attacker: {
      player_name: 'Davi Lins',
      position: 'LAT',
      condition: 'MAL_CONDICIONADO',
      attribute: 'dribbling',
      value: 63,
    },
    defender: {
      player_name: 'Lino Matos',
      position: 'LAT',
      condition: 'APTO',
      attribute: 'defending',
      value: 63,
    },
    goal: false,
  });
  expect(await counts()).toEqual({ matches: 1, duels: 6 });
  expect(
    await database.query(
      'SELECT id, nome, condicao FROM jogadores ORDER BY id',
      { type: QueryTypes.SELECT },
    ),
  ).toEqual(beforePlayers);
  expect(
    await database.query('SELECT id, caixa, formacao FROM clubes ORDER BY id', {
      type: QueryTypes.SELECT,
    }),
  ).toEqual(beforeClubs);
  expect(
    await database.query(
      'SELECT clube_id, jogador_id FROM escalacoes ORDER BY clube_id, jogador_id',
      { type: QueryTypes.SELECT },
    ),
  ).toEqual(beforeLineups);
});

test.each([
  [{ home_club_id: 1 }, 400],
  [{ away_club_id: 2 }, 400],
  [{ home_club_id: null, away_club_id: 2 }, 400],
  [{ home_club_id: '1', away_club_id: 2 }, 400],
  [{ home_club_id: 1.5, away_club_id: 2 }, 400],
  [{ home_club_id: 0, away_club_id: 2 }, 400],
  [{ home_club_id: -1, away_club_id: 2 }, 400],
  [{ home_club_id: 2147483648, away_club_id: 2 }, 400],
  [{ home_club_id: 1, away_club_id: 1 }, 400],
  [[], 400],
  [42, 400],
])(
  'RN20/V1-V2/V6: corpo inválido %j é recusado sem gravar',
  async (body, status) => {
    const response = await request(app)
      .post('/api/v1/matches')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(body));
    expect(response.status).toBe(status);
    expect(response.body.message).toEqual(expect.any(String));
    expect(await counts()).toEqual({ matches: 0, duels: 0 });
  },
);

test('RN20/V1: JSON malformado é 400 sem efeitos', async () => {
  const response = await request(app)
    .post('/api/v1/matches')
    .set('Content-Type', 'application/json')
    .send('{"home_club_id":');
  expect(response.status).toBe(400);
  expect(response.body.message).toEqual(expect.any(String));
  expect(await counts()).toEqual({ matches: 0, duels: 0 });
});

test('RN20/V7: campos extras são ignorados e confronto pode se repetir', async () => {
  const { home, away } = await fixture();
  const first = await request(app).post('/api/v1/matches').send({
    home_club_id: home.id,
    away_club_id: away.id,
    played_at: '2000-01-01T00:00:00-03:00',
    result: 'MANDANTE',
    duels: [],
  });
  const second = await post(home.id, away.id);
  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
  expect(first.body.played_at).not.toBe('2000-01-01T00:00:00-03:00');
  expect(second.body.id).toBe(first.body.id + 1);
  expect(await counts()).toEqual({ matches: 2, duels: 12 });
});

test('RN20: metade 50 × 0,85 vira 43 e pode resultar em EMPATE', async () => {
  const { home, away, homeIds, awayIds } = await fixture();
  await database.query('UPDATE jogadores SET drible = 50 WHERE id = :id', {
    replacements: { id: homeIds[1] },
  });
  await database.query('UPDATE jogadores SET defesa = 42 WHERE id = :id', {
    replacements: { id: awayIds[2] },
  });
  const response = await post(home.id, away.id);
  expect(response.status).toBe(201);
  expect(response.body).toMatchObject({
    home: { goals: 2 },
    away: { goals: 2 },
    result: 'EMPATE',
  });
  expect(response.body.duels[2]).toMatchObject({
    attacker: { value: 43 },
    defender: { value: 42 },
    goal: true,
  });
});

test('RN20: vitória do mandante também é calculada pelo placar', async () => {
  const { home, away, awayIds } = await fixture();
  await database.query('UPDATE jogadores SET finalizacao = 70 WHERE id = :id', {
    replacements: { id: awayIds[4] },
  });
  await database.query('UPDATE jogadores SET drible = 50 WHERE id = :id', {
    replacements: { id: awayIds[2] },
  });
  const response = await post(home.id, away.id);
  expect(response.status).toBe(201);
  expect(response.body).toMatchObject({
    home: { goals: 1 },
    away: { goals: 0 },
    result: 'MANDANTE',
  });
});

test('RN20/B21: dois ATA seguem nome normalizado antes do id no 2-2', async () => {
  const { home, away, awayIds } = await fixture();
  const ariId = await player('Ari Souza', 'ATA', away.id, { shooting: 73 });
  const lineup = await request(app)
    .put(`/api/v1/clubs/${away.id}/lineup`)
    .send({
      formation: '2-2',
      player_ids: [awayIds[0], awayIds[1], awayIds[2], awayIds[4], ariId],
    });
  expect(lineup.status).toBe(200);
  const response = await post(home.id, away.id);
  expect(response.status).toBe(201);
  expect(response.body.away.formation).toBe('2-2');
  expect(response.body.duels[3].attacker).toMatchObject({
    player_id: awayIds[4],
    player_name: 'Ugo Falcão',
    attribute: 'shooting',
    value: 81,
  });
  expect(response.body.duels[4].attacker).toMatchObject({
    player_id: ariId,
    player_name: 'Ari Souza',
    attribute: 'shooting',
    value: 73,
  });
});

test('RN20: nomes, condições, valores e formações persistidos não mudam após edição', async () => {
  const { home, away, homeIds } = await fixture();
  const created = await post(home.id, away.id);
  expect(created.status).toBe(201);
  await database.query(
    'UPDATE jogadores SET nome = :name, finalizacao = 1 WHERE id = :id',
    { replacements: { name: 'Nome Novo', id: homeIds[4] } },
  );
  await database.query(
    'UPDATE clubes SET formacao = :formation WHERE id = :id',
    {
      replacements: { formation: '3-1', id: home.id },
    },
  );
  const stored = await database.query<{
    gols_mandante: number;
    formacao_mandante: string;
    nome_atacante: string;
    valor_ataque: number;
    condicao_atacante: string;
  }>(
    `SELECT p.gols_mandante, p.formacao_mandante, d.nome_atacante,
            d.valor_ataque, d.condicao_atacante
     FROM partidas p JOIN duelos_partida d ON d.partida_id = p.id
     WHERE p.id = :id AND d.ordem = 1`,
    { type: QueryTypes.SELECT, replacements: { id: created.body.id } },
  );
  expect(stored[0]).toEqual({
    gols_mandante: 1,
    formacao_mandante: '2-1-1',
    nome_atacante: 'Otto Rangel',
    valor_ataque: 75,
    condicao_atacante: 'APTO',
  });
});

test('RN20/B21: clube inexistente e escalação incompleta geram 404/409 sem efeitos', async () => {
  const { home, away } = await fixture(false);
  for (const [homeId, awayId, status] of [
    [home.id, 999, 404],
    [999, away.id, 404],
    [home.id, away.id, 409],
    [away.id, home.id, 409],
  ]) {
    const response = await post(homeId, awayId);
    expect(response.status).toBe(status);
    expect(response.body.message).toEqual(expect.any(String));
    if (status === 409) expect(response.body.club_id).toBe(away.id);
    expect(await counts()).toEqual({ matches: 0, duels: 0 });
  }
});

test('RN20/B21: titular DOENTE removido torna a escalação incompleta', async () => {
  const { home, away, homeIds } = await fixture();
  const condition = await request(app)
    .patch(`/api/v1/players/${homeIds[4]}/condition`)
    .send({ condition: 'DOENTE' });
  expect(condition.status).toBe(200);
  const response = await post(home.id, away.id);
  expect(response.status).toBe(409);
  expect(await counts()).toEqual({ matches: 0, duels: 0 });
});

test('RN20/B2: falha ao gravar duelos reverte a partida', async () => {
  const { home, away } = await fixture();
  vi.spyOn(MatchDuel, 'bulkCreate').mockRejectedValueOnce(
    new Error('falha simulada'),
  );
  const response = await post(home.id, away.id);
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ message: 'Erro interno do servidor.' });
  expect(await counts()).toEqual({ matches: 0, duels: 0 });
});

test('RN20: dois confrontos simultâneos com mandantes invertidos não entram em deadlock', async () => {
  const { home, away } = await fixture();
  const responses = await Promise.all([
    post(home.id, away.id),
    post(away.id, home.id),
  ]);
  expect(responses.map((response) => response.status)).toEqual([201, 201]);
  expect(await counts()).toEqual({ matches: 2, duels: 12 });
}, 20_000);

test('RN20: partida aguarda bloqueio do clube e lê a escalação após a alteração', async () => {
  const { home, away, homeIds } = await fixture();
  const transaction = await database.transaction();
  let committed = false;
  try {
    await database.query('SELECT id FROM clubes WHERE id = :id FOR UPDATE', {
      replacements: { id: home.id },
      transaction,
    });
    let settled = false;
    const matchPromise = post(home.id, away.id).then((response) => {
      settled = true;
      return response;
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(settled).toBe(false);
    await database.query('DELETE FROM escalacoes WHERE jogador_id = :id', {
      replacements: { id: homeIds[4] },
      transaction,
    });
    await transaction.commit();
    committed = true;
    const response = await matchPromise;
    expect(response.status).toBe(409);
    expect(await counts()).toEqual({ matches: 0, duels: 0 });
  } finally {
    if (!committed) await transaction.rollback();
  }
}, 20_000);

test('RN21/B22: GET da partida devolve o mesmo formato do POST e seis duelos em ordem', async () => {
  const { home, away, homeIds, awayIds } = await fixture();
  const created = await post(home.id, away.id);
  expect(created.status).toBe(201);

  const querySpy = vi.spyOn(database, 'query');
  const response = await request(app).get(created.headers.location);
  const selects = querySpy.mock.calls
    .map(([sql]) => String(sql))
    .filter((sql) => sql.trimStart().startsWith('SELECT'));
  querySpy.mockRestore();

  expect(response.status).toBe(200);
  expect(selects).toHaveLength(2);
  expect(selects[0]).toContain('JOIN "clubes" AS "homeClub"');
  expect(selects[0]).toContain('JOIN "clubes" AS "awayClub"');
  expect(response.headers['content-type']).toMatch(/application\/json/);
  expect(response.body).toEqual(created.body);
  expect(response.body).toMatchObject({
    home: {
      club_id: home.id,
      club_name: home.name,
      formation: '2-1-1',
      goals: 1,
    },
    away: {
      club_id: away.id,
      club_name: away.name,
      formation: '2-1-1',
      goals: 2,
    },
    result: 'VISITANTE',
  });
  expect(
    response.body.duels.map((duel: { order: number }) => duel.order),
  ).toEqual([1, 2, 3, 4, 5, 6]);
  expect(response.body.duels[0]).toMatchObject({
    attacking_club_id: home.id,
    attacker: { player_id: homeIds[4], player_name: 'Otto Rangel', value: 75 },
    defender: { player_id: awayIds[0], player_name: 'Ivo Teles', value: 72 },
    goal: true,
  });
  expect(await counts()).toEqual({ matches: 1, duels: 6 });
});

test('RN20/RN21: GET preserva nomes, condição, valores e formação da partida após mudanças', async () => {
  const { home, away, homeIds } = await fixture();
  const created = await post(home.id, away.id);
  expect(created.status).toBe(201);

  await database.query(
    `UPDATE jogadores
     SET nome = :name, condicao = 'DOENTE', finalizacao = 1,
         clube_id = NULL, excluido_em = CURRENT_TIMESTAMP
     WHERE id = :id`,
    { replacements: { name: 'Nome Novo', id: homeIds[4] } },
  );
  await database.query(`UPDATE clubes SET formacao = '3-1' WHERE id = :id`, {
    replacements: { id: home.id },
  });

  const response = await request(app).get(`/api/v1/matches/${created.body.id}`);
  expect(response.status).toBe(200);
  expect(response.body).toEqual(created.body);
  expect(response.body.home.formation).toBe('2-1-1');
  expect(response.body.duels[0].attacker).toMatchObject({
    player_name: 'Otto Rangel',
    condition: 'APTO',
    value: 75,
  });
  expect(await counts()).toEqual({ matches: 1, duels: 6 });
});

test.each(['abc', '0', '-1', '01', '1.5', '2147483648', '999'])(
  'RN21/V8: GET /matches/%s responde 404 com message sem gravar',
  async (id) => {
    const response = await request(app).get(`/api/v1/matches/${id}`);
    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body.message).toEqual(expect.any(String));
    expect(await counts()).toEqual({ matches: 0, duels: 0 });
  },
);

test('RN21/B22: lista vazia e filtro de clube existente sem partidas retornam 200 []', async () => {
  const empty = await request(app).get('/api/v1/matches/');
  expect(empty.status).toBe(200);
  expect(empty.body).toEqual([]);

  const unused = await club('Gama SC', 'GAM');
  const filtered = await request(app).get(
    `/api/v1/matches?club_id=${unused.id}`,
  );
  expect(filtered.status).toBe(200);
  expect(filtered.body).toEqual([]);

  const missing = await request(app).get('/api/v1/matches?club_id=999');
  expect(missing.status).toBe(404);
  expect(missing.body).toEqual({ message: 'Clube não encontrado.' });
  expect(await counts()).toEqual({ matches: 0, duels: 0 });
});

test('RN21/B22: lista por data e id, filtra mandante/visitante e mantém o snapshot', async () => {
  const { home, away } = await fixture();
  const third = await club('Gama SC', 'GAM');
  const thirdIds = await Promise.all(
    (['GOL', 'ZAG', 'LAT', 'MEI', 'ATA'] as const).map((position, index) =>
      player(`Gama ${index + 1}`, position, third.id),
    ),
  );
  const lineup = await request(app)
    .put(`/api/v1/clubs/${third.id}/lineup`)
    .send({ formation: '2-1-1', player_ids: thirdIds });
  expect(lineup.status).toBe(200);

  const first = await post(home.id, away.id);
  const second = await post(away.id, home.id);
  const latest = await post(third.id, home.id);
  expect([first.status, second.status, latest.status]).toEqual([201, 201, 201]);
  await database.query(
    'UPDATE partidas SET jogada_em = :playedAt WHERE id IN (:ids)',
    {
      replacements: {
        playedAt: '2026-11-12T18:00:00Z',
        ids: [first.body.id, second.body.id],
      },
    },
  );
  await database.query(
    'UPDATE partidas SET jogada_em = :playedAt WHERE id = :id',
    {
      replacements: {
        playedAt: '2026-11-13T18:00:00Z',
        id: latest.body.id,
      },
    },
  );
  await database.query(`UPDATE clubes SET formacao = '3-1' WHERE id = :id`, {
    replacements: { id: home.id },
  });

  const querySpy = vi.spyOn(database, 'query');
  const response = await request(app).get('/api/v1/matches');
  const selects = querySpy.mock.calls
    .map(([sql]) => String(sql))
    .filter((sql) => sql.trimStart().startsWith('SELECT'));
  querySpy.mockRestore();

  expect(response.status).toBe(200);
  expect(response.body.map((match: { id: number }) => match.id)).toEqual([
    latest.body.id,
    second.body.id,
    first.body.id,
  ]);
  expect(selects).toHaveLength(1);
  expect(selects[0]).toContain('JOIN "clubes" AS "homeClub"');
  expect(selects[0]).toContain('JOIN "clubes" AS "awayClub"');
  expect(response.body[0]).toMatchObject({
    played_at: '2026-11-13T15:00:00-03:00',
    home: { club_id: third.id, club_name: third.name },
    away: { club_id: home.id, club_name: home.name },
  });
  expect(response.body[2]).toEqual({
    id: first.body.id,
    played_at: '2026-11-12T15:00:00-03:00',
    home: {
      club_id: home.id,
      club_name: home.name,
      formation: '2-1-1',
      goals: 1,
    },
    away: {
      club_id: away.id,
      club_name: away.name,
      formation: '2-1-1',
      goals: 2,
    },
    result: 'VISITANTE',
  });
  expect(response.body.every((match: object) => !('duels' in match))).toBe(
    true,
  );

  const filtered = await request(app).get(`/api/v1/matches?club_id=${away.id}`);
  expect(filtered.status).toBe(200);
  expect(filtered.body.map((match: { id: number }) => match.id)).toEqual([
    second.body.id,
    first.body.id,
  ]);
  const thirdOnly = await request(app).get(
    `/api/v1/matches?club_id=${third.id}`,
  );
  expect(thirdOnly.status).toBe(200);
  expect(thirdOnly.body.map((match: { id: number }) => match.id)).toEqual([
    latest.body.id,
  ]);
  const unknownParameter = await request(app).get(
    '/api/v1/matches?sort=unknown',
  );
  expect(unknownParameter.status).toBe(200);
  expect(
    unknownParameter.body.map((match: { id: number }) => match.id),
  ).toEqual([latest.body.id, second.body.id, first.body.id]);
  expect(await counts()).toEqual({ matches: 3, duels: 18 });
});

test.each(['', '0', '01', '-1', '+1', '1.5', '1e2', 'abc', '2147483648'])(
  'RN21/V8: club_id=%s inválido retorna 400 sem alterar partidas',
  async (clubId) => {
    const response = await request(app).get(
      `/api/v1/matches?club_id=${encodeURIComponent(clubId)}`,
    );
    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(expect.any(String));
    expect(await counts()).toEqual({ matches: 0, duels: 0 });
  },
);

test('RN21/B22: classificação reflete partida criada pelo POST', async () => {
  const { home, away } = await fixture();
  const created = await post(home.id, away.id);
  expect(created.status).toBe(201);

  const response = await request(app).get('/api/v1/standings');
  expect(response.status).toBe(200);
  expect(response.body).toEqual([
    {
      position: 1,
      club_id: away.id,
      club_name: away.name,
      played: 1,
      wins: 1,
      draws: 0,
      losses: 0,
      goals_for: 2,
      goals_against: 1,
      goal_difference: 1,
      points: 3,
    },
    {
      position: 2,
      club_id: home.id,
      club_name: home.name,
      played: 1,
      wins: 0,
      draws: 0,
      losses: 1,
      goals_for: 1,
      goals_against: 2,
      goal_difference: -1,
      points: 0,
    },
  ]);
  expect(await counts()).toEqual({ matches: 1, duels: 6 });
});
