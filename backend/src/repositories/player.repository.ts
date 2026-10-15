import { Op, QueryTypes, type Transaction } from 'sequelize';
import { sequelize } from '../database/sequelize.js';
import {
  Player,
  type PlayerCondition,
  type PlayerPosition,
} from '../models/player.model.js';

export interface PlayerCreate {
  name: string;
  searchName: string;
  position: PlayerPosition;
  agility: number;
  age: number;
  baseValue: string;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  potential: number;
}

export interface PlayerProfileUpdate {
  name: string;
  searchName: string;
  position: PlayerPosition;
  agility: number;
  age: number;
}

export interface PlayerRecord extends PlayerCreate {
  id: number;
  condition: PlayerCondition;
  clubId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayerListFilters {
  search?: string;
  position?: PlayerPosition;
  condition?: PlayerCondition;
  free?: boolean;
  clubId?: number;
  minAge?: number;
  maxAge?: number;
  minValue?: string;
  maxValue?: string;
  sort: string;
  page: number;
  limit: number;
}

export interface PlayerListResult {
  players: { record: PlayerRecord; marketValue: string }[];
  totalItems: number;
}

export interface ClubPlayerValue {
  clubId: number;
  baseValue: string;
  condition: PlayerCondition;
  agility: number;
  age: number;
}

interface PlayerListRow {
  total_items: number;
  id: number | null;
  nome: string;
  nome_busca: string;
  posicao: PlayerPosition;
  agilidade: number;
  idade: number;
  valor_base: string;
  condicao: PlayerCondition;
  clube_id: number | null;
  velocidade: number;
  finalizacao: number;
  passe: number;
  drible: number;
  defesa: number;
  fisico: number;
  potencial: number;
  market_value: string;
  criado_em: Date;
  atualizado_em: Date;
}

function listOrder(alias: 'p' | 'page', sort: string): string {
  const fields: Record<string, string> = {
    name: `${alias}.nome_busca COLLATE "ucs_basic" ASC`,
    value_asc: `${alias}.market_value ASC`,
    value_desc: `${alias}.market_value DESC`,
    age_asc: `${alias}.idade ASC`,
    age_desc: `${alias}.idade DESC`,
    position: `CASE ${alias}.posicao WHEN 'GOL' THEN 1 WHEN 'ZAG' THEN 2 WHEN 'LAT' THEN 3 WHEN 'MEI' THEN 4 WHEN 'ATA' THEN 5 END ASC`,
  };
  const parts = sort.split(',');
  const order = parts.map((part) => {
    const expression = fields[part];
    if (!expression) throw new Error('Ordenação de jogadores inválida.');
    return expression;
  });
  if (!parts.includes('name')) order.push(fields.name);
  order.push(`${alias}.id ASC`);
  return order.join(', ');
}

interface RepositoryOptions {
  transaction?: Transaction;
  forUpdate?: boolean;
}

function toRecord(player: Player): PlayerRecord {
  return {
    id: player.id,
    name: player.name,
    searchName: player.searchName,
    position: player.position,
    agility: player.agility,
    age: player.age,
    baseValue: player.baseValue,
    condition: player.condition,
    clubId: player.clubId,
    pace: player.pace,
    shooting: player.shooting,
    passing: player.passing,
    dribbling: player.dribbling,
    defending: player.defending,
    physical: player.physical,
    potential: player.potential,
    createdAt: player.createdAt,
    updatedAt: player.updatedAt,
  };
}

export const playerRepository = {
  async listActiveClubValues(
    options: RepositoryOptions = {},
  ): Promise<ClubPlayerValue[]> {
    const players = await Player.findAll({
      attributes: ['clubId', 'baseValue', 'condition', 'agility', 'age'],
      where: { clubId: { [Op.ne]: null } },
      transaction: options.transaction,
      raw: true,
    });
    return players.map((player) => ({
      clubId: player.clubId!,
      baseValue: player.baseValue,
      condition: player.condition,
      agility: player.agility,
      age: player.age,
    }));
  },

  async list(filters: PlayerListFilters): Promise<PlayerListResult> {
    const conditions = ['j.excluido_em IS NULL'];
    const valueConditions: string[] = [];
    const replacements: Record<string, string | number> = {
      limit: filters.limit,
      offset: (filters.page - 1) * filters.limit,
    };

    if (filters.search !== undefined) {
      conditions.push('strpos(j.nome_busca, :search) > 0');
      replacements.search = filters.search;
    }
    if (filters.position !== undefined) {
      conditions.push('j.posicao = :position');
      replacements.position = filters.position;
    }
    if (filters.condition !== undefined) {
      conditions.push('j.condicao = :condition');
      replacements.condition = filters.condition;
    }
    if (filters.free !== undefined) {
      conditions.push(
        filters.free ? 'j.clube_id IS NULL' : 'j.clube_id IS NOT NULL',
      );
    }
    if (filters.clubId !== undefined) {
      conditions.push('j.clube_id = :clubId');
      replacements.clubId = filters.clubId;
    }
    if (filters.minAge !== undefined) {
      conditions.push('j.idade >= :minAge');
      replacements.minAge = filters.minAge;
    }
    if (filters.maxAge !== undefined) {
      conditions.push('j.idade <= :maxAge');
      replacements.maxAge = filters.maxAge;
    }
    if (filters.minValue !== undefined) {
      valueConditions.push('v.market_value >= CAST(:minValue AS numeric)');
      replacements.minValue = filters.minValue;
    }
    if (filters.maxValue !== undefined) {
      valueConditions.push('v.market_value <= CAST(:maxValue AS numeric)');
      replacements.maxValue = filters.maxValue;
    }

    const rows = await sequelize.query<PlayerListRow>(
      `WITH candidates AS (
         SELECT j.*,
           CASE j.condicao
             WHEN 'APTO' THEN 0::numeric
             WHEN 'MAL_CONDICIONADO' THEN 15::numeric
             ELSE 30::numeric
           END AS initial_discount,
           CASE WHEN j.idade <= 21 THEN 10::numeric
             WHEN j.idade >= 32 THEN -10::numeric
             ELSE 0::numeric END AS age_adjustment
         FROM jogadores j
         WHERE ${conditions.join(' AND ')}
       ), discounted AS (
         SELECT c.*,
           CASE WHEN c.condicao = 'APTO' THEN 0::numeric
             WHEN c.agilidade >= 80 THEN c.initial_discount / 2
             WHEN c.agilidade <= 30 THEN c.initial_discount + 10
             ELSE c.initial_discount END AS condition_discount
         FROM candidates c
       ), valued AS (
         SELECT d.*,
           GREATEST(1.00::numeric,
             ROUND(d.valor_base *
               (100::numeric + GREATEST(-40::numeric,
                 d.age_adjustment - d.condition_discount)) / 100::numeric, 2)
           ) AS market_value
         FROM discounted d
       ), filtered AS (
         SELECT v.* FROM valued v
         ${valueConditions.length ? `WHERE ${valueConditions.join(' AND ')}` : ''}
       ), total AS (
         SELECT COUNT(*)::integer AS total_items FROM filtered
       ), page AS (
         SELECT p.* FROM filtered p
         ORDER BY ${listOrder('p', filters.sort)}
         LIMIT :limit OFFSET :offset
       )
       SELECT page.*, total.total_items
       FROM total LEFT JOIN page ON true
       ORDER BY ${listOrder('page', filters.sort)}`,
      { type: QueryTypes.SELECT, replacements },
    );

    return {
      totalItems: rows[0].total_items,
      players: rows
        .filter((row) => row.id !== null)
        .map((row) => ({
          marketValue: row.market_value,
          record: {
            id: row.id!,
            name: row.nome,
            searchName: row.nome_busca,
            position: row.posicao,
            agility: row.agilidade,
            age: row.idade,
            baseValue: row.valor_base,
            condition: row.condicao,
            clubId: row.clube_id,
            pace: row.velocidade,
            shooting: row.finalizacao,
            passing: row.passe,
            dribbling: row.drible,
            defending: row.defesa,
            physical: row.fisico,
            potential: row.potencial,
            createdAt: row.criado_em,
            updatedAt: row.atualizado_em,
          },
        })),
    };
  },

  async create(
    data: PlayerCreate,
    options: RepositoryOptions = {},
  ): Promise<PlayerRecord> {
    const player = await Player.create(data, {
      transaction: options.transaction,
    });
    return toRecord(player);
  },

  async findActiveById(
    id: number,
    options: RepositoryOptions = {},
  ): Promise<PlayerRecord | null> {
    const player = await Player.findByPk(id, {
      transaction: options.transaction,
      lock: options.forUpdate ? options.transaction?.LOCK.UPDATE : undefined,
    });
    return player ? toRecord(player) : null;
  },

  async updateProfile(
    id: number,
    data: PlayerProfileUpdate,
    options: RepositoryOptions = {},
  ): Promise<boolean> {
    const [updatedCount] = await Player.update(data, {
      where: { id },
      transaction: options.transaction,
    });
    return updatedCount === 1;
  },

  async updateCondition(
    id: number,
    condition: PlayerCondition,
    options: RepositoryOptions = {},
  ): Promise<boolean> {
    const [updatedCount] = await Player.update(
      { condition },
      { where: { id }, transaction: options.transaction },
    );
    return updatedCount === 1;
  },

  async softDelete(
    id: number,
    options: RepositoryOptions = {},
  ): Promise<boolean> {
    const deletedCount = await Player.destroy({
      where: { id },
      transaction: options.transaction,
    });
    return deletedCount === 1;
  },
};
