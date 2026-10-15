import { z } from 'zod';

export const createClubSchema = z.object({
  name: z.string(),
  acronym: z.string(),
});

export type CreateClubInput = z.infer<typeof createClubSchema>;
