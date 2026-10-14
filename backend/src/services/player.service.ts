import { AppError } from '../errors/app.error.js';
import type { PlayerRecord } from '../repositories/player.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import type { CreatePlayerInput } from '../schemas/player.schema.js';
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
  if (input.age >= 35 && input.agility > 85) {
    throw new AppError(400, 'A agilidade máxima a partir de 35 anos é 85.');
  }

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

function searchName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '');
}

function playerResponse(player: PlayerRecord) {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    agility: player.agility,
    age: player.age,
    condition: player.condition,
    base_value: Number(player.baseValue),
    market_value: Number(
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
};
