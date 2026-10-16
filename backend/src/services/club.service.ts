import { Decimal } from 'decimal.js';
import { QueryTypes, Transaction, UniqueConstraintError } from 'sequelize';
import { sequelize } from '../database/sequelize.js';
import { AppError } from '../errors/app.error.js';
import { clubRepository } from '../repositories/club.repository.js';
import { contractRepository } from '../repositories/contract.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import type {
  CreateClubInput,
  ListClubsQuery,
} from '../schemas/club.schema.js';
import { formatBrasiliaDateTime } from '../validation/brasilia-datetime.js';
import { calculateRemainingDaysAndPenaltyRate } from './market-calculations.js';
import { calculateMarketValue } from './player-calculations.js';
import { playerResponse } from './player-response.js';

function normalizeClubName(rawName: string): string {
  if (/\p{Cc}/u.test(rawName)) {
    throw new AppError(400, 'O nome não pode conter caracteres de controle.');
  }

  const name = rawName.replace(/^ +| +$/g, '').replace(/ {2,}/g, ' ');
  const words = name.split(' ');
  if (
    [...name].length < 3 ||
    [...name].length > 60 ||
    words.length < 2 ||
    words.length > 5 ||
    !/^[\p{L} .-]+$/u.test(name) ||
    words.some((word) => !/\p{L}/u.test(word))
  ) {
    throw new AppError(400, 'Nome de clube inválido.');
  }

  return name;
}

function searchName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '');
}

function validateAcronym(acronym: string, name: string): void {
  if (!/^[A-Z]{3}$/.test(acronym) || new Set(acronym).size === 1) {
    throw new AppError(400, 'Sigla de clube inválida.');
  }

  const letters = searchName(name).toUpperCase();
  const firstLetter = [...letters].find((character) =>
    /\p{L}/u.test(character),
  );
  if (firstLetter !== acronym[0]) {
    throw new AppError(400, 'A sigla deve corresponder ao nome do clube.');
  }

  let nextPosition = 0;
  for (const letter of acronym) {
    const position = letters.indexOf(letter, nextPosition);
    if (position === -1) {
      throw new AppError(400, 'A sigla deve corresponder ao nome do clube.');
    }
    nextPosition = position + 1;
  }
}

export const clubService = {
  async getClubById(id: number) {
    const { club, players, contracts } = await sequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
      async (transaction) => {
        const club = await clubRepository.findById(id, { transaction });
        if (!club) throw new AppError(404, 'Clube não encontrado.');
        return {
          club,
          players: await playerRepository.listActiveByClubId(id, {
            transaction,
          }),
          contracts: await contractRepository.listActiveByClubId(id, {
            transaction,
          }),
        };
      },
    );

    const now = new Date();
    const activeContracts = new Map(
      contracts.map((contract) => [contract.playerId, contract]),
    );
    let squadValue = new Decimal(0);
    const roster = players.map((player) => {
      const contract = activeContracts.get(player.id);
      if (!contract) {
        throw new Error(
          `Jogador ${player.id} sem contrato ativo no clube ${id}.`,
        );
      }

      const marketValue = calculateMarketValue(
        player.baseValue,
        player.condition,
        player.agility,
        player.age,
      );
      squadValue = squadValue.plus(marketValue);
      const { remainingDays, penaltyRate } =
        calculateRemainingDaysAndPenaltyRate(contract.loyaltyUntil, now);
      return {
        ...playerResponse(player, marketValue),
        contract: {
          purchase_value: Number(contract.purchaseValue),
          loyalty_until: formatBrasiliaDateTime(contract.loyaltyUntil),
          remaining_days: remainingDays,
          penalty_rate: penaltyRate,
        },
      };
    });

    return {
      id: club.id,
      name: club.name,
      acronym: club.acronym,
      cash: Number(club.cash),
      squad_value: squadValue.toNumber(),
      net_worth: new Decimal(club.cash).plus(squadValue).toNumber(),
      players: roster,
    };
  },

  async listClubs(sort: ListClubsQuery['sort'] = 'name') {
    const { clubs, players } = await sequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
      async (transaction) => ({
        clubs: await clubRepository.listByName({ transaction }),
        players: await playerRepository.listActiveClubValues({ transaction }),
      }),
    );

    const squadValues = new Map<number, Decimal>();
    for (const player of players) {
      const marketValue = calculateMarketValue(
        player.baseValue,
        player.condition,
        player.agility,
        player.age,
      );
      squadValues.set(
        player.clubId,
        (squadValues.get(player.clubId) ?? new Decimal(0)).plus(marketValue),
      );
    }

    const results = clubs.map((club) => {
      const squadValue = squadValues.get(club.id) ?? new Decimal(0);
      const netWorth = new Decimal(club.cash).plus(squadValue);
      return {
        response: {
          id: club.id,
          name: club.name,
          acronym: club.acronym,
          cash: Number(club.cash),
          squad_value: squadValue.toNumber(),
          net_worth: netWorth.toNumber(),
        },
        netWorth,
      };
    });

    if (sort !== 'name') {
      results.sort((left, right) => {
        const comparison = left.netWorth.comparedTo(right.netWorth);
        return sort === 'net_worth_asc' ? comparison : -comparison;
      });
    }

    return results.map(({ response }) => response);
  },

  async createClub(input: CreateClubInput) {
    const name = normalizeClubName(input.name);
    validateAcronym(input.acronym, name);

    try {
      const club = await sequelize.transaction(async (transaction) => {
        await sequelize.query('SELECT pg_advisory_xact_lock(237, 1)', {
          type: QueryTypes.SELECT,
          transaction,
        });

        if ((await clubRepository.count({ transaction })) >= 20) {
          throw new AppError(409, 'Limite de 20 clubes atingido.');
        }

        return clubRepository.create(
          {
            name,
            normalizedName: name.toLowerCase(),
            searchName: searchName(name),
            acronym: input.acronym,
          },
          { transaction },
        );
      });

      return {
        id: club.id,
        name: club.name,
        acronym: club.acronym,
        cash: Number(club.cash),
        squad_value: 0,
        net_worth: Number(club.cash),
      };
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new AppError(409, 'Nome ou sigla já cadastrado.');
      }
      throw error;
    }
  },
};
