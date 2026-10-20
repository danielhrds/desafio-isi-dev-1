import { z } from 'zod';
import type { PlayerListItem } from '@/types/player';
import {
  playerAgeSchema,
  playerAgilitySchema,
  playerNameSchema,
  playerPositionSchema,
} from './player-validation';

export function createPlayerEditSchema(
  currentPlayer: Pick<PlayerListItem, 'age' | 'club_id' | 'position'>,
) {
  return z
    .object({
      name: playerNameSchema,
      position: playerPositionSchema,
      age: playerAgeSchema,
      agility: playerAgilitySchema,
    })
    .superRefine((player, context) => {
      if (player.age < currentPlayer.age) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['age'],
          message: `A idade não pode diminuir (atual: ${currentPlayer.age}).`,
        });
      }

      if (player.age >= 35 && player.agility > 85) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['agility'],
          message: 'Com 35 anos ou mais, use no máximo 85.',
        });
      }

      if (
        currentPlayer.club_id !== null &&
        player.position !== currentPlayer.position
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['position'],
          message: 'Jogador com clube não pode mudar de posição.',
        });
      }
    });
}

export type PlayerEditFormValues = z.input<
  ReturnType<typeof createPlayerEditSchema>
>;
export type PlayerEditPayload = z.output<
  ReturnType<typeof createPlayerEditSchema>
>;
