import { z } from 'zod';

export const playerConditionSchema = z.object({
  condition: z.enum(['APTO', 'MAL_CONDICIONADO', 'DOENTE']),
});

export type PlayerConditionFormValues = z.infer<typeof playerConditionSchema>;
