import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import type { Express } from 'express';
import { DateTime } from 'luxon';
import { QueryTypes, Sequelize } from 'sequelize';
import request, { type Response } from 'supertest';
import { resetTestDatabase } from './helpers/reset-test-database.js';

const execFileAsync = promisify(execFile);
const originalDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseName = `passe_test_${randomBytes(6).toString('hex')}`;
const day = 86_400_000;
const csvHeader =
  'data_hora;tipo;jogador;valor;taxa_ou_comissao;multa;lucro;variacao_caixa\n';

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

let adminDatabase: Sequelize;
let database: Sequelize;
let app: Express;
let transactionRepository: typeof import('../src/repositories/transaction.repository.js').transactionRepository;

function futureDate(days = 120): string {
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
  ({ transactionRepository } =
    await import('../src/repositories/transaction.repository.js'));
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

async function createClub(name = 'Águias FC', acronym = 'AGU') {
  const response = await request(app)
    .post('/api/v1/clubs')
    .send({ name, acronym });
  expect(response.status).toBe(201);
  return response.body.id as number;
}

async function createPlayer(overrides: Record<string, unknown> = {}) {
  const response = await request(app)
    .post('/api/v1/players')
    .send({ ...playerBody, ...overrides });
  expect(response.status).toBe(201);
  return response.body.id as number;
}

function buy(playerId: number, clubId: number) {
  return request(app)
    .post(`/api/v1/players/${playerId}/buy`)
    .send({ club_id: clubId, loyalty_until: futureDate() });
}

function sell(playerId: number) {
  return request(app).post(`/api/v1/players/${playerId}/sell`);
}

async function setLoyalty(playerId: number, date: Date) {
  await database.query(
    "UPDATE contratos SET fidelidade_ate = :date WHERE jogador_id = :playerId AND situacao = 'ATIVO'",
    { replacements: { date, playerId } },
  );
}

async function state(playerId: number, clubId: number) {
  const [clubs, players, contracts, entries, lineup] = await Promise.all([
    database.query<{ caixa: string; formacao: string | null }>(
      'SELECT caixa, formacao FROM clubes WHERE id = :clubId',
      { type: QueryTypes.SELECT, replacements: { clubId } },
    ),
    database.query<{ clube_id: number | null; condicao: string }>(
      'SELECT clube_id, condicao FROM jogadores WHERE id = :playerId',
      { type: QueryTypes.SELECT, replacements: { playerId } },
    ),
    database.query<{
      id: number;
      situacao: string;
      encerrado_em: Date | null;
      valor_compra: string;
    }>(
      'SELECT id, situacao, encerrado_em, valor_compra FROM contratos WHERE jogador_id = :playerId ORDER BY id',
      { type: QueryTypes.SELECT, replacements: { playerId } },
    ),
    database.query<{
      id: number;
      tipo: string;
      valor: string;
      taxa: string;
      multa: string;
      lucro: string | null;
      variacao_caixa: string;
      nome_jogador: string;
    }>(
      'SELECT id, tipo, valor, taxa, multa, lucro, variacao_caixa, nome_jogador FROM transacoes WHERE jogador_id = :playerId ORDER BY id',
      { type: QueryTypes.SELECT, replacements: { playerId } },
    ),
    database.query<{ jogador_id: number }>(
      'SELECT jogador_id FROM escalacoes WHERE clube_id = :clubId ORDER BY jogador_id',
      { type: QueryTypes.SELECT, replacements: { clubId } },
    ),
  ]);
  return {
    cash: clubs[0]?.caixa,
    formation: clubs[0]?.formacao,
    playerClubId: players[0]?.clube_id,
    condition: players[0]?.condicao,
    contracts,
    entries,
    lineupIds: lineup.map((row) => row.jogador_id),
  };
}

function readBytes(
  response: Response,
  callback: (error: Error | null, body?: Buffer) => void,
) {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', callback);
}

describe('POST /api/v1/players/{id}/sell — RN15–RN19, B14–B16, B18–B20', () => {
  it('vende pelo mercado atual, encerra contrato e integra histórico e CSV', async () => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    expect(
      (
        await request(app)
          .patch(`/api/v1/players/${playerId}/condition`)
          .send({ condition: 'MAL_CONDICIONADO' })
      ).status,
    ).toBe(200);
    const purchase = await buy(playerId, clubId);
    expect(purchase.status).toBe(200);
    expect(purchase.body.value).toBe(37);
    expect(purchase.body.club_cash).toBe(261.15);
    expect(
      (
        await request(app)
          .patch(`/api/v1/players/${playerId}/condition`)
          .send({ condition: 'APTO' })
      ).status,
    ).toBe(200);

    const before = Date.now();
    const response = await sell(playerId);
    const after = Date.now();
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual({
      id: 2,
      club_id: clubId,
      player_id: playerId,
      player_name: 'Meia Lua',
      type: 'VENDA',
      value: 40,
      fee: 0.3,
      penalty: 4,
      profit: 3,
      cash_change: 35.7,
      created_at: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/,
      ),
      purchase_value: 37,
      remaining_days: 120,
      penalty_rate: 10,
      contract_status: 'RESCINDIDO',
      club_cash: 296.85,
    });
    const created = Date.parse(response.body.created_at);
    expect(created).toBeGreaterThanOrEqual(before - 1000);
    expect(created).toBeLessThanOrEqual(after);

    const persisted = await state(playerId, clubId);
    expect(persisted.cash).toBe('296.85');
    expect(persisted.playerClubId).toBeNull();
    expect(persisted.contracts).toEqual([
      expect.objectContaining({
        situacao: 'RESCINDIDO',
        valor_compra: '37.00',
        encerrado_em: expect.any(Date),
      }),
    ]);
    expect(persisted.entries).toEqual([
      expect.objectContaining({
        tipo: 'COMPRA',
        valor: '37.00',
        taxa: '1.85',
        variacao_caixa: '-38.85',
      }),
      expect.objectContaining({
        tipo: 'VENDA',
        valor: '40.00',
        taxa: '0.30',
        multa: '4.00',
        lucro: '3.00',
        variacao_caixa: '35.70',
      }),
    ]);

    const history = await request(app).get(
      `/api/v1/clubs/${clubId}/transactions`,
    );
    expect(history.status).toBe(200);
    expect(
      history.body.data.map((entry: { type: string }) => entry.type),
    ).toEqual(['VENDA', 'COMPRA']);
    expect(history.body.summary).toEqual({
      total_spent: 38.85,
      total_received: 35.7,
      total_fees: 2.15,
      total_penalties: 4,
      total_profit: 3,
    });
    const salesOnly = await request(app)
      .get(`/api/v1/clubs/${clubId}/transactions`)
      .query({ type: 'VENDA', player_id: String(playerId) });
    expect(salesOnly.status).toBe(200);
    expect(salesOnly.body.data).toHaveLength(1);
    expect(salesOnly.body.data[0].id).toBe(response.body.id);
    expect(salesOnly.body.summary).toEqual({
      total_spent: 0,
      total_received: 35.7,
      total_fees: 0.3,
      total_penalties: 4,
      total_profit: 3,
    });
    const csv = await request(app)
      .get(`/api/v1/clubs/${clubId}/transactions/export`)
      .buffer(true)
      .parse(readBytes);
    expect(csv.status).toBe(200);
    expect(csv.body).toEqual(
      Buffer.from(
        csvHeader +
          `${response.body.created_at};VENDA;Meia Lua;40,00;0,30;4,00;3,00;35,70\n` +
          `${purchase.body.created_at};COMPRA;Meia Lua;37,00;1,85;0,00;;-38,85\n`,
        'utf8',
      ),
    );
    const filteredCsv = await request(app)
      .get(`/api/v1/clubs/${clubId}/transactions/export`)
      .query({ type: 'VENDA', player_id: String(playerId) })
      .buffer(true)
      .parse(readBytes);
    expect(filteredCsv.status).toBe(200);
    expect(filteredCsv.body).toEqual(
      Buffer.from(
        csvHeader +
          `${response.body.created_at};VENDA;Meia Lua;40,00;0,30;4,00;3,00;35,70\n`,
        'utf8',
      ),
    );

    const club = await request(app).get(`/api/v1/clubs/${clubId}`);
    expect(club.status).toBe(200);
    expect(club.body.cash).toBe(296.85);
    expect(club.body.squad_value).toBe(0);
    expect(club.body.net_worth).toBe(296.85);
    expect(club.body.players).toEqual([]);
    const freePlayers = await request(app).get('/api/v1/players?free=true');
    expect(freePlayers.status).toBe(200);
    expect(
      freePlayers.body.data.map((player: { id: number }) => player.id),
    ).toContain(playerId);
  });

  it.each([
    ['fidelidade vencida', -day, 0, 0, 0, 40, 'ENCERRADO'],
    ['10 dias e 1 minuto', 10 * day + 60_000, 11, 5, 2, 38, 'RESCINDIDO'],
    ['30 dias e 1 minuto', 30 * day + 60_000, 31, 10, 4, 36, 'RESCINDIDO'],
    ['180 dias e 1 minuto', 180 * day + 60_000, 181, 20, 8, 32, 'RESCINDIDO'],
  ])(
    '%s → %i dias, %i%%, multa %i e crédito %i',
    async (_label, offset, days, rate, penalty, credit, contractStatus) => {
      const clubId = await createClub();
      const playerId = await createPlayer();
      expect((await buy(playerId, clubId)).status).toBe(200);
      await setLoyalty(playerId, new Date(Date.now() + offset));

      const response = await sell(playerId);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({
          value: 40,
          fee: 0,
          penalty,
          profit: 0,
          cash_change: credit,
          remaining_days: days,
          penalty_rate: rate,
          contract_status: contractStatus,
          club_cash: 258 + credit,
        }),
      );
      const persisted = await state(playerId, clubId);
      expect(persisted.contracts[0].situacao).toBe(contractStatus);
      expect(persisted.entries[1].multa).toBe(penalty.toFixed(2));
      expect(persisted.cash).toBe((258 + credit).toFixed(2));
    },
  );

  it('limita a multa em 10,00 e cobra comissão progressiva sobre lucro 35,00', async () => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    expect((await buy(playerId, clubId)).status).toBe(200);
    await database.query(
      'UPDATE jogadores SET valor_base = :value WHERE id = :playerId',
      { replacements: { value: '75.00', playerId } },
    );
    await setLoyalty(playerId, new Date(Date.now() + 200 * day));

    const response = await sell(playerId);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        value: 75,
        purchase_value: 40,
        profit: 35,
        fee: 6,
        penalty: 10,
        cash_change: 59,
        club_cash: 317,
        penalty_rate: 20,
      }),
    );
  });

  it('arredonda comissão 0,385 para 0,39 e credita 28,11', async () => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    expect((await buy(playerId, clubId)).status).toBe(200);
    await database.query(
      "UPDATE contratos SET valor_compra = '26.15' WHERE jogador_id = :playerId",
      { replacements: { playerId } },
    );
    await database.query(
      "UPDATE jogadores SET valor_base = '30.00' WHERE id = :playerId",
      { replacements: { playerId } },
    );
    await setLoyalty(playerId, new Date(Date.now() + 10 * day));

    const response = await sell(playerId);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        value: 30,
        purchase_value: 26.15,
        remaining_days: 10,
        penalty_rate: 5,
        penalty: 1.5,
        profit: 3.85,
        fee: 0.39,
        cash_change: 28.11,
        club_cash: 286.11,
      }),
    );
  });

  it('vende jogador DOENTE pelo valor de mercado atual, com prejuízo e sem comissão', async () => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    expect((await buy(playerId, clubId)).status).toBe(200);
    const patch = await request(app)
      .patch(`/api/v1/players/${playerId}/condition`)
      .send({ condition: 'DOENTE' });
    expect(patch.status).toBe(200);
    expect(patch.body.market_value).toBe(34);

    const response = await sell(playerId);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        value: 34,
        purchase_value: 40,
        profit: -6,
        fee: 0,
        penalty: 3.4,
        cash_change: 30.6,
        club_cash: 288.6,
      }),
    );
  });

  it('remove titular vendido, mantém formação e deixa escalação incompleta', async () => {
    const clubId = await createClub();
    const players = [
      ['Rui Prado', 'GOL'],
      ['Davi Lins', 'ZAG'],
      ['Téo Brandão', 'LAT'],
      ['Lauro Neves', 'MEI'],
      ['Otto Rangel', 'ATA'],
    ] as const;
    const playerIds: number[] = [];
    for (const [name, position] of players) {
      const playerId = await createPlayer({
        name,
        position,
        pace: 45,
        shooting: 45,
        passing: 45,
        dribbling: 45,
        defending: 45,
        physical: 45,
        potential: 45,
      });
      playerIds.push(playerId);
      expect((await buy(playerId, clubId)).status).toBe(200);
    }
    const lineup = await request(app)
      .put(`/api/v1/clubs/${clubId}/lineup`)
      .send({ formation: '2-1-1', player_ids: [...playerIds].reverse() });
    expect(lineup.status).toBe(200);

    const soldPlayerId = playerIds[3];
    const before = await state(soldPlayerId, clubId);
    expect(before.lineupIds).toEqual(playerIds);
    const response = await sell(soldPlayerId);
    expect(response.status).toBe(200);
    const after = await state(soldPlayerId, clubId);
    expect(after.formation).toBe('2-1-1');
    expect(after.lineupIds).toEqual(
      playerIds.filter((id) => id !== soldPlayerId),
    );
    expect(after.playerClubId).toBeNull();

    const currentLineup = await request(app).get(
      `/api/v1/clubs/${clubId}/lineup`,
    );
    expect(currentLineup.status).toBe(200);
    expect(currentLineup.body.formation).toBe('2-1-1');
    expect(currentLineup.body.complete).toBe(false);
    expect(
      currentLineup.body.players.map((player: { id: number }) => player.id),
    ).toEqual(playerIds.filter((id) => id !== soldPlayerId));
  });

  it('ignora corpo e parâmetros sem relação com a venda', async () => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    expect((await buy(playerId, clubId)).status).toBe(200);
    await setLoyalty(playerId, new Date(Date.now() - day));
    const response = await sell(playerId)
      .query({ unknown: 'value' })
      .send({ club_id: 999, value: 1, condition: 'DOENTE' });
    expect(response.status).toBe(200);
    expect(response.body.club_id).toBe(clubId);
    expect(response.body.value).toBe(40);
    expect(response.body.penalty).toBe(0);
  });

  it('ignora JSON malformado enviado à venda (V1)', async () => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    expect((await buy(playerId, clubId)).status).toBe(200);
    await setLoyalty(playerId, new Date(Date.now() - day));

    const response = await sell(playerId)
      .set('Content-Type', 'application/json')
      .send('{"club_id":');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      club_id: clubId,
      player_id: playerId,
      type: 'VENDA',
      value: 40,
      penalty: 0,
    });
  });

  it.each(['/0', '/01', '/abc', '/999', '/2147483648'])(
    'retorna 404 para jogador inexistente ou ID inválido %s',
    async (suffix) => {
      const response = await request(app).post(`/api/v1/players${suffix}/sell`);
      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toMatch(/^application\/json/);
      expect(response.body.message).toEqual(expect.any(String));
      const rows = await database.query<{ count: string }>(
        'SELECT COUNT(*) AS count FROM transacoes',
        { type: QueryTypes.SELECT },
      );
      expect(Number(rows[0].count)).toBe(0);
    },
  );

  it('recusa jogador excluído com 404 e jogador livre com 409, sem gravar venda', async () => {
    const clubId = await createClub();
    const freeId = await createPlayer();
    const otherId = await createPlayer({ name: 'Outro Jogador' });
    expect(
      (await request(app).delete(`/api/v1/players/${otherId}`)).status,
    ).toBe(204);
    const before = await state(freeId, clubId);

    const deleted = await sell(otherId);
    expect(deleted.status).toBe(404);
    expect(deleted.body.message).toEqual(expect.any(String));
    const free = await sell(freeId);
    expect(free.status).toBe(409);
    expect(free.body.message).toEqual(expect.any(String));
    expect(await state(freeId, clubId)).toEqual(before);
  });

  it('desfaz caixa, liberação, contrato e escalação se falhar ao gravar VENDA', async () => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    expect((await buy(playerId, clubId)).status).toBe(200);
    await database.query(
      'UPDATE clubes SET formacao = :formation WHERE id = :clubId',
      { replacements: { formation: '2-1-1', clubId } },
    );
    await database.query(
      'INSERT INTO escalacoes (clube_id, jogador_id, criado_em) VALUES (:clubId, :playerId, NOW())',
      { replacements: { clubId, playerId } },
    );
    const before = await state(playerId, clubId);
    vi.spyOn(transactionRepository, 'create').mockRejectedValueOnce(
      new Error('Falha simulada na gravação da venda'),
    );

    const response = await sell(playerId);
    expect(response.status).toBe(500);
    expect(response.body.message).toEqual(expect.any(String));
    expect(await state(playerId, clubId)).toEqual(before);
  });

  it('serializa duas vendas do mesmo jogador e grava apenas uma VENDA', async () => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    expect((await buy(playerId, clubId)).status).toBe(200);
    const responses = await Promise.all([sell(playerId), sell(playerId)]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const persisted = await state(playerId, clubId);
    expect(persisted.entries.map((entry) => entry.tipo)).toEqual([
      'COMPRA',
      'VENDA',
    ]);
    expect(persisted.playerClubId).toBeNull();
    expect(persisted.cash).toBe('294.00');
  });

  it('impede recompra pelo vendedor e permite compra por outro clube', async () => {
    const clubId = await createClub();
    const otherClubId = await createClub('Delta FC', 'DEL');
    const playerId = await createPlayer();
    expect((await buy(playerId, clubId)).status).toBe(200);
    expect((await sell(playerId)).status).toBe(200);

    const repeat = await buy(playerId, clubId);
    expect(repeat.status).toBe(409);
    expect(repeat.body.message).toEqual(expect.any(String));
    const other = await buy(playerId, otherClubId);
    expect(other.status).toBe(200);
    expect((await state(playerId, otherClubId)).playerClubId).toBe(otherClubId);
  });

  it('congela no histórico os nomes de compra e venda em seus instantes', async () => {
    const clubId = await createClub();
    const playerId = await createPlayer();
    expect((await buy(playerId, clubId)).status).toBe(200);
    const update = await request(app)
      .put(`/api/v1/players/${playerId}`)
      .send({ name: 'Novo Nome', position: 'MEI', agility: 85, age: 25 });
    expect(update.status).toBe(200);

    const response = await sell(playerId);
    expect(response.status).toBe(200);
    expect(response.body.player_name).toBe('Novo Nome');
    const persisted = await state(playerId, clubId);
    expect(persisted.entries.map((entry) => entry.nome_jogador)).toEqual([
      'Meia Lua',
      'Novo Nome',
    ]);
  });
});
