import { z } from 'zod';

const clubId = z.number().int().min(1).max(2_147_483_647);

export const createMatchSchema = z
  .object({
    home_club_id: clubId,
    away_club_id: clubId,
  })
  .refine((value) => value.home_club_id !== value.away_club_id, {
    message: 'Mandante e visitante devem ser clubes diferentes.',
  });

export type CreateMatchInput = z.infer<typeof createMatchSchema>;
