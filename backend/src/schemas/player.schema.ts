import { z } from 'zod';

const attribute = z.number().int().min(1).max(99);

export const createPlayerSchema = z.object({
  name: z.string(),
  position: z.enum(['GOL', 'ZAG', 'LAT', 'MEI', 'ATA']),
  agility: z.number().int().min(1).max(100),
  age: z.number().int().min(16).max(45),
  pace: attribute,
  shooting: attribute,
  passing: attribute,
  dribbling: attribute,
  defending: attribute,
  physical: attribute,
  potential: attribute,
});

export type CreatePlayerInput = z.infer<typeof createPlayerSchema>;
