import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { QueryTypes, Sequelize } from 'sequelize';
import type { ClubCreate } from '../src/repositories/club.repository.js';
import type { PlayerCreate } from '../src/repositories/player.repository.js';

const execFileAsync = promisify(execFile);
const originalDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseName = `passe_test_${randomBytes(6).toString('hex')}`;
const firstTime = new Date('2026-11-02T13:15:00.000Z');

let adminDatabase: Sequelize;
let database: Sequelize;
let clubRepository: typeof import('../src/repositories/club.repository.js').clubRepository;
let playerRepository: typeof import('../src/repositories/player.repository.js').playerRepository;
let lineupRepository: typeof import('../src/repositories/lineup.repository.js').lineupRepository;

const firstClub: ClubCreate = {
  name: 'Águias FC',
  normalizedName: 'águias fc',
  searchName: 'aguias fc',
  acronym: 'AGU',
};

const secondClub: ClubCreate = {
  name: 'Delta FC',
  normalizedName: 'delta fc',
  searchName: 'delta fc',
  acronym: 'DFC',
};

const playerData: PlayerCreate = {
  name: 'Meia Lua',
  searchName: 'meia lua',
  position: 'MEI',
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

async function createPlayer(name: string, clubId: number) {
  const player = await playerRepository.create({
    ...playerData,
    name,
    searchName: name.toLowerCase(),
  });
  expect(await playerRepository.assignToClub(player.id, clubId)).toBe(true);
  return player.id;
}

describe('B3/RN19: persistência da escalação', () => {
  it('migra as colunas, PK composta, FKs e UNIQUE por jogador exigidos', async () => {
    const columns = await database.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'escalacoes'`,
      { type: QueryTypes.SELECT },
    );
    expect(columns.map((column) => column.column_name).sort()).toEqual([
      'clube_id',
      'criado_em',
      'jogador_id',
    ]);
    expect(columns).toEqual(
      expect.arrayContaining([
        { column_name: 'clube_id', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'jogador_id', data_type: 'integer', is_nullable: 'NO' },
        {
          column_name: 'criado_em',
          data_type: 'timestamp with time zone',
          is_nullable: 'NO',
        },
      ]),
    );

    const constraints = await database.query<{
      type: string;
      definition: string;
    }>(
      `SELECT contype AS type, pg_get_constraintdef(oid) AS definition
       FROM pg_constraint WHERE conrelid = 'escalacoes'::regclass`,
      { type: QueryTypes.SELECT },
    );
    expect(constraints).toEqual(
      expect.arrayContaining([
        { type: 'p', definition: 'PRIMARY KEY (clube_id, jogador_id)' },
        { type: 'u', definition: 'UNIQUE (jogador_id)' },
        expect.objectContaining({
          type: 'f',
          definition: expect.stringContaining(
            'FOREIGN KEY (clube_id) REFERENCES clubes(id)',
          ),
        }),
        expect.objectContaining({
          type: 'f',
          definition: expect.stringContaining(
            'FOREIGN KEY (jogador_id) REFERENCES jogadores(id)',
          ),
        }),
      ]),
    );
  });

  it('lê por clube e substitui todos os vínculos usando a transação recebida', async () => {
    const club = await clubRepository.create(firstClub);
    const otherClub = await clubRepository.create(secondClub);
    const goalkeeperId = await createPlayer('Rui Prado', club.id);
    const defenderId = await createPlayer('Téo Brandão', club.id);
    const midfielderId = await createPlayer('Lauro Neves', club.id);
    await createPlayer('Otto Rangel', otherClub.id);

    const firstWriteStartedAt = Date.now();
    await database.transaction(async (transaction) => {
      await lineupRepository.replaceByClubId(
        club.id,
        [midfielderId, goalkeeperId],
        transaction,
      );
    });
    const firstWriteFinishedAt = Date.now();
    const firstRows = await lineupRepository.listByClubId(club.id);
    expect(
      firstRows.map(({ clubId, playerId }) => ({ clubId, playerId })),
    ).toEqual([
      { clubId: club.id, playerId: goalkeeperId },
      { clubId: club.id, playerId: midfielderId },
    ]);
    for (const row of firstRows) {
      expect(row.createdAt.getTime()).toBeGreaterThanOrEqual(
        firstWriteStartedAt,
      );
      expect(row.createdAt.getTime()).toBeLessThanOrEqual(firstWriteFinishedAt);
    }

    await database.transaction(async (transaction) => {
      await lineupRepository.replaceByClubId(
        club.id,
        [defenderId, midfielderId],
        transaction,
      );
    });

    const secondRows = await lineupRepository.listByClubId(club.id);
    expect(
      secondRows.map(({ clubId, playerId }) => ({ clubId, playerId })),
    ).toEqual([
      { clubId: club.id, playerId: defenderId },
      { clubId: club.id, playerId: midfielderId },
    ]);
    for (const row of secondRows) {
      expect(row.createdAt.getTime()).toBeGreaterThanOrEqual(
        firstWriteFinishedAt,
      );
    }
    expect(await lineupRepository.listByClubId(otherClub.id)).toEqual([]);
    expect(await lineupRepository.listByClubId(999)).toEqual([]);
  });

  it('remove somente o titular indicado e informa quando ele já não está escalado', async () => {
    const club = await clubRepository.create(firstClub);
    const firstPlayerId = await createPlayer('Rui Prado', club.id);
    const secondPlayerId = await createPlayer('Téo Brandão', club.id);
    await database.transaction(async (transaction) => {
      await lineupRepository.replaceByClubId(
        club.id,
        [firstPlayerId, secondPlayerId],
        transaction,
      );
    });
    const originalRows = await lineupRepository.listByClubId(club.id);

    await database.transaction(async (transaction) => {
      expect(
        await lineupRepository.removeByPlayerId(firstPlayerId, { transaction }),
      ).toBe(true);
      expect(
        await lineupRepository.removeByPlayerId(firstPlayerId, { transaction }),
      ).toBe(false);
    });
    expect(await lineupRepository.listByClubId(club.id)).toEqual(
      originalRows.filter((row) => row.playerId === secondPlayerId),
    );
  });

  it('recusa FKs inválidas e o mesmo jogador em duas escalações', async () => {
    const club = await clubRepository.create(firstClub);
    const otherClub = await clubRepository.create(secondClub);
    const firstPlayerId = await createPlayer('Rui Prado', club.id);
    const secondPlayerId = await createPlayer('Téo Brandão', otherClub.id);
    const unselectedPlayerId = await createPlayer('Lauro Neves', club.id);
    await database.transaction(async (transaction) => {
      await lineupRepository.replaceByClubId(
        club.id,
        [firstPlayerId],
        transaction,
      );
      await lineupRepository.replaceByClubId(
        otherClub.id,
        [secondPlayerId],
        transaction,
      );
    });
    const originalOtherRows = await lineupRepository.listByClubId(otherClub.id);

    await expect(
      database.transaction((transaction) =>
        lineupRepository.replaceByClubId(
          otherClub.id,
          [firstPlayerId],
          transaction,
        ),
      ),
    ).rejects.toMatchObject({ parent: { code: '23505' } });
    expect(await lineupRepository.listByClubId(otherClub.id)).toEqual(
      originalOtherRows,
    );

    for (const [clubId, playerId] of [
      [999, unselectedPlayerId],
      [club.id, 999],
    ]) {
      await expect(
        database.query(
          `INSERT INTO escalacoes (clube_id, jogador_id, criado_em)
           VALUES (:clubId, :playerId, :createdAt)`,
          { replacements: { clubId, playerId, createdAt: firstTime } },
        ),
      ).rejects.toMatchObject({ parent: { code: '23503' } });
    }
  }, 15_000);

  it('desfaz substituição e remoção de titulares se a transação falhar', async () => {
    const club = await clubRepository.create(firstClub);
    const firstPlayerId = await createPlayer('Rui Prado', club.id);
    const secondPlayerId = await createPlayer('Téo Brandão', club.id);
    await database.transaction((transaction) =>
      lineupRepository.replaceByClubId(club.id, [firstPlayerId], transaction),
    );
    const originalRows = await lineupRepository.listByClubId(club.id);

    await expect(
      database.transaction(async (transaction) => {
        await lineupRepository.replaceByClubId(
          club.id,
          [secondPlayerId],
          transaction,
        );
        await lineupRepository.removeByPlayerId(secondPlayerId, {
          transaction,
        });
        throw new Error('cancelar operação');
      }),
    ).rejects.toThrow('cancelar operação');
    expect(await lineupRepository.listByClubId(club.id)).toEqual(originalRows);
  });
});
