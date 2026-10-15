import { AppError } from '../errors/app.error.js';
import { sequelize } from '../database/sequelize.js';
import type {
  PlayerListFilters,
  PlayerProfileUpdate,
} from '../repositories/player.repository.js';
import type { PlayerRecord } from '../repositories/player.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import type {
  CreatePlayerInput,
  ListPlayersQuery,
  UpdatePlayerInput,
} from '../schemas/player.schema.js';
import { normalizePlayerSearch } from '../schemas/player.schema.js';
import {
  calculateBaseValue,
  calculateMarketValue,
  calculateOverall,
  type PlayerAttributes,
} from './player-calculations.js';

export function normalizeAndValidatePlayerName(rawName: string): string {
  if (/\p{Cc}/u.test(rawName)) {
    throw new AppError(400, 'O nome não pode conter caracteres de controle.');
  }

  const name = rawName.replace(/^ +| +$/g, '').replace(/ {2,}/g, ' ');
  const words = name.split(' ');
  if (
    [...name].length < 3 ||
    [...name].length > 100 ||
    /[0-9]/u.test(name) ||
    words.length < 2 ||
    words.some((word) => !/\p{L}/u.test(word))
  ) {
    throw new AppError(
      400,
      'O nome deve ter de 3 a 100 caracteres e pelo menos duas palavras, sem dígitos.',
    );
  }

  return name;
}

export function validatePlayerCreationRules(input: CreatePlayerInput): void {
  validatePlayerAgeAndAgility(input);

  const attributes = [
    input.pace,
    input.shooting,
    input.passing,
    input.dribbling,
    input.defending,
    input.physical,
  ];
  if (attributes.reduce((sum, value) => sum + value, 0) > 480) {
    throw new AppError(
      400,
      'A soma dos seis atributos não pode passar de 480.',
    );
  }

  const highestAttribute = Math.max(...attributes);
  if (
    input.potential < highestAttribute ||
    (input.age >= 33 && input.potential !== highestAttribute)
  ) {
    throw new AppError(
      400,
      'O potencial não atende ao limite dos atributos e da idade.',
    );
  }
}

function validatePlayerAgeAndAgility(input: {
  age: number;
  agility: number;
}): void {
  if (input.age >= 35 && input.agility > 85) {
    throw new AppError(400, 'A agilidade máxima a partir de 35 anos é 85.');
  }
}

function searchName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '');
}

function playerResponse(player: PlayerRecord, marketValue?: string) {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    agility: player.agility,
    age: player.age,
    condition: player.condition,
    base_value: Number(player.baseValue),
    market_value: Number(
      marketValue ??
        calculateMarketValue(
          player.baseValue,
          player.condition,
          player.agility,
          player.age,
        ),
    ),
    pace: player.pace,
    shooting: player.shooting,
    passing: player.passing,
    dribbling: player.dribbling,
    defending: player.defending,
    physical: player.physical,
    potential: player.potential,
    overall: calculateOverall(player.position, player),
    club_id: player.clubId,
  };
}

export const playerService = {
  async getPlayerById(id: number) {
    const player = await playerRepository.findActiveById(id);
    if (!player) {
      throw new AppError(404, 'Jogador não encontrado.');
    }
    return playerResponse(player);
  },

  async listPlayers(query: ListPlayersQuery) {
    const clubId = query.club_id ? Number(query.club_id) : undefined;
    if (clubId !== undefined && !(await playerRepository.clubExists(clubId))) {
      throw new AppError(404, 'Clube não encontrado.');
    }

    const filters: PlayerListFilters = {
      search: query.search
        ? searchName(normalizePlayerSearch(query.search))
        : undefined,
      position: query.position,
      condition: query.condition,
      free: query.free === undefined ? undefined : query.free === 'true',
      clubId,
      minAge: query.min_age ? Number(query.min_age) : undefined,
      maxAge: query.max_age ? Number(query.max_age) : undefined,
      minValue: query.min_value,
      maxValue: query.max_value,
      sort: query.sort ?? 'name',
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 10,
    };
    const { players, totalItems } = await playerRepository.list(filters);
    return {
      data: players.map(({ record, marketValue }) =>
        playerResponse(record, marketValue),
      ),
      meta: {
        page: filters.page,
        limit: filters.limit,
        total_items: totalItems,
        total_pages: Math.ceil(totalItems / filters.limit),
      },
    };
  },

  async createPlayer(input: CreatePlayerInput) {
    const name = normalizeAndValidatePlayerName(input.name);
    validatePlayerCreationRules(input);

    const attributes: PlayerAttributes = input;
    const overall = calculateOverall(input.position, attributes);
    const baseValue = calculateBaseValue(overall, input.potential, input.age);

    const player = await playerRepository.create({
      ...input,
      name,
      searchName: searchName(name),
      baseValue,
    });
    return playerResponse(player);
  },

  async updatePlayer(id: number, input: UpdatePlayerInput) {
    const name = normalizeAndValidatePlayerName(input.name);
    validatePlayerAgeAndAgility(input);

    return sequelize.transaction(async (transaction) => {
      const current = await playerRepository.findActiveById(id, {
        transaction,
        forUpdate: true,
      });
      if (!current) {
        throw new AppError(404, 'Jogador não encontrado.');
      }
      if (input.age < current.age) {
        throw new AppError(409, 'A idade não pode diminuir.');
      }
      if (current.clubId !== null && input.position !== current.position) {
        throw new AppError(409, 'Jogador com clube não pode mudar de posição.');
      }

      const profile: PlayerProfileUpdate = {
        name,
        searchName: searchName(name),
        position: input.position,
        agility: input.agility,
        age: input.age,
      };
      const updated = await playerRepository.updateProfile(id, profile, {
        transaction,
      });
      if (!updated) {
        throw new Error('A atualização de jogador bloqueado não foi gravada.');
      }

      return playerResponse({ ...current, ...profile });
    });
  },

  async deletePlayer(id: number): Promise<void> {
    await sequelize.transaction(async (transaction) => {
      const player = await playerRepository.findActiveById(id, {
        transaction,
        forUpdate: true,
      });
      if (!player) {
        throw new AppError(404, 'Jogador não encontrado.');
      }
      if (player.clubId !== null) {
        throw new AppError(409, 'Jogador com clube não pode ser excluído.');
      }
      const deleted = await playerRepository.softDelete(id, { transaction });
      if (!deleted) {
        throw new Error('A exclusão de jogador bloqueado não foi gravada.');
      }
    });
  },
};
