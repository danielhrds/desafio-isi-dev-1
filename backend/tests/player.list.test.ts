import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import type { Express } from 'express';
import { QueryTypes, Sequelize } from 'sequelize';
import request from 'supertest';
import { resetTestDatabase } from './helpers/reset-test-database.js';

const execFileAsync = promisify(execFile);
const originalDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseName = `passe_test_${randomBytes(6).toString('hex')}`;

let adminDatabase: Sequelize;
let database: Sequelize;
let app: Express;

interface Fixture {
  name: string;
  position?: string;
  condition?: string;
  agility?: number;
  age?: number;
  baseValue?: string;
  clubId?: number;
}

async function insertPlayer(fixture: Fixture): Promise<number> {
  const rows = await database.query<{ id: number }>(
    `INSERT INTO jogadores
      (nome, nome_busca, posicao, agilidade, idade, valor_base, condicao,
       clube_id, velocidade, finalizacao, passe, drible, defesa, fisico, potencial)
     VALUES
      (:name, :searchName, :position, :agility, :age, :baseValue, :condition,
       :clubId, 70, 68, 82, 79, 55, 64, 86)
     RETURNING id`,
    {
      type: QueryTypes.SELECT,
      replacements: {
        name: fixture.name,
        searchName: fixture.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/\p{Mn}/gu, ''),
        position: fixture.position ?? 'MEI',
        agility: fixture.agility ?? 50,
        age: fixture.age ?? 25,
        baseValue: fixture.baseValue ?? '40.00',
        condition: fixture.condition ?? 'APTO',
        clubId: fixture.clubId ?? null,
      },
    },
  );
  return rows[0].id;
}

async function insertClub(name: string, acronym: string): Promise<number> {
  const rows = await database.query<{ id: number }>(
    `INSERT INTO clubes (nome, nome_normalizado, nome_busca, sigla)
     VALUES (:name, :normalized, :searchName, :acronym) RETURNING id`,
    {
      type: QueryTypes.SELECT,
      replacements: {
        name,
        normalized: name.toLowerCase(),
        searchName: name
          .toLowerCase()
          .normalize('NFD')
          .replace(/\p{Mn}/gu, ''),
        acronym,
      },
    },
  );
  return rows[0].id;
}

beforeAll(async () => {
  if (!originalDatabaseUrl)
    throw new Error('DATABASE_URL é necessária para os testes de integração.');
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
  if (database) await resetTestDatabase(database);
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

describe('GET /api/v1/players — RN07, B07 e B17', () => {
  it('retorna lista vazia com padrões e meta zerado', async () => {
    const response = await request(app).get('/api/v1/players');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual({
      data: [],
      meta: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
    });
  });

  it('retorna os mesmos campos calculados do cadastro', async () => {
    const created = await request(app).post('/api/v1/players').send({
      name: 'Meia Lua',
      position: 'MEI',
      agility: 85,
      age: 25,
      pace: 70,
      shooting: 68,
      passing: 82,
      dribbling: 79,
      defending: 55,
      physical: 64,
      potential: 86,
    });
    expect(created.status).toBe(201);

    const listed = await request(app).get('/api/v1/players');
    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual([created.body]);
    expect(listed.body.data[0]).toMatchObject({
      base_value: 40,
      market_value: 40,
      overall: 75,
    });
  });

  it('pagina depois de ordenar e mantém o total em página além do fim', async () => {
    await database.query(
      `INSERT INTO jogadores
        (nome, nome_busca, posicao, agilidade, idade, valor_base, condicao,
         velocidade, finalizacao, passe, drible, defesa, fisico, potencial)
       SELECT 'Atleta ' || chr(64 + n), 'atleta ' || lower(chr(64 + n)),
         'MEI', 50, 25, 40.00, 'APTO', 70, 68, 82, 79, 55, 64, 86
       FROM generate_series(1, 23) AS n`,
    );

    for (const [page, expectedIds] of [
      [1, Array.from({ length: 10 }, (_, index) => index + 1)],
      [2, Array.from({ length: 10 }, (_, index) => index + 11)],
      [3, [21, 22, 23]],
      [4, []],
    ] as const) {
      const response = await request(app).get(
        `/api/v1/players?page=${page}&limit=10`,
      );
      expect(response.status).toBe(200);
      expect(
        response.body.data.map((player: { id: number }) => player.id),
      ).toEqual(expectedIds);
      expect(response.body.meta).toEqual({
        page,
        limit: 10,
        total_items: 23,
        total_pages: 3,
      });
    }

    const all = await request(app).get('/api/v1/players?limit=50');
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(23);
    expect(all.body.meta.total_pages).toBe(1);
  });

  it('busca sem acentos ou caixa e trata símbolos como texto literal', async () => {
    await insertPlayer({ name: 'João Silva' });
    await insertPlayer({ name: 'Meia Lua' });
    const joao = await request(app).get('/api/v1/players?search=joao');
    const lua = await request(app).get(
      '/api/v1/players?search=%20%20LUA%20%20',
    );
    const repeatedSpaces = await request(app).get(
      '/api/v1/players?search=Meia%20%20%20Lua',
    );
    const symbols = await request(app).get('/api/v1/players?search=%25_');

    expect(joao.status).toBe(200);
    expect(
      joao.body.data.map((player: { name: string }) => player.name),
    ).toEqual(['João Silva']);
    expect(lua.status).toBe(200);
    expect(
      lua.body.data.map((player: { name: string }) => player.name),
    ).toEqual(['Meia Lua']);
    expect(repeatedSpaces.status).toBe(200);
    expect(
      repeatedSpaces.body.data.map((player: { name: string }) => player.name),
    ).toEqual(['Meia Lua']);
    expect(symbols.status).toBe(200);
    expect(symbols.body.meta.total_items).toBe(0);
  });

  it('usa ordem Unicode do nome normalizado e id para desempate', async () => {
    const first = await insertPlayer({ name: 'Érico Silva' });
    const second = await insertPlayer({ name: 'Erico Silva' });
    await insertPlayer({ name: 'Ana-Lima Costa' });
    await insertPlayer({ name: 'Ana Lima' });

    const response = await request(app).get('/api/v1/players');
    expect(response.status).toBe(200);
    expect(
      response.body.data.map((player: { name: string }) => player.name),
    ).toEqual(['Ana Lima', 'Ana-Lima Costa', 'Érico Silva', 'Erico Silva']);
    expect(
      response.body.data.slice(2).map((player: { id: number }) => player.id),
    ).toEqual([first, second]);
  });

  it('ordena posição pela sequência GOL, ZAG, LAT, MEI, ATA', async () => {
    for (const position of ['ATA', 'MEI', 'LAT', 'ZAG', 'GOL']) {
      await insertPlayer({ name: `Atleta ${position}`, position });
    }
    const response = await request(app).get('/api/v1/players?sort=position');
    expect(response.status).toBe(200);
    expect(
      response.body.data.map((player: { position: string }) => player.position),
    ).toEqual(['GOL', 'ZAG', 'LAT', 'MEI', 'ATA']);
  });

  it('ordena por valor de mercado e usa idade, nome e id no desempate', async () => {
    await insertPlayer({ name: 'Zeta Longe', baseValue: '20.00', age: 20 });
    await insertPlayer({ name: 'Zeta Alto', baseValue: '40.00', age: 30 });
    await insertPlayer({ name: 'Beta Alto', baseValue: '40.00', age: 25 });
    await insertPlayer({ name: 'Alfa Alto', baseValue: '40.00', age: 25 });

    const response = await request(app).get(
      '/api/v1/players?sort=value_desc,age_asc',
    );
    expect(response.status).toBe(200);
    expect(
      response.body.data.map((player: { name: string }) => player.name),
    ).toEqual(['Alfa Alto', 'Beta Alto', 'Zeta Alto', 'Zeta Longe']);
    expect(
      response.body.data.map(
        (player: { market_value: number }) => player.market_value,
      ),
    ).toEqual([40, 40, 40, 22]);
  });

  it('aceita ordenação ascendente por valor e descendente por idade', async () => {
    await insertPlayer({ name: 'Alfa Menor', baseValue: '10.00', age: 20 });
    await insertPlayer({ name: 'Beta Maior', baseValue: '20.00', age: 30 });
    await insertPlayer({ name: 'Gama Medio', baseValue: '15.00', age: 25 });

    const byValue = await request(app).get('/api/v1/players?sort=value_asc');
    expect(byValue.status).toBe(200);
    expect(
      byValue.body.data.map((player: { name: string }) => player.name),
    ).toEqual(['Alfa Menor', 'Gama Medio', 'Beta Maior']);

    const byAge = await request(app).get('/api/v1/players?sort=age_desc');
    expect(byAge.status).toBe(200);
    expect(
      byAge.body.data.map((player: { name: string }) => player.name),
    ).toEqual(['Beta Maior', 'Gama Medio', 'Alfa Menor']);
  });

  it('filtra por mercado já arredondado, inclusive os limites da faixa', async () => {
    await insertPlayer({
      name: 'Meia Valor',
      baseValue: '9.50',
      condition: 'MAL_CONDICIONADO',
      agility: 85,
    });
    await insertPlayer({
      name: 'Outro Valor',
      baseValue: '9.48',
      condition: 'MAL_CONDICIONADO',
      agility: 85,
    });
    const response = await request(app).get(
      '/api/v1/players?min_value=8.79&max_value=8.79',
    );
    expect(response.status).toBe(200);
    expect(
      response.body.data.map((player: { name: string }) => player.name),
    ).toEqual(['Meia Valor']);
    expect(response.body.data[0].market_value).toBe(8.79);
    expect(response.body.meta.total_items).toBe(1);

    const minimumOnly = await request(app).get(
      '/api/v1/players?min_value=8.79',
    );
    expect(minimumOnly.status).toBe(200);
    expect(
      minimumOnly.body.data.map((player: { name: string }) => player.name),
    ).toEqual(['Meia Valor']);

    const maximumOnly = await request(app).get(
      '/api/v1/players?max_value=8.77',
    );
    expect(maximumOnly.status).toBe(200);
    expect(
      maximumOnly.body.data.map((player: { name: string }) => player.name),
    ).toEqual(['Outro Valor']);
  });

  it.each([
    ['Apto Jovem', '82.00', 'APTO', 20, 19, 90.2],
    ['Mal Rapido', '82.00', 'MAL_CONDICIONADO', 80, 21, 84.05],
    ['Mal Lento', '82.00', 'MAL_CONDICIONADO', 30, 33, 53.3],
    ['Doente Teto', '82.00', 'DOENTE', 10, 40, 49.2],
    ['Mal Arredonda', '9.50', 'MAL_CONDICIONADO', 85, 25, 8.79],
    ['Mal Piso', '1.00', 'MAL_CONDICIONADO', 50, 35, 1.0],
  ] as const)(
    'RN05: %s aparece com mercado %f',
    async (name, baseValue, condition, agility, age, expected) => {
      await insertPlayer({ name, baseValue, condition, agility, age });
      const response = await request(app).get('/api/v1/players');
      expect(response.status).toBe(200);
      expect(response.body.data[0].market_value).toBe(expected);
    },
  );

  it('combina filtros e diferencia clube vazio de inexistente', async () => {
    const clubId = await insertClub('Águias FC', 'AGU');
    const emptyClubId = await insertClub('Tubarões EC', 'TUB');
    await insertPlayer({
      name: 'João Silva',
      position: 'MEI',
      condition: 'MAL_CONDICIONADO',
      age: 25,
      agility: 85,
      clubId,
    });
    await insertPlayer({
      name: 'João Livre',
      position: 'MEI',
      condition: 'MAL_CONDICIONADO',
      age: 25,
      agility: 85,
    });
    await insertPlayer({
      name: 'João Outro',
      position: 'ATA',
      condition: 'APTO',
      age: 40,
      clubId,
    });

    const response = await request(app).get(
      `/api/v1/players?search=JOAO&position=MEI&condition=MAL_CONDICIONADO&free=false&club_id=${clubId}&min_age=25&max_age=25&min_value=37&max_value=37`,
    );
    expect(response.status).toBe(200);
    expect(
      response.body.data.map((player: { name: string }) => player.name),
    ).toEqual(['João Silva']);
    expect(response.body.data[0]).toMatchObject({
      market_value: 37,
      club_id: clubId,
    });
    expect(response.body.meta.total_items).toBe(1);

    const free = await request(app).get('/api/v1/players?free=true');
    expect(
      free.body.data.map((player: { name: string }) => player.name),
    ).toEqual(['João Livre']);
    const assigned = await request(app).get('/api/v1/players?free=false');
    expect(
      assigned.body.data.map((player: { name: string }) => player.name),
    ).toEqual(['João Outro', 'João Silva']);
    const byClub = await request(app).get(`/api/v1/players?club_id=${clubId}`);
    expect(
      byClub.body.data.map((player: { name: string }) => player.name),
    ).toEqual(['João Outro', 'João Silva']);
    const empty = await request(app).get(
      `/api/v1/players?club_id=${emptyClubId}`,
    );
    expect(empty.status).toBe(200);
    expect(empty.body).toMatchObject({ data: [], meta: { total_items: 0 } });

    const missing = await request(app).get('/api/v1/players?club_id=999');
    expect(missing.status).toBe(404);
    expect(missing.body.message).toEqual(expect.any(String));
  });

  it('ignora jogador excluído e parâmetro desconhecido', async () => {
    const deletedId = await insertPlayer({ name: 'Jogador Excluido' });
    await insertPlayer({ name: 'Jogador Ativo' });
    await database.query(
      'UPDATE jogadores SET excluido_em = NOW() WHERE id = :id',
      { replacements: { id: deletedId } },
    );
    const response = await request(app).get('/api/v1/players?unknown=anything');
    expect(response.status).toBe(200);
    expect(
      response.body.data.map((player: { name: string }) => player.name),
    ).toEqual(['Jogador Ativo']);
    expect(response.body.meta.total_items).toBe(1);
  });

  it.each([
    'search=',
    'search=a',
    'search=%20%20',
    'search=a%09b',
    'position=mei',
    'condition=doente',
    'free=TRUE',
    'club_id=01',
    'min_age=15',
    'max_age=46',
    'min_age=31&max_age=30',
    'min_value=01',
    'max_value=550.01',
    'min_value=1.234',
    'min_value=-1',
    'min_value=1e2',
    'min_value=10,5',
    'min_value=10&max_value=9',
    'free=true&club_id=1',
    'sort=POSITION',
    'sort=value_asc,value_desc',
    'sort=age_asc,age_desc',
    'sort=name,name',
    'sort=name,position,age_asc',
    'sort=position,',
    'sort=name,%20age_asc',
    'page=0',
    'page=01',
    'page=1.0',
    'page=abc',
    'limit=0',
    'limit=51',
    'limit=01',
  ])('V9: query inválida %s retorna 400', async (query) => {
    const response = await request(app).get(`/api/v1/players?${query}`);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ message: expect.any(String) });
    expect(response.body.message.length).toBeGreaterThan(0);
  });

  it('aceita limites válidos de valores, idade, página e quantidade', async () => {
    await insertPlayer({ name: 'Jogador Limite', age: 45, baseValue: '1.00' });
    const response = await request(app).get(
      '/api/v1/players?min_age=45&max_age=45&min_value=0&max_value=550&limit=1&page=1',
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta).toEqual({
      page: 1,
      limit: 1,
      total_items: 1,
      total_pages: 1,
    });
  });
});
