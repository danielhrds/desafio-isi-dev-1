import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { QueryTypes, Sequelize } from 'sequelize';
import type { PlayerCreate } from '../src/repositories/player.repository.js';

const execFileAsync = promisify(execFile);
const originalDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseName = `passe_test_${randomBytes(6).toString('hex')}`;

let adminDatabase: Sequelize;
let database: Sequelize;
let playerRepository: typeof import('../src/repositories/player.repository.js').playerRepository;
let clubRepository: typeof import('../src/repositories/club.repository.js').clubRepository;

const samplePlayer: PlayerCreate = {
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
  ({ playerRepository } =
    await import('../src/repositories/player.repository.js'));
  ({ clubRepository } = await import('../src/repositories/club.repository.js'));
}, 60_000);

afterEach(async () => {
  if (database) {
    await database.query(
      'TRUNCATE TABLE jogadores, clubes RESTART IDENTITY CASCADE',
    );
  }
});

afterAll(async () => {
  if (database) {
    await database.close();
  }
  if (adminDatabase) {
    await adminDatabase.query(
      `DROP DATABASE IF EXISTS "${testDatabaseName}" WITH (FORCE)`,
    );
    await adminDatabase.close();
  }
  process.env.DATABASE_URL = originalDatabaseUrl;
});

describe('B3: migration inicial de clubes e jogadores', () => {
  it('cria as colunas exigidas, moedas NUMERIC e datas com fuso, sem derivados', async () => {
    const columns = await database.query<{
      table_name: string;
      column_name: string;
      data_type: string;
      numeric_precision: number | null;
      numeric_scale: number | null;
    }>(
      `SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name IN ('clubes', 'jogadores')`,
      { type: QueryTypes.SELECT },
    );

    const byTable = (table: string) =>
      columns
        .filter((column) => column.table_name === table)
        .map((column) => column.column_name)
        .sort();

    expect(byTable('clubes')).toEqual(
      [
        'id',
        'nome',
        'nome_normalizado',
        'nome_busca',
        'sigla',
        'caixa',
        'formacao',
        'criado_em',
      ].sort(),
    );
    expect(byTable('jogadores')).toEqual(
      [
        'id',
        'nome',
        'nome_busca',
        'posicao',
        'agilidade',
        'idade',
        'valor_base',
        'condicao',
        'clube_id',
        'velocidade',
        'finalizacao',
        'passe',
        'drible',
        'defesa',
        'fisico',
        'potencial',
        'excluido_em',
        'criado_em',
        'atualizado_em',
      ].sort(),
    );

    expect(
      columns.find((column) => column.column_name === 'valor_base'),
    ).toMatchObject({
      data_type: 'numeric',
      numeric_precision: 6,
      numeric_scale: 2,
    });
    expect(
      columns.find((column) => column.column_name === 'caixa'),
    ).toMatchObject({
      data_type: 'numeric',
      numeric_precision: 10,
      numeric_scale: 2,
    });
    expect(
      columns
        .filter((column) =>
          ['criado_em', 'atualizado_em', 'excluido_em'].includes(
            column.column_name,
          ),
        )
        .every((column) => column.data_type === 'timestamp with time zone'),
    ).toBe(true);
  });

  it('garante no banco PK, FK e unicidade do nome normalizado e da sigla', async () => {
    const constraints = await database.query<{
      table_name: string;
      constraint_type: string;
      definition: string;
    }>(
      `SELECT c.conrelid::regclass::text AS table_name,
              c.contype AS constraint_type,
              pg_get_constraintdef(c.oid) AS definition
       FROM pg_constraint c
       WHERE c.conrelid IN ('clubes'::regclass, 'jogadores'::regclass)`,
      { type: QueryTypes.SELECT },
    );

    expect(constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table_name: 'clubes',
          constraint_type: 'p',
          definition: 'PRIMARY KEY (id)',
        }),
        expect.objectContaining({
          table_name: 'jogadores',
          constraint_type: 'f',
          definition: expect.stringContaining(
            'FOREIGN KEY (clube_id) REFERENCES clubes(id)',
          ),
        }),
        expect.objectContaining({
          table_name: 'clubes',
          constraint_type: 'u',
          definition: 'UNIQUE (nome_normalizado)',
        }),
        expect.objectContaining({
          table_name: 'clubes',
          constraint_type: 'u',
          definition: 'UNIQUE (sigla)',
        }),
      ]),
    );

    await database.query(
      `INSERT INTO clubes (nome, nome_normalizado, nome_busca, sigla)
       VALUES ('Águias FC', 'águias fc', 'aguias fc', 'AGU')`,
    );
    await expect(
      database.query(
        `INSERT INTO clubes (nome, nome_normalizado, nome_busca, sigla)
         VALUES ('águias fc', 'águias fc', 'aguias fc', 'XYZ')`,
      ),
    ).rejects.toMatchObject({ parent: { code: '23505' } });
    await database.query(
      `INSERT INTO clubes (nome, nome_normalizado, nome_busca, sigla)
       VALUES ('Aguias FC', 'aguias fc', 'aguias fc', 'AGI')`,
    );
    await expect(
      database.query(
        `INSERT INTO clubes (nome, nome_normalizado, nome_busca, sigla)
         VALUES ('Delta FC', 'delta fc', 'delta fc', 'AGI')`,
      ),
    ).rejects.toMatchObject({ parent: { code: '23505' } });
  });
});

describe('locks de jogadores e FKs de duelos', () => {
  it('serializa mudanças sem bloquear o KEY SHARE usado pela FK da partida', async () => {
    const home = await clubRepository.create({
      name: 'Casa FC',
      normalizedName: 'casa fc',
      searchName: 'casa fc',
      acronym: 'CAS',
    });
    const away = await clubRepository.create({
      name: 'Visitante FC',
      normalizedName: 'visitante fc',
      searchName: 'visitante fc',
      acronym: 'VIS',
    });
    const attacker = await playerRepository.create(samplePlayer);
    const defender = await playerRepository.create({
      ...samplePlayer,
      name: 'Davi Lins',
      searchName: 'davi lins',
    });
    const [match] = await database.query<{ id: number }>(
      `INSERT INTO partidas (
         mandante_id, visitante_id, gols_mandante, gols_visitante,
         formacao_mandante, formacao_visitante, jogada_em
       ) VALUES (:homeId, :awayId, 0, 0, '2-1-1', '2-1-1', now())
       RETURNING id`,
      {
        type: QueryTypes.SELECT,
        replacements: { homeId: home.id, awayId: away.id },
      },
    );

    const playerLock = await database.transaction();
    try {
      await playerRepository.findActiveById(attacker.id, {
        transaction: playerLock,
        forNoKeyUpdate: true,
      });

      const competingUpdate = await database.transaction();
      try {
        await expect(
          database.query(
            'SELECT id FROM jogadores WHERE id = :id FOR UPDATE NOWAIT',
            {
              type: QueryTypes.SELECT,
              replacements: { id: attacker.id },
              transaction: competingUpdate,
            },
          ),
        ).rejects.toMatchObject({ parent: { code: '55P03' } });
      } finally {
        await competingUpdate.rollback();
      }

      const duelInsert = await database.transaction();
      try {
        await database.query("SET LOCAL lock_timeout = '1s'", {
          transaction: duelInsert,
        });
        await database.query(
          `INSERT INTO duelos_partida (
             partida_id, ordem, clube_atacante_id, atacante_id, defensor_id,
             nome_atacante, nome_defensor, posicao_atacante, posicao_defensor,
             condicao_atacante, condicao_defensor, atributo_ataque,
             atributo_defesa, valor_ataque, valor_defesa, gol
           ) VALUES (
             :matchId, 1, :homeId, :attackerId, :defenderId,
             'Meia Lua', 'Davi Lins', 'MEI', 'MEI', 'APTO', 'APTO',
             'passing', 'defending', 68, 55, false
           )`,
          {
            transaction: duelInsert,
            replacements: {
              matchId: match.id,
              homeId: home.id,
              attackerId: attacker.id,
              defenderId: defender.id,
            },
          },
        );
        await duelInsert.commit();
      } catch (error) {
        await duelInsert.rollback();
        throw error;
      }
    } finally {
      await playerLock.rollback();
    }
  });
});

describe('repository de jogadores', () => {
  it('cadastra jogador livre e APTO e lê o valor base com precisão decimal', async () => {
    const created = await playerRepository.create(samplePlayer);
    const found = await playerRepository.findActiveById(created.id);

    expect(created).toMatchObject({
      id: 1,
      name: 'Meia Lua',
      condition: 'APTO',
      clubId: null,
      baseValue: '40.00',
    });
    expect(found).toMatchObject({
      id: 1,
      searchName: 'meia lua',
      passing: 82,
      baseValue: '40.00',
    });

    const rows = await database.query<{
      nome: string;
      valor_base: string;
      clube_id: number | null;
    }>('SELECT nome, valor_base, clube_id FROM jogadores WHERE id = 1', {
      type: QueryTypes.SELECT,
    });
    expect(rows).toEqual([
      { nome: 'Meia Lua', valor_base: '40.00', clube_id: null },
    ]);
  });

  it('edita só o perfil, altera condição e exclui logicamente sem apagar a linha', async () => {
    const created = await playerRepository.create(samplePlayer);
    expect(
      await playerRepository.updateProfile(created.id, {
        name: 'Meia Zeta',
        searchName: 'meia zeta',
        position: 'ATA',
        agility: 80,
        age: 26,
      }),
    ).toBe(true);
    expect(await playerRepository.updateCondition(created.id, 'DOENTE')).toBe(
      true,
    );

    const updated = await playerRepository.findActiveById(created.id);
    expect(updated).toMatchObject({
      name: 'Meia Zeta',
      searchName: 'meia zeta',
      position: 'ATA',
      agility: 80,
      age: 26,
      condition: 'DOENTE',
      baseValue: '40.00',
      passing: 82,
      potential: 86,
    });

    expect(await playerRepository.softDelete(created.id)).toBe(true);
    expect(await playerRepository.findActiveById(created.id)).toBeNull();
    expect(await playerRepository.softDelete(created.id)).toBe(false);
    expect(await playerRepository.updateCondition(created.id, 'APTO')).toBe(
      false,
    );

    const archived = await database.query<{
      excluido_em: Date | null;
      condicao: string;
    }>('SELECT excluido_em, condicao FROM jogadores WHERE id = 1', {
      type: QueryTypes.SELECT,
    });
    expect(archived).toHaveLength(1);
    expect(archived[0].excluido_em).toBeInstanceOf(Date);
    expect(archived[0].condicao).toBe('DOENTE');
  });

  it('impede clube inexistente e aceita vínculo com clube existente', async () => {
    const player = await playerRepository.create(samplePlayer);
    await expect(
      database.query('UPDATE jogadores SET clube_id = 999 WHERE id = :id', {
        replacements: { id: player.id },
      }),
    ).rejects.toMatchObject({ parent: { code: '23503' } });

    await database.query(
      `INSERT INTO clubes (nome, nome_normalizado, nome_busca, sigla)
       VALUES ('Águias FC', 'águias fc', 'aguias fc', 'AGU')`,
    );
    await database.query('UPDATE jogadores SET clube_id = 1 WHERE id = :id', {
      replacements: { id: player.id },
    });
    expect(await playerRepository.findActiveById(player.id)).toMatchObject({
      clubId: 1,
    });
  });

  it('repassa a transação do service e permite rollback completo', async () => {
    const transaction = await database.transaction();
    let playerId: number;
    try {
      const player = await playerRepository.create(samplePlayer, {
        transaction,
      });
      playerId = player.id;
      expect(
        await playerRepository.findActiveById(playerId, { transaction }),
      ).not.toBeNull();
    } finally {
      await transaction.rollback();
    }

    expect(await playerRepository.findActiveById(playerId!)).toBeNull();
    const count = await database.query<{ count: string }>(
      'SELECT count(*) FROM jogadores',
      { type: QueryTypes.SELECT },
    );
    expect(count[0].count).toBe('0');
  });
});
