import { z } from 'zod';
import { clubFormations } from '@/types/club';

const playerIdSchema = z.number().int().positive().nullable();

export const clubLineupSchema = z
  .object({
    formation: z.enum(clubFormations).nullable(),
    playerIds: z.tuple([
      playerIdSchema,
      playerIdSchema,
      playerIdSchema,
      playerIdSchema,
      playerIdSchema,
    ]),
  })
  .superRefine((values, context) => {
    if (!values.formation) {
      context.addIssue({
        code: 'custom',
        path: ['formation'],
        message: 'Selecione uma formação.',
      });
    }

    const seenIds = new Set<number>();

    values.playerIds.forEach((playerId, index) => {
      if (playerId === null) {
        context.addIssue({
          code: 'custom',
          path: ['playerIds', index],
          message: 'Selecione um titular para esta vaga.',
        });
        return;
      }

      if (seenIds.has(playerId)) {
        context.addIssue({
          code: 'custom',
          path: ['playerIds', index],
          message: 'Cada jogador só pode ocupar uma vaga.',
        });
        return;
      }

      seenIds.add(playerId);
    });
  });

export type ClubLineupFormValues = z.infer<typeof clubLineupSchema>;
