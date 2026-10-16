import { z } from 'zod';
import { isBrasiliaDateTime } from '../validation/brasilia-datetime.js';

export const buyPlayerSchema = z.object({
  club_id: z.number().int().positive().max(2_147_483_647),
  loyalty_until: z
    .string()
    .refine(isBrasiliaDateTime, 'Data e hora de fidelidade inválidas.'),
});

export type BuyPlayerInput = z.infer<typeof buyPlayerSchema>;
