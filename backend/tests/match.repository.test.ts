import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { QueryTypes, Sequelize } from 'sequelize';
import type { ClubCreate } from '../src/repositories/club.repository.js';
import type { PlayerCreate } from '../src/repositories/player.repository.js';
import type {
  MatchCreate,
  MatchDuelCreate,
} from '../src/repositories/match.repository.js';

const execFileAsync = promisify(execFile);
const originalDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseName = `passe_test_${randomBytes(6).toString('hex')}`;
const firstTime = new Date('2026-11-12T18:00:00.000Z');
const laterTime = new Date('2026-11-13T18:00:00.000Z');

let adminDatabase: Sequelize;
let database: Sequelize;
let clubRepository: typeof import('../src/repositories/club.repository.js').clubRepository;
let playerRepository: typeof import('../src/repositories/player.repository.js').playerRepository;
let matchRepository: typeof import('../src/repositories/match.repository.js').matchRepository;

const clubs: ClubCreate[] = [
  {
    name: 'Águias FC',
    normalizedName: 'águias fc',
    searchName: 'aguias fc',
    acronym: 'AGU',
  },
  {
    name: 'Delta FC',
    normalizedName: 'delta fc',
    searchName: 'delta fc',
    acronym: 'DFC',
  },
  {
    name: 'Gama SC',
    normalizedName: 'gama sc',
    searchName: 'gama sc',
    acronym: 'GSC',
  },
];

const playerData: PlayerCreate = {
  name: 'Otto Rangel',
  searchName: 'otto rangel',
  position: 'ATA',
  agility: 85,
  age: 25,
  baseValue: '40.00',
  pace: 70,
  shooting: 75,
  passing: 68,
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
  ({ matchRepository } =
    await import('../src/repositories/match.repository.js'));
}, 60_000);

afterEach(async () => {
  if (database) {
    await database.query(
      'TRUNCATE TABLE duelos_partida, partidas, escalacoes, transacoes, contratos, jogadores, clubes RESTART IDENTITY CASCADE',
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

async function createClub(index: number) {
  return clubRepository.create(clubs[index]);
}

async function createPlayer(name: string, clubId: number) {
  const player = await playerRepository.create({
    ...playerData,
    name,
    searchName: name.toLowerCase(),
  });
  expect(await playerRepository.assignToClub(player.id, clubId)).toBe(true);
  return player.id;
}

async function createActors() {
  const home = await createClub(0);
  const away = await createClub(1);
  const homeAttacker = await createPlayer('Otto Rangel', home.id);
  const homeDefender = await createPlayer('Rui Prado', home.id);
  const awayAttacker = await createPlayer('Ugo Falcão', away.id);
  const awayDefender = await createPlayer('Ivo Teles', away.id);
  return {
    home,
    away,
    homeAttacker,
    homeDefender,
    awayAttacker,
    awayDefender,
  };
}

function matchData(
  homeClubId: number,
  awayClubId: number,
  playedAt = firstTime,
): MatchCreate {
  return {
    homeClubId,
    awayClubId,
    homeGoals: 3,
    awayGoals: 0,
    homeFormation: '2-1-1',
    awayFormation: '3-1',
    playedAt,
  };
}

function duelData(actors: Awaited<ReturnType<typeof createActors>>) {
  return Array.from({ length: 6 }, (_, index): MatchDuelCreate => {
    const order = index + 1;
    const homeAttacks = order <= 3;
    return {
      order,
      attackingClubId: homeAttacks ? actors.home.id : actors.away.id,
      attackerId: homeAttacks ? actors.homeAttacker : actors.awayAttacker,
      defenderId: homeAttacks ? actors.awayDefender : actors.homeDefender,
      attackerName: homeAttacks ? 'Otto Rangel' : 'Ugo Falcão',
      defenderName: homeAttacks ? 'Ivo Teles' : 'Rui Prado',
      attackerPosition: 'ATA',
      defenderPosition: 'GOL',
      attackerCondition: homeAttacks ? 'MAL_CONDICIONADO' : 'APTO',
      defenderCondition: 'APTO',
      attackAttribute: 'shooting',
      defenseAttribute: 'defending',
      attackValue: homeAttacks ? 43 : 55,
      defenseValue: homeAttacks ? 42 : 60,
      goal: homeAttacks,
    };
  });
}

describe('B3/RN20/RN21: persistência de partidas e duelos', () => {
  it('migra todas as colunas, tipos, PKs, FKs e ordem única por partida', async () => {
    const columns = await database.query<{
      table_name: string;
      column_name: string;
      data_type: string;
      character_maximum_length: number | null;
      is_nullable: string;
    }>(
      `SELECT table_name, column_name, data_type,
              character_maximum_length, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name IN ('partidas', 'duelos_partida')`,
      { type: QueryTypes.SELECT },
    );

    const names = (table: string) =>
      columns
        .filter((column) => column.table_name === table)
        .map((column) => column.column_name)
        .sort();
    expect(names('partidas')).toEqual(
      [
        'id',
        'mandante_id',
        'visitante_id',
        'gols_mandante',
        'gols_visitante',
        'formacao_mandante',
        'formacao_visitante',
        'jogada_em',
      ].sort(),
    );
    expect(names('duelos_partida')).toEqual(
      [
        'id',
        'partida_id',
        'ordem',
        'clube_atacante_id',
        'atacante_id',
        'defensor_id',
        'nome_atacante',
        'nome_defensor',
        'posicao_atacante',
        'posicao_defensor',
        'condicao_atacante',
        'condicao_defensor',
        'atributo_ataque',
        'atributo_defesa',
        'valor_ataque',
        'valor_defesa',
        'gol',
      ].sort(),
    );

    for (const [table, name, type, length] of [
      ['partidas', 'jogada_em', 'timestamp with time zone', null],
      ['partidas', 'formacao_mandante', 'character varying', 5],
      ['partidas', 'formacao_visitante', 'character varying', 5],
      ['duelos_partida', 'nome_atacante', 'character varying', 100],
      ['duelos_partida', 'nome_defensor', 'character varying', 100],
      ['duelos_partida', 'posicao_atacante', 'character varying', 3],
      ['duelos_partida', 'posicao_defensor', 'character varying', 3],
      ['duelos_partida', 'condicao_atacante', 'character varying', 20],
      ['duelos_partida', 'condicao_defensor', 'character varying', 20],
      ['duelos_partida', 'atributo_ataque', 'character varying', 10],
      ['duelos_partida', 'atributo_defesa', 'character varying', 10],
      ['duelos_partida', 'gol', 'boolean', null],
    ] as const) {
      expect(
        columns.find(
          (column) =>
            column.table_name === table && column.column_name === name,
        ),
      ).toMatchObject({
        data_type: type,
        character_maximum_length: length,
        is_nullable: 'NO',
      });
    }

    const constraints = await database.query<{
      table_name: string;
      type: string;
      definition: string;
    }>(
      `SELECT conrelid::regclass::text AS table_name, contype AS type,
              pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
       WHERE conrelid IN ('partidas'::regclass, 'duelos_partida'::regclass)`,
      { type: QueryTypes.SELECT },
    );
    expect(constraints).toEqual(
      expect.arrayContaining([
        { table_name: 'partidas', type: 'p', definition: 'PRIMARY KEY (id)' },
        {
          table_name: 'duelos_partida',
          type: 'p',
          definition: 'PRIMARY KEY (id)',
        },
        {
          table_name: 'duelos_partida',
          type: 'u',
          definition: 'UNIQUE (partida_id, ordem)',
        },
      ]),
    );
    for (const [table, column, target] of [
      ['partidas', 'mandante_id', 'clubes'],
      ['partidas', 'visitante_id', 'clubes'],
      ['duelos_partida', 'partida_id', 'partidas'],
      ['duelos_partida', 'clube_atacante_id', 'clubes'],
      ['duelos_partida', 'atacante_id', 'jogadores'],
      ['duelos_partida', 'defensor_id', 'jogadores'],
    ]) {
      expect(constraints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            table_name: table,
            type: 'f',
            definition: expect.stringContaining(
              `FOREIGN KEY (${column}) REFERENCES ${target}(id)`,
            ),
          }),
        ]),
      );
    }
  });

  it('grava seis snapshots em uma transação e os consulta pela ordem do duelo', async () => {
    const actors = await createActors();
    const data = matchData(actors.home.id, actors.away.id);
    const duels = duelData(actors).reverse();
    const saved = await database.transaction((transaction) =>
      matchRepository.createWithDuels(data, duels, transaction),
    );

    expect(saved).toMatchObject({
      id: 1,
      ...data,
      duels: Array.from({ length: 6 }, (_, index) => ({ order: index + 1 })),
    });
    expect(saved.playedAt.toISOString()).toBe('2026-11-12T18:00:00.000Z');
    expect(saved.duels[0]).toMatchObject({
      matchId: saved.id,
      order: 1,
      attackingClubId: actors.home.id,
      attackerId: actors.homeAttacker,
      defenderId: actors.awayDefender,
      attackerName: 'Otto Rangel',
      defenderName: 'Ivo Teles',
      attackerCondition: 'MAL_CONDICIONADO',
      attackAttribute: 'shooting',
      attackValue: 43,
      defenseAttribute: 'defending',
      defenseValue: 42,
      goal: true,
    });
    expect(await matchRepository.findByIdWithDuels(saved.id)).toEqual({
      ...saved,
      homeClubName: actors.home.name,
      awayClubName: actors.away.name,
    });
    expect(await matchRepository.findByIdWithDuels(999)).toBeNull();
  });

  it('ordena por instante e id, filtrando mandante ou visitante', async () => {
    const actors = await createActors();
    const third = await createClub(2);
    const duels = duelData(actors);
    const first = await database.transaction((transaction) =>
      matchRepository.createWithDuels(
        matchData(actors.home.id, actors.away.id),
        duels,
        transaction,
      ),
    );
    const second = await database.transaction((transaction) =>
      matchRepository.createWithDuels(
        matchData(actors.away.id, actors.home.id),
        duels,
        transaction,
      ),
    );
    const latest = await database.transaction((transaction) =>
      matchRepository.createWithDuels(
        matchData(actors.away.id, third.id, laterTime),
        duels,
        transaction,
      ),
    );

    expect((await matchRepository.list()).map(({ id }) => id)).toEqual([
      latest.id,
      second.id,
      first.id,
    ]);
    expect(
      (await matchRepository.list(actors.home.id)).map(({ id }) => id),
    ).toEqual([second.id, first.id]);
    expect((await matchRepository.list(third.id)).map(({ id }) => id)).toEqual([
      latest.id,
    ]);
    expect(await matchRepository.list(999)).toEqual([]);
    expect(await matchRepository.findByIdWithDuels(first.id)).toHaveProperty(
      'duels',
    );
    expect(await matchRepository.findByIdWithDuels(second.id)).toMatchObject({
      homeClubId: actors.away.id,
      awayClubId: actors.home.id,
      homeClubName: actors.away.name,
      awayClubName: actors.home.name,
    });
  });

  it('preserva nomes, condições e valores após mudanças e exclusão lógica', async () => {
    const actors = await createActors();
    const saved = await database.transaction((transaction) =>
      matchRepository.createWithDuels(
        matchData(actors.home.id, actors.away.id),
        duelData(actors),
        transaction,
      ),
    );

    await database.query(
      `UPDATE jogadores
       SET nome = 'Nome Alterado', condicao = 'DOENTE',
           clube_id = NULL, excluido_em = CURRENT_TIMESTAMP
       WHERE id = :playerId`,
      { replacements: { playerId: actors.homeAttacker } },
    );
    const reloaded = await matchRepository.findByIdWithDuels(saved.id);
    expect(reloaded).toEqual({
      ...saved,
      homeClubName: actors.home.name,
      awayClubName: actors.away.name,
    });
    expect(reloaded?.duels[0]).toMatchObject({
      attackerName: 'Otto Rangel',
      attackerCondition: 'MAL_CONDICIONADO',
      attackValue: 43,
    });
  });

  it('desfaz partida e duelos se a transação falhar ou repetir uma ordem', async () => {
    const actors = await createActors();
    const data = matchData(actors.home.id, actors.away.id);
    const duels = duelData(actors);

    await expect(
      database.transaction(async (transaction) => {
        await matchRepository.createWithDuels(data, duels, transaction);
        throw new Error('cancelar partida');
      }),
    ).rejects.toThrow('cancelar partida');
    expect(await matchRepository.list()).toEqual([]);

    await expect(
      database.transaction((transaction) =>
        matchRepository.createWithDuels(
          data,
          [...duels.slice(0, 5), { ...duels[5], order: 5 }],
          transaction,
        ),
      ),
    ).rejects.toMatchObject({ parent: { code: '23505' } });
    expect(await matchRepository.list()).toEqual([]);
    const duelCount = await database.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM duelos_partida',
      { type: QueryTypes.SELECT },
    );
    expect(duelCount[0].count).toBe('0');
  });

  it('recusa referências inexistentes sem deixar partida ou duelo', async () => {
    const actors = await createActors();
    const data = matchData(actors.home.id, actors.away.id);
    const duels = duelData(actors);

    await expect(
      database.transaction((transaction) =>
        matchRepository.createWithDuels(
          { ...data, awayClubId: 999 },
          duels,
          transaction,
        ),
      ),
    ).rejects.toMatchObject({ parent: { code: '23503' } });
    await expect(
      database.transaction((transaction) =>
        matchRepository.createWithDuels(
          data,
          [{ ...duels[0], attackerId: 999 }, ...duels.slice(1)],
          transaction,
        ),
      ),
    ).rejects.toMatchObject({ parent: { code: '23503' } });

    expect(await matchRepository.list()).toEqual([]);
    const duelCount = await database.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM duelos_partida',
      { type: QueryTypes.SELECT },
    );
    expect(duelCount[0].count).toBe('0');
  });
});
