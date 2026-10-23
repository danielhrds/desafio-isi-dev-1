import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import type { Express } from 'express';
import { DateTime } from 'luxon';
import { QueryTypes, Sequelize } from 'sequelize';
import request from 'supertest';
import { resetTestDatabase } from './helpers/reset-test-database.js';

const execFileAsync = promisify(execFile);
const originalDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseName = `passe_test_${randomBytes(6).toString('hex')}`;

let adminDatabase: Sequelize;
let database: Sequelize;
let app: Express;

const playerBody = {
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
};

function futureDate(days = 30): string {
  return DateTime.utc()
    .plus({ days })
    .setZone('UTC-3')
    .toFormat("yyyy-MM-dd'T'HH:mmZZ");
}

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
  const response = await request(app)
    .post('/api/v1/clubs')
    .send({ name, acronym });
  expect(response.status).toBe(201);
  return response.body.id as number;
}

async function createPlayer(name = 'Meia Lua') {
  const response = await request(app)
    .post('/api/v1/players')
    .send({ ...playerBody, name });
  expect(response.status).toBe(201);
  return response.body.id as number;
}

async function setPlayerValue(playerId: number, value: string) {
  await database.query(
    'UPDATE jogadores SET valor_base = :value WHERE id = :playerId',
    { replacements: { value, playerId } },
  );
}

async function setClubCash(clubId: number, cash: string) {
  await database.query('UPDATE clubes SET caixa = :cash WHERE id = :clubId', {
    replacements: { cash, clubId },
  });
}

async function snapshot(playerId: number, clubId: number) {
  const [clubs, players, contracts, entries] = await Promise.all([
    database.query<{ caixa: string }>(
      'SELECT caixa FROM clubes WHERE id = :clubId',
      { type: QueryTypes.SELECT, replacements: { clubId } },
    ),
    database.query<{ clube_id: number | null }>(
      'SELECT clube_id FROM jogadores WHERE id = :playerId',
      { type: QueryTypes.SELECT, replacements: { playerId } },
    ),
    database.query<{ id: number }>('SELECT id FROM contratos ORDER BY id', {
      type: QueryTypes.SELECT,
    }),
    database.query<{ id: number }>('SELECT id FROM transacoes ORDER BY id', {
      type: QueryTypes.SELECT,
    }),
  ]);
  return {
    cash: clubs[0]?.caixa,
    playerClubId: players[0]?.clube_id,
    contractIds: contracts.map((row) => row.id),
    transactionIds: entries.map((row) => row.id),
  };
}

function buy(playerId: number, clubId: number, loyaltyUntil = futureDate()) {
  return request(app)
    .post(`/api/v1/players/${playerId}/buy`)
    .send({ club_id: clubId, loyalty_until: loyaltyUntil });
}

describe('POST /api/v1/players/{id}/buy — RN01, RN12–RN14, V1–V9, B10–B12', () => {
  it('compra pelo mercado atual e grava caixa, jogador, contrato e snapshot na mesma operação', async () => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    await database.query(
      "UPDATE jogadores SET condicao = 'MAL_CONDICIONADO' WHERE id = :playerId",
      { replacements: { playerId } },
    );
    const loyaltyUntil = futureDate(120);
    const before = Date.now();
    const response = await buy(playerId, clubId, loyaltyUntil);
    const after = Date.now();

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual({
      id: 1,
      club_id: clubId,
      player_id: playerId,
      player_name: 'Meia Lua',
      type: 'COMPRA',
      value: 37,
      fee: 1.85,
      penalty: 0,
      profit: null,
      cash_change: -38.85,
      created_at: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/,
      ),
      contract: {
        purchase_value: 37,
        loyalty_until: `${loyaltyUntil.slice(0, 16)}:00-03:00`,
        status: 'ATIVO',
      },
      club_cash: 261.15,
    });
    expect(Date.parse(response.body.created_at)).toBeGreaterThanOrEqual(
      Math.floor(before / 1_000) * 1_000,
    );
    expect(Date.parse(response.body.created_at)).toBeLessThanOrEqual(after);
    expect(await snapshot(playerId, clubId)).toEqual({
      cash: '261.15',
      playerClubId: clubId,
      contractIds: [1],
      transactionIds: [1],
    });

    const contracts = await database.query<{
      valor_compra: string;
      fidelidade_ate: Date;
      situacao: string;
      iniciado_em: Date;
      encerrado_em: Date | null;
    }>(
      'SELECT valor_compra, fidelidade_ate, situacao, iniciado_em, encerrado_em FROM contratos',
      { type: QueryTypes.SELECT },
    );
    expect(contracts).toEqual([
      {
        valor_compra: '37.00',
        fidelidade_ate: new Date(loyaltyUntil),
        situacao: 'ATIVO',
        iniciado_em: expect.any(Date),
        encerrado_em: null,
      },
    ]);
    expect(contracts[0].iniciado_em.getTime()).toBeGreaterThanOrEqual(before);
    expect(contracts[0].iniciado_em.getTime()).toBeLessThanOrEqual(after);
    const entries = await database.query<{
      nome_jogador: string;
      valor: string;
      taxa: string;
      multa: string;
      lucro: string | null;
      variacao_caixa: string;
      criado_em: Date;
    }>(
      'SELECT nome_jogador, valor, taxa, multa, lucro, variacao_caixa, criado_em FROM transacoes',
      { type: QueryTypes.SELECT },
    );
    expect(entries).toEqual([
      {
        nome_jogador: 'Meia Lua',
        valor: '37.00',
        taxa: '1.85',
        multa: '0.00',
        lucro: null,
        variacao_caixa: '-38.85',
        criado_em: expect.any(Date),
      },
    ]);
    expect(entries[0].criado_em).toEqual(contracts[0].iniciado_em);
    expect(
      (await request(app).get(`/api/v1/players/${playerId}`)).body,
    ).toMatchObject({
      club_id: clubId,
      market_value: 37,
    });
  });

  it.each([
    ['abaixo de 30', '28.00', '300.00', 200, 28, 0, '272.00'],
    ['em 30', '30.00', '300.00', 200, 30, 0, '270.00'],
    ['acima de 30', '30.01', '300.00', 200, 30.01, 1.5, '268.49'],
    ['igual à metade', '47.62', '100.00', 200, 47.62, 2.38, '50.00'],
    ['acima da metade', '48.00', '100.00', 409, 48, 2.4, '100.00'],
    [
      'metade fracionária exata',
      '124.36',
      '261.15',
      409,
      124.36,
      6.22,
      '261.15',
    ],
  ])(
    'RN13: %s — valor %s, caixa %s',
    async (
      _label,
      value,
      cash,
      expectedStatus,
      expectedValue,
      expectedFee,
      expectedCash,
    ) => {
      const clubId = await createClub();
      const playerId = await createPlayer();
      await setPlayerValue(playerId, value);
      await setClubCash(clubId, cash);
      const before = await snapshot(playerId, clubId);

      const response = await buy(playerId, clubId);

      expect(response.status).toBe(expectedStatus);
      if (expectedStatus === 200) {
        expect(response.body).toMatchObject({
          value: expectedValue,
          fee: expectedFee,
          cash_change: -(expectedValue + expectedFee),
          club_cash: Number(expectedCash),
        });
        expect((await snapshot(playerId, clubId)).cash).toBe(expectedCash);
      } else {
        expect(response.body.message).toEqual(expect.any(String));
        expect(await snapshot(playerId, clubId)).toEqual(before);
      }
    },
  );

  it.each([
    ['APTO jovem', 'APTO', 85, 20, 44, 2.2, 253.8],
    ['MAL_CONDICIONADO ágil', 'MAL_CONDICIONADO', 85, 25, 37, 1.85, 261.15],
    ['DOENTE idoso com teto de desconto', 'DOENTE', 10, 40, 24, 0, 276],
    ['MAL_CONDICIONADO idoso e lento', 'MAL_CONDICIONADO', 30, 32, 26, 0, 274],
  ])(
    'RN02–RN05/RN12: compra %s pelo valor de mercado',
    async (_label, condition, agility, age, value, fee, cash) => {
      const clubId = await createClub();
      const playerId = await createPlayer();
      await database.query(
        `UPDATE jogadores SET condicao = :condition, agilidade = :agility,
         idade = :age WHERE id = :playerId`,
        { replacements: { condition, agility, age, playerId } },
      );

      const response = await buy(playerId, clubId);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        value,
        fee,
        club_cash: cash,
        contract: { purchase_value: value },
      });
    },
  );

  it('V7: ignora campos controlados e desconhecidos no corpo', async () => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    const response = await request(app)
      .post(`/api/v1/players/${playerId}/buy`)
      .send({
        club_id: clubId,
        loyalty_until: futureDate(),
        cash: 999,
        market_value: 1,
        fee: 0,
        condition: 'DOENTE',
        unknown: 'ignored',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      value: 40,
      fee: 2,
      club_cash: 258,
    });
    expect(await snapshot(playerId, clubId)).toMatchObject({
      cash: '258.00',
      playerClubId: clubId,
    });
  });

  it.each([
    ['corpo ausente', undefined],
    ['array', []],
    ['valor simples', 'texto'],
    ['club_id ausente', { loyalty_until: futureDate() }],
    ['club_id nulo', { club_id: null, loyalty_until: futureDate() }],
    ['club_id texto', { club_id: '1', loyalty_until: futureDate() }],
    ['club_id fracionário', { club_id: 1.5, loyalty_until: futureDate() }],
    ['club_id zero', { club_id: 0, loyalty_until: futureDate() }],
    ['club_id negativo', { club_id: -1, loyalty_until: futureDate() }],
    ['fidelidade ausente', { club_id: 1 }],
    ['fidelidade nula', { club_id: 1, loyalty_until: null }],
    ['fidelidade com outro nome', { club_id: 1, loyaltyUntil: futureDate() }],
  ])('recusa %s com 400 sem gravar nada', async (_label, body) => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    const before = await snapshot(playerId, clubId);
    const call = request(app).post(`/api/v1/players/${playerId}/buy`);
    const response = body === undefined ? await call : await call.send(body);

    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(expect.any(String));
    expect(await snapshot(playerId, clubId)).toEqual(before);
  });

  it.each([
    '2027-02-30T10:15-03:00',
    '2027-03-02T24:00-03:00',
    '2027-03-02T10:15:00-03:00',
    '2027-03-02T10:15Z',
    '2027-03-02T10:15-02:00',
    '2027-03-02T10:15',
    '2000-01-01T10:15-03:00',
    '9999-01-01T10:15-03:00',
  ])('RN01/B12: recusa fidelidade %s com 400', async (loyaltyUntil) => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    const before = await snapshot(playerId, clubId);

    const response = await buy(playerId, clubId, loyaltyUntil);

    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(expect.any(String));
    expect(await snapshot(playerId, clubId)).toEqual(before);
  });

  it('B12: aceita fidelidade até 1.095 dias e recusa 1.096 dias', async () => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    const beyondLimit = await buy(playerId, clubId, futureDate(1_096));
    expect(beyondLimit.status).toBe(400);
    expect((await snapshot(playerId, clubId)).contractIds).toEqual([]);

    const atLimit = await buy(playerId, clubId, futureDate(1_095));
    expect(atLimit.status).toBe(200);
    expect((await snapshot(playerId, clubId)).contractIds).toEqual([1]);
  });

  it('recusa JSON malformado com 400 sem gravar nada', async () => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    const before = await snapshot(playerId, clubId);

    const response = await request(app)
      .post(`/api/v1/players/${playerId}/buy`)
      .set('Content-Type', 'application/json')
      .send('{"club_id":');

    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(expect.any(String));
    expect(await snapshot(playerId, clubId)).toEqual(before);
  });

  it.each(['abc', '0', '-1', '1.5', '01', '2147483648'])(
    'V8: id de jogador %s é 404',
    async (rawId) => {
      const clubId = await createClub();
      const playerId = await createPlayer();
      const before = await snapshot(playerId, clubId);

      const response = await request(app)
        .post(`/api/v1/players/${rawId}/buy`)
        .send({ club_id: clubId, loyalty_until: futureDate() });

      expect(response.status).toBe(404);
      expect(response.body.message).toEqual(expect.any(String));
      expect(await snapshot(playerId, clubId)).toEqual(before);
    },
  );

  it('recusa jogador inexistente ou excluído com 404', async () => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    expect(
      (await request(app).delete(`/api/v1/players/${playerId}`)).status,
    ).toBe(204);
    const before = await snapshot(playerId, clubId);

    for (const id of [playerId, 999]) {
      const response = await buy(id, clubId);
      expect(response.status).toBe(404);
      expect(response.body.message).toEqual(expect.any(String));
      expect(await snapshot(playerId, clubId)).toEqual(before);
    }
  });

  it('recusa clube inexistente com 404 e jogador com clube com 409', async () => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    const before = await snapshot(playerId, clubId);

    const missingClub = await buy(playerId, 999);
    expect(missingClub.status).toBe(404);
    expect(missingClub.body.message).toEqual(expect.any(String));
    expect(await snapshot(playerId, clubId)).toEqual(before);

    await database.query(
      'UPDATE jogadores SET clube_id = :clubId WHERE id = :playerId',
      { replacements: { clubId, playerId } },
    );
    const linked = await snapshot(playerId, clubId);
    const alreadyOwned = await buy(playerId, clubId);
    expect(alreadyOwned.status).toBe(409);
    expect(alreadyOwned.body.message).toEqual(expect.any(String));
    expect(await snapshot(playerId, clubId)).toEqual(linked);
  });

  it('RN14/B11: aceita o 12º jogador e recusa o 13º sem efeitos', async () => {
    const clubId = await createClub();
    for (let index = 0; index < 11; index += 1) {
      const id = await createPlayer(
        `Reserva ${String.fromCharCode(65 + index)}lfa`,
      );
      await database.query(
        'UPDATE jogadores SET clube_id = :clubId WHERE id = :id',
        { replacements: { clubId, id } },
      );
    }
    const twelfth = await createPlayer('Décimo Segundo');
    await setPlayerValue(twelfth, '1.00');
    expect((await buy(twelfth, clubId)).status).toBe(200);
    const thirteenth = await createPlayer('Décimo Terceiro');
    const before = await snapshot(thirteenth, clubId);

    const response = await buy(thirteenth, clubId);

    expect(response.status).toBe(409);
    expect(response.body.message).toEqual(expect.any(String));
    expect(await snapshot(thirteenth, clubId)).toEqual(before);
    const rows = await database.query<{ count: string }>(
      'SELECT count(*) FROM jogadores WHERE clube_id = :clubId',
      { type: QueryTypes.SELECT, replacements: { clubId } },
    );
    expect(rows[0].count).toBe('12');
  });

  it('RN12/B16: bloqueia recompra pelo vendedor e aceita outro clube', async () => {
    const clubId = await createClub();
    const otherClubId = await createClub('Delta FC', 'DFC');
    const playerId = await createPlayer();
    await database.query(
      `INSERT INTO transacoes
       (clube_id, jogador_id, nome_jogador, tipo, valor, taxa, multa, lucro, variacao_caixa, criado_em)
       VALUES (:clubId, :playerId, 'Meia Lua', 'VENDA', 40, 0, 0, 3, 40, CURRENT_TIMESTAMP)`,
      { replacements: { clubId, playerId } },
    );
    const before = await snapshot(playerId, clubId);

    const refused = await buy(playerId, clubId);
    expect(refused.status).toBe(409);
    expect(refused.body.message).toEqual(expect.any(String));
    expect(await snapshot(playerId, clubId)).toEqual(before);

    const allowed = await buy(playerId, otherClubId);
    expect(allowed.status).toBe(200);
    expect(allowed.body.club_id).toBe(otherClubId);
  });

  it('serializa duas compras concorrentes do mesmo jogador', async () => {
    const firstClubId = await createClub();
    const secondClubId = await createClub('Delta FC', 'DFC');
    const playerId = await createPlayer();
    const loyaltyUntil = futureDate();

    const responses = await Promise.all([
      buy(playerId, firstClubId, loyaltyUntil),
      buy(playerId, secondClubId, loyaltyUntil),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const rows = await database.query<{ count: string }>(
      'SELECT count(*) FROM contratos WHERE situacao = :status',
      { type: QueryTypes.SELECT, replacements: { status: 'ATIVO' } },
    );
    expect(rows[0].count).toBe('1');
    const entries = await database.query<{ count: string }>(
      'SELECT count(*) FROM transacoes',
      { type: QueryTypes.SELECT },
    );
    expect(entries[0].count).toBe('1');
  });

  it('serializa compras de jogadores diferentes para não passar de 12 no clube', async () => {
    const clubId = await createClub();
    for (let index = 0; index < 11; index += 1) {
      const id = await createPlayer(
        `Reserva ${String.fromCharCode(65 + index)}lfa`,
      );
      await database.query(
        'UPDATE jogadores SET clube_id = :clubId WHERE id = :id',
        { replacements: { clubId, id } },
      );
    }
    const firstPlayerId = await createPlayer('Atleta Primeiro');
    const secondPlayerId = await createPlayer('Atleta Segundo');
    await setPlayerValue(firstPlayerId, '1.00');
    await setPlayerValue(secondPlayerId, '1.00');
    const loyaltyUntil = futureDate();

    const responses = await Promise.all([
      buy(firstPlayerId, clubId, loyaltyUntil),
      buy(secondPlayerId, clubId, loyaltyUntil),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const rows = await database.query<{ count: string }>(
      'SELECT count(*) FROM jogadores WHERE clube_id = :clubId',
      { type: QueryTypes.SELECT, replacements: { clubId } },
    );
    expect(rows[0].count).toBe('12');
    const entries = await database.query<{ count: string }>(
      'SELECT count(*) FROM transacoes',
      { type: QueryTypes.SELECT },
    );
    expect(entries[0].count).toBe('1');
  });

  it('desfaz todas as gravações se a transação de histórico falha', async () => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    const before = await snapshot(playerId, clubId);
    await database.query(
      "ALTER TABLE transacoes ADD CONSTRAINT reject_purchase_for_test CHECK (tipo <> 'COMPRA')",
    );

    try {
      const response = await buy(playerId, clubId);
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: expect.any(String) });
      expect(await snapshot(playerId, clubId)).toEqual(before);
    } finally {
      await database.query(
        'ALTER TABLE transacoes DROP CONSTRAINT reject_purchase_for_test',
      );
    }
  });
});
