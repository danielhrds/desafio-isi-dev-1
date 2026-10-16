import { literal, type Transaction } from 'sequelize';
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

  async exists(id: number): Promise<boolean> {
    return (await Club.findByPk(id, { attributes: ['id'] })) !== null;
  },

  async updateCash(
    id: number,
    cash: string,
    options: RepositoryOptions = {},
  ): Promise<boolean> {
    const [updatedCount] = await Club.update(
      { cash },
      { where: { id }, transaction: options.transaction },
    );
    return updatedCount === 1;
  },

  async listByName(options: RepositoryOptions = {}): Promise<ClubRecord[]> {
    const clubs = await Club.findAll({
      order: [
        [literal('"nome_busca" COLLATE "ucs_basic"'), 'ASC'],
        ['id', 'ASC'],
      ],
      transaction: options.transaction,
    });
    return clubs.map(toRecord);
  },
};
