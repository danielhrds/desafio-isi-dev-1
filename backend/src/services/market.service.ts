import { Decimal } from 'decimal.js';
import { sequelize } from '../database/sequelize.js';
import { AppError } from '../errors/app.error.js';
import { clubRepository } from '../repositories/club.repository.js';
import { contractRepository } from '../repositories/contract.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import { transactionRepository } from '../repositories/transaction.repository.js';
import type { BuyPlayerInput } from '../schemas/market.schema.js';
import { formatBrasiliaDateTime } from '../validation/brasilia-datetime.js';
import {
  calculatePurchaseFee,
  validateLoyaltyPeriod,
} from './market-calculations.js';
import { calculateMarketValue } from './player-calculations.js';

export const marketService = {
  async buyPlayer(playerId: number, input: BuyPlayerInput) {
    return sequelize.transaction(async (transaction) => {
      const player = await playerRepository.findActiveById(playerId, {
        transaction,
        forUpdate: true,
      });
      if (!player) throw new AppError(404, 'Jogador não encontrado.');

      const club = await clubRepository.findById(input.club_id, {
        transaction,
        forUpdate: true,
      });
      if (!club) throw new AppError(404, 'Clube não encontrado.');
      if (player.clubId !== null) {
        throw new AppError(409, 'Jogador não está livre.');
      }

      const now = new Date();
      const loyaltyUntil = new Date(input.loyalty_until);
      validateLoyaltyPeriod(loyaltyUntil, now);

      if (
        await transactionRepository.hasSaleByClubAndPlayer(club.id, player.id, {
          transaction,
        })
      ) {
        throw new AppError(409, 'O clube já vendeu este jogador.');
      }
      if (
        (await playerRepository.countActiveByClubId(club.id, {
          transaction,
        })) >= 12
      ) {
        throw new AppError(409, 'O clube já tem 12 jogadores no elenco.');
      }

      const marketValue = calculateMarketValue(
        player.baseValue,
        player.condition,
        player.agility,
        player.age,
      );
      const fee = calculatePurchaseFee(marketValue);
      const cost = new Decimal(marketValue).plus(fee);
      const originalCash = new Decimal(club.cash);
      if (cost.gt(originalCash.div(2))) {
        throw new AppError(409, 'O custo passa de 50% do caixa do clube.');
      }

      const clubCash = originalCash.minus(cost).toFixed(2);
      if (
        !(await clubRepository.updateCash(club.id, clubCash, {
          transaction,
        })) ||
        !(await playerRepository.assignToClub(player.id, club.id, {
          transaction,
        }))
      ) {
        throw new Error('A compra bloqueada não foi gravada.');
      }

      const contract = await contractRepository.create(
        {
          playerId: player.id,
          clubId: club.id,
          purchaseValue: marketValue,
          loyaltyUntil,
          status: 'ATIVO',
          startedAt: now,
        },
        { transaction },
      );
      const entry = await transactionRepository.create(
        {
          clubId: club.id,
          playerId: player.id,
          playerName: player.name,
          type: 'COMPRA',
          value: marketValue,
          fee,
          penalty: '0.00',
          profit: null,
          cashChange: cost.negated().toFixed(2),
          createdAt: now,
        },
        { transaction },
      );

      return {
        id: entry.id,
        club_id: entry.clubId,
        player_id: entry.playerId,
        player_name: entry.playerName,
        type: entry.type,
        value: Number(entry.value),
        fee: Number(entry.fee),
        penalty: Number(entry.penalty),
        profit: entry.profit === null ? null : Number(entry.profit),
        cash_change: Number(entry.cashChange),
        created_at: formatBrasiliaDateTime(entry.createdAt),
        contract: {
          purchase_value: Number(contract.purchaseValue),
          loyalty_until: formatBrasiliaDateTime(contract.loyaltyUntil),
          status: contract.status,
        },
        club_cash: Number(clubCash),
      };
    });
  },
};
