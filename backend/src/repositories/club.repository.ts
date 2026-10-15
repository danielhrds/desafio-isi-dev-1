import { QueryTypes, type Transaction } from 'sequelize';
import { sequelize } from '../database/sequelize.js';
import { Club, type ClubFormation } from '../models/club.model.js';

export interface ClubCreate {
  name: string;
  normalizedName: string;
  searchName: string;
  acronym: string;
}

export interface ClubRecord extends ClubCreate {
  id: number;
  cash: string;
  formation: ClubFormation | null;
  createdAt: Date;
}

interface RepositoryOptions {
  transaction?: Transaction;
  forUpdate?: boolean;
}

interface ClubRow {
  id: number;
  nome: string;
  nome_normalizado: string;
  nome_busca: string;
  sigla: string;
  caixa: string;
  formacao: ClubFormation | null;
  criado_em: Date;
}

function toRecord(club: Club): ClubRecord {
  return {
    id: club.id,
    name: club.name,
    normalizedName: club.normalizedName,
    searchName: club.searchName,
    acronym: club.acronym,
    cash: club.cash,
    formation: club.formation,
    createdAt: club.createdAt,
  };
}

export const clubRepository = {
  async create(
    data: ClubCreate,
    options: RepositoryOptions = {},
  ): Promise<ClubRecord> {
    const club = await Club.create(data, { transaction: options.transaction });
    return toRecord(club);
  },

  async findById(
    id: number,
    options: RepositoryOptions = {},
  ): Promise<ClubRecord | null> {
    const club = await Club.findByPk(id, {
      transaction: options.transaction,
      lock: options.forUpdate ? options.transaction?.LOCK.UPDATE : undefined,
    });
    return club ? toRecord(club) : null;
  },

  async count(options: RepositoryOptions = {}): Promise<number> {
    return Club.count({ transaction: options.transaction });
  },

  async listByName(options: RepositoryOptions = {}): Promise<ClubRecord[]> {
    const rows = await sequelize.query<ClubRow>(
      `SELECT id, nome, nome_normalizado, nome_busca, sigla, caixa, formacao, criado_em
       FROM clubes
       ORDER BY nome_busca COLLATE "ucs_basic" ASC, id ASC`,
      { type: QueryTypes.SELECT, transaction: options.transaction },
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.nome,
      normalizedName: row.nome_normalizado,
      searchName: row.nome_busca,
      acronym: row.sigla,
      cash: row.caixa,
      formation: row.formacao,
      createdAt: row.criado_em,
    }));
  },
};
