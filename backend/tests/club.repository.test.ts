import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { QueryTypes, Sequelize } from 'sequelize';
import type { ClubCreate } from '../src/repositories/club.repository.js';

const execFileAsync = promisify(execFile);
const originalDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseName = `passe_test_${randomBytes(6).toString('hex')}`;

let adminDatabase: Sequelize;
let database: Sequelize;
let clubRepository: typeof import('../src/repositories/club.repository.js').clubRepository;

const aguias: ClubCreate = {
  name: 'Águias FC',
  normalizedName: 'águias fc',
  searchName: 'aguias fc',
  acronym: 'AGU',
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

describe('RN10: repository de clubes', () => {
  it('cria clube com caixa padrão 300, sem formação, e preserva DECIMAL em texto', async () => {
    expect(await clubRepository.count()).toBe(0);
    expect(await clubRepository.listByName()).toEqual([]);

    const created = await clubRepository.create(aguias);
    expect(created).toMatchObject({
      id: 1,
      name: 'Águias FC',
      normalizedName: 'águias fc',
      searchName: 'aguias fc',
      acronym: 'AGU',
      cash: '300.00',
      formation: null,
    });
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(await clubRepository.findById(1)).toEqual(created);
    expect(await clubRepository.findById(2)).toBeNull();
    expect(await clubRepository.count()).toBe(1);

    const rows = await database.query<{
      nome: string;
      nome_normalizado: string;
      nome_busca: string;
      sigla: string;
      caixa: string;
      formacao: string | null;
    }>(
      'SELECT nome, nome_normalizado, nome_busca, sigla, caixa, formacao FROM clubes',
      { type: QueryTypes.SELECT },
    );
    expect(rows).toEqual([
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

  it('garante no banco nome sem diferença de caixa, com diferença de acento, e sigla única', async () => {
    await clubRepository.create(aguias);
    await expect(
      clubRepository.create({
        name: 'águias fc',
        normalizedName: 'águias fc',
        searchName: 'aguias fc',
        acronym: 'XYZ',
      }),
    ).rejects.toMatchObject({ parent: { code: '23505' } });

    await clubRepository.create({
      name: 'Aguias FC',
      normalizedName: 'aguias fc',
      searchName: 'aguias fc',
      acronym: 'AGI',
    });
    await expect(
      clubRepository.create({
        name: 'Delta FC',
        normalizedName: 'delta fc',
        searchName: 'delta fc',
        acronym: 'AGI',
      }),
    ).rejects.toMatchObject({ parent: { code: '23505' } });
    expect(await clubRepository.count()).toBe(2);
  });

  it('lista por nome de busca Unicode e desempata por id', async () => {
    for (const club of [
      {
        name: 'Épsilon FC',
        normalizedName: 'épsilon fc',
        searchName: 'epsilon fc',
        acronym: 'EPS',
      },
      aguias,
      {
        name: 'Aguias FC',
        normalizedName: 'aguias fc',
        searchName: 'aguias fc',
        acronym: 'AGI',
      },
      {
        name: 'Ana-Maria FC',
        normalizedName: 'ana-maria fc',
        searchName: 'ana-maria fc',
        acronym: 'AMF',
      },
      {
        name: 'Ana Lima FC',
        normalizedName: 'ana lima fc',
        searchName: 'ana lima fc',
        acronym: 'ALF',
      },
    ]) {
      await clubRepository.create(club);
    }

    expect(
      (await clubRepository.listByName()).map((club) => club.name),
    ).toEqual([
      'Águias FC',
      'Aguias FC',
      'Ana Lima FC',
      'Ana-Maria FC',
      'Épsilon FC',
    ]);
  });

  it('repassa transação e desfaz a criação com rollback', async () => {
    const transaction = await database.transaction();
    try {
      const club = await clubRepository.create(aguias, { transaction });
      expect(await clubRepository.count({ transaction })).toBe(1);
      expect(await clubRepository.listByName({ transaction })).toHaveLength(1);
      expect(
        await clubRepository.findById(club.id, {
          transaction,
          forUpdate: true,
        }),
      ).toMatchObject({ id: club.id, cash: '300.00' });
    } finally {
      await transaction.rollback();
    }

    expect(await clubRepository.count()).toBe(0);
    expect(await clubRepository.findById(1)).toBeNull();
  });
});
