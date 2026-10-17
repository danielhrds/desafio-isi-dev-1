import { z } from 'zod';

export const putLineupSchema = z.object({
  formation: z.enum(['3-1', '2-2', '2-1-1', '1-2-1']),
  player_ids: z
    .array(z.number().int().min(1).max(2_147_483_647))
    .length(5)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'Os cinco jogadores devem ser distintos.',
    }),
});

export type PutLineupInput = z.infer<typeof putLineupSchema>;
