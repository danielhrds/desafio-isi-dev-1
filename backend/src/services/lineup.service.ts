import { Transaction, UniqueConstraintError } from 'sequelize';
import { sequelize } from '../database/sequelize.js';
import { AppError } from '../errors/app.error.js';
import type { ClubFormation } from '../models/club.model.js';
import { clubRepository } from '../repositories/club.repository.js';
import { lineupRepository } from '../repositories/lineup.repository.js';
import {
  playerRepository,
  type PlayerRecord,
} from '../repositories/player.repository.js';
import type { PutLineupInput } from '../schemas/lineup.schema.js';
import { playerResponse } from './player-response.js';

const sectorsByFormation: Record<
  ClubFormation,
  { defense: number; midfield: number; attack: number }
> = {
  '3-1': { defense: 3, midfield: 0, attack: 1 },
  '2-2': { defense: 2, midfield: 0, attack: 2 },
  '2-1-1': { defense: 2, midfield: 1, attack: 1 },
  '1-2-1': { defense: 1, midfield: 2, attack: 1 },
};

function validatePositions(
  formation: ClubFormation,
  players: PlayerRecord[],
): void {
  const count = { goalkeeper: 0, defense: 0, midfield: 0, attack: 0 };
  for (const player of players) {
    switch (player.position) {
      case 'GOL':
        count.goalkeeper++;
        break;
      case 'ZAG':
      case 'LAT':
        count.defense++;
        break;
      case 'MEI':
        count.midfield++;
        break;
      case 'ATA':
        count.attack++;
        break;
    }
  }

  const expected = sectorsByFormation[formation];
  if (
    count.goalkeeper !== 1 ||
    count.defense !== expected.defense ||
    count.midfield !== expected.midfield ||
    count.attack !== expected.attack
  ) {
    throw new AppError(409, 'As posições não fecham a formação escolhida.');
  }
}

export const lineupService = {
  async getLineup(clubId: number) {
    return sequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
      async (transaction) => {
        const club = await clubRepository.findById(clubId, { transaction });
        if (!club) throw new AppError(404, 'Clube não encontrado.');

        const lineups = await lineupRepository.listByClubId(clubId, {
          transaction,
        });
        if (lineups.length === 0) {
          return {
            club_id: clubId,
            formation: club.formation,
            complete: false,
            players: [],
          };
        }

        const selectedIds = new Set(lineups.map((lineup) => lineup.playerId));
        const players = (
          await playerRepository.listActiveByClubId(clubId, { transaction })
        ).filter((player) => selectedIds.has(player.id));
        if (players.length !== lineups.length) {
          throw new Error('Os titulares da escalação não estão no elenco.');
        }

        return {
          club_id: clubId,
          formation: club.formation,
          complete: club.formation !== null && players.length === 5,
          players: players.map((player) => playerResponse(player)),
        };
      },
    );
  },

  async setLineup(clubId: number, input: PutLineupInput) {
    try {
      return await sequelize.transaction(async (transaction) => {
        const players: PlayerRecord[] = [];
        for (const playerId of [...input.player_ids].sort((a, b) => a - b)) {
          const player = await playerRepository.findActiveById(playerId, {
            transaction,
            forNoKeyUpdate: true,
          });
          if (!player) throw new AppError(404, 'Jogador não encontrado.');
          players.push(player);
        }

        const club = await clubRepository.findById(clubId, {
          transaction,
          forUpdate: true,
        });
        if (!club) throw new AppError(404, 'Clube não encontrado.');

        for (const player of players) {
          if (player.clubId !== clubId) {
            throw new AppError(409, 'Jogador não pertence ao elenco do clube.');
          }
          if (player.condition === 'DOENTE') {
            throw new AppError(409, 'Jogador DOENTE não pode ser escalado.');
          }
        }
        validatePositions(input.formation, players);

        if (
          !(await clubRepository.updateFormation(
            clubId,
            input.formation,
            transaction,
          ))
        ) {
          throw new Error('A formação do clube bloqueado não foi gravada.');
        }
        await lineupRepository.replaceByClubId(
          clubId,
          input.player_ids,
          transaction,
        );

        const selectedIds = new Set(input.player_ids);
        const orderedPlayers = (
          await playerRepository.listActiveByClubId(clubId, { transaction })
        ).filter((player) => selectedIds.has(player.id));
        if (orderedPlayers.length !== 5) {
          throw new Error(
            'Os cinco titulares bloqueados não foram encontrados.',
          );
        }

        return {
          club_id: clubId,
          formation: input.formation,
          complete: true,
          players: orderedPlayers.map((player) => playerResponse(player)),
        };
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new AppError(409, 'Jogador já escalado em outro clube.');
      }
      throw error;
    }
  },
};
