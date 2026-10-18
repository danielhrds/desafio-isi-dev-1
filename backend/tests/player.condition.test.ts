import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import type { Express } from 'express';
import { QueryTypes, Sequelize } from 'sequelize';
import request from 'supertest';
import type { PlayerCondition } from '../src/models/player.model.js';
import type { ClubCreate } from '../src/repositories/club.repository.js';
import type { PlayerCreate } from '../src/repositories/player.repository.js';

const execFileAsync = promisify(execFile);
const originalDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseName = `passe_test_${randomBytes(6).toString('hex')}`;

let adminDatabase: Sequelize;
let database: Sequelize;
let app: Express;
let clubRepository: typeof import('../src/repositories/club.repository.js').clubRepository;
let playerRepository: typeof import('../src/repositories/player.repository.js').playerRepository;
let lineupRepository: typeof import('../src/repositories/lineup.repository.js').lineupRepository;

const playerData: PlayerCreate = {
  name: 'Meia Lua',
  searchName: 'meia lua',
  position: 'ATA',
  agility: 85,
  age: 25,
  baseValue: '40.00',
  pace: 70,
  shooting: 68,
  passing: 82,
  dribbling: 79,
  defending: 55,
  physical: 64,
  potential: 86,
};

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
  ({ lineupRepository } =
    await import('../src/repositories/lineup.repository.js'));
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
      `DROP DATABASE IF EXISTS "${testDatabaseName}" WITH (FORCE)`,
    );
    await adminDatabase.close();
  }
  process.env.DATABASE_URL = originalDatabaseUrl;
});

async function createPlayer(
  condition: PlayerCondition = 'APTO',
  data: Partial<PlayerCreate> = {},
) {
  const player = await playerRepository.create({ ...playerData, ...data });
  if (condition !== 'APTO') {
    expect(await playerRepository.updateCondition(player.id, condition)).toBe(
      true,
    );
  }
  return player.id;
}

async function createClub() {
  const data: ClubCreate = {
    name: 'Águias FC',
    normalizedName: 'águias fc',
    searchName: 'aguias fc',
    acronym: 'AGU',
  };
  return (await clubRepository.create(data)).id;
}

async function createLineup() {
  const clubId = await createClub();
  const positions = ['GOL', 'ZAG', 'LAT', 'MEI', 'ATA'] as const;
  const names = [
    'Rui Prado',
    'Zeca Lima',
    'Davi Lins',
    'Lauro Neves',
    'Meia Lua',
  ];
  const playerIds: number[] = [];
  for (let index = 0; index < 5; index++) {
    const id = await createPlayer('APTO', {
      name: names[index],
      searchName: names[index].toLowerCase(),
      position: positions[index],
    });
    expect(await playerRepository.assignToClub(id, clubId)).toBe(true);
    playerIds.push(id);
  }
  const response = await request(app)
    .put(`/api/v1/clubs/${clubId}/lineup`)
    .send({ formation: '2-1-1', player_ids: playerIds });
  expect(response.status).toBe(200);
  return { clubId, playerIds };
}

async function playerState(id: number) {
  const rows = await database.query<{
    condicao: PlayerCondition;
    valor_base: string;
    clube_id: number | null;
    atualizado_em: Date;
  }>(
    'SELECT condicao, valor_base, clube_id, atualizado_em FROM jogadores WHERE id = :id',
    { type: QueryTypes.SELECT, replacements: { id } },
  );
  return rows[0];
}

async function lineupState(clubId: number) {
  const club = await database.query<{ formacao: string; caixa: string }>(
    'SELECT formacao, caixa FROM clubes WHERE id = :clubId',
    { type: QueryTypes.SELECT, replacements: { clubId } },
  );
  const lineup = await database.query<{ jogador_id: number }>(
    'SELECT jogador_id FROM escalacoes WHERE clube_id = :clubId ORDER BY jogador_id',
    { type: QueryTypes.SELECT, replacements: { clubId } },
  );
  return { club: club[0], playerIds: lineup.map((row) => row.jogador_id) };
}

function patch(id: number | string, body: string | object) {
  return request(app).patch(`/api/v1/players/${id}/condition`).send(body);
}

describe('PATCH /api/v1/players/{id}/condition — RN02–RN05, RN09, RN19, B04/B08/B20', () => {
  it.each([
    ['APTO', 'MAL_CONDICIONADO', 37],
    ['APTO', 'DOENTE', 34],
    ['MAL_CONDICIONADO', 'APTO', 40],
    ['MAL_CONDICIONADO', 'DOENTE', 34],
    ['DOENTE', 'MAL_CONDICIONADO', 37],
  ] as const)(
    'aceita %s → %s e devolve o jogador completo com mercado %s',
    async (from, to, marketValue) => {
      const id = await createPlayer(from);
      const response = await patch(id, {
        condition: to,
        name: 'Ignorado',
        age: 45,
        base_value: 999,
        club_id: 1,
      });
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
      expect(response.body).toEqual({
        id,
        name: 'Meia Lua',
        position: 'ATA',
        agility: 85,
        age: 25,
        condition: to,
        base_value: 40,
        market_value: marketValue,
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
      expect(await playerState(id)).toMatchObject({
        condicao: to,
        valor_base: '40.00',
        clube_id: null,
      });
    },
  );

  it.each(['APTO', 'MAL_CONDICIONADO', 'DOENTE'] as const)(
    'aceita %s repetido sem alterar atualizado_em',
    async (condition) => {
      const id = await createPlayer(condition);
      await database.query(
        "UPDATE jogadores SET atualizado_em = '2020-01-01 00:00:00+00' WHERE id = :id",
        { replacements: { id } },
      );
      const before = await playerState(id);
      const response = await patch(id, { condition });
      expect(response.status).toBe(200);
      expect(response.body.condition).toBe(condition);
      expect(await playerState(id)).toEqual(before);
    },
  );

  it('recusa DOENTE → APTO com 409 e não altera o jogador', async () => {
    const id = await createPlayer('DOENTE');
    const before = await playerState(id);
    const response = await patch(id, { condition: 'APTO' });
    expect(response.status).toBe(409);
    expect(response.body.message).toEqual(expect.any(String));
    expect(await playerState(id)).toEqual(before);
  });

  it.each([
    ['ausente', {}],
    ['nula', { condition: null }],
    ['minúscula', { condition: 'doente' }],
    ['desconhecida', { condition: 'LESIONADO' }],
    ['numérica', { condition: 1 }],
    ['booleano', { condition: true }],
    ['outro nome de campo', { Condition: 'DOENTE' }],
    ['array', []],
    ['string', 'DOENTE'],
  ] as const)('recusa condição %s com 400 sem gravar', async (_label, body) => {
    const id = await createPlayer();
    const before = await playerState(id);
    const response = await patch(id, body);
    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(expect.any(String));
    expect(await playerState(id)).toEqual(before);
  });

  it.each(['null', '10', '"DOENTE"', '{'])(
    'recusa corpo não objeto ou JSON malformado: %s',
    async (rawBody) => {
      const id = await createPlayer();
      const before = await playerState(id);
      const response = await request(app)
        .patch(`/api/v1/players/${id}/condition`)
        .set('Content-Type', 'application/json')
        .send(rawBody);
      expect(response.status).toBe(400);
      expect(response.body.message).toEqual(expect.any(String));
      expect(await playerState(id)).toEqual(before);
    },
  );

  it.each(['abc', '0', '-1', '1.5', '01', '2147483648', '999'])(
    'retorna 404 para id inválido ou inexistente: %s',
    async (urlId) => {
      const id = await createPlayer();
      const before = await playerState(id);
      const response = await patch(urlId, { condition: 'DOENTE' });
      expect(response.status).toBe(404);
      expect(response.body.message).toEqual(expect.any(String));
      expect(await playerState(id)).toEqual(before);
    },
  );

  it('retorna 404 para jogador excluído', async () => {
    const id = await createPlayer();
    expect(await playerRepository.softDelete(id)).toBe(true);
    const response = await patch(id, { condition: 'DOENTE' });
    expect(response.status).toBe(404);
    expect(response.body.message).toEqual(expect.any(String));
  });

  it('remove titular que passa a DOENTE e preserva a formação, o caixa e os demais titulares', async () => {
    const { clubId, playerIds } = await createLineup();
    const target = playerIds[4];
    const response = await patch(target, { condition: 'DOENTE' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: target,
      condition: 'DOENTE',
      market_value: 34,
      club_id: clubId,
    });
    expect(await lineupState(clubId)).toEqual({
      club: { formacao: '2-1-1', caixa: '300.00' },
      playerIds: playerIds.slice(0, 4),
    });
    const lineup = await request(app).get(`/api/v1/clubs/${clubId}/lineup`);
    expect(lineup.status).toBe(200);
    expect(lineup.body).toMatchObject({
      club_id: clubId,
      formation: '2-1-1',
      complete: false,
    });
    expect(
      lineup.body.players.map((player: { id: number }) => player.id),
    ).toEqual(playerIds.slice(0, 4));

    const recovered = await patch(target, { condition: 'MAL_CONDICIONADO' });
    expect(recovered.status).toBe(200);
    expect(await lineupState(clubId)).toEqual({
      club: { formacao: '2-1-1', caixa: '300.00' },
      playerIds: playerIds.slice(0, 4),
    });
  });

  it('mantém o titular MAL_CONDICIONADO e ignora remoção quando o doente não é titular', async () => {
    const { clubId, playerIds } = await createLineup();
    const benchId = await createPlayer();
    expect(await playerRepository.assignToClub(benchId, clubId)).toBe(true);
    const before = await lineupState(clubId);
    expect(
      (await patch(playerIds[3], { condition: 'MAL_CONDICIONADO' })).status,
    ).toBe(200);
    expect((await patch(benchId, { condition: 'DOENTE' })).status).toBe(200);
    expect(await lineupState(clubId)).toEqual(before);
  });

  it('desfaz a condição se a remoção do titular falhar', async () => {
    const { clubId, playerIds } = await createLineup();
    const target = playerIds[4];
    const beforePlayer = await playerState(target);
    const beforeLineup = await lineupState(clubId);
    const originalRemove = lineupRepository.removeByPlayerId;
    lineupRepository.removeByPlayerId = async () => {
      throw new Error('Falha simulada na remoção da escalação.');
    };
    try {
      const response = await patch(target, { condition: 'DOENTE' });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Erro interno do servidor.' });
      expect(await playerState(target)).toEqual(beforePlayer);
      expect(await lineupState(clubId)).toEqual(beforeLineup);
    } finally {
      lineupRepository.removeByPlayerId = originalRemove;
    }
  });

  it('não deixa PUT de escalação e PATCH DOENTE terminarem com titular doente', async () => {
    const clubId = await createClub();
    const positions = ['GOL', 'ZAG', 'LAT', 'MEI', 'ATA'] as const;
    const ids: number[] = [];
    for (const [index, position] of positions.entries()) {
      const id = await createPlayer('APTO', {
        name: [
          'Rui Prado',
          'Zeca Lima',
          'Davi Lins',
          'Lauro Neves',
          'Meia Lua',
        ][index],
        position,
      });
      expect(await playerRepository.assignToClub(id, clubId)).toBe(true);
      ids.push(id);
    }
    const [lineup, condition] = await Promise.all([
      request(app)
        .put(`/api/v1/clubs/${clubId}/lineup`)
        .send({ formation: '2-1-1', player_ids: ids }),
      patch(ids[4], { condition: 'DOENTE' }),
    ]);
    expect([200, 409]).toContain(lineup.status);
    expect(condition.status).toBe(200);
    expect((await playerState(ids[4])).condicao).toBe('DOENTE');
    expect((await lineupState(clubId)).playerIds).not.toContain(ids[4]);
  });
});
