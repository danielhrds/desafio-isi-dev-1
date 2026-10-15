import { z } from 'zod';

export const createClubSchema = z.object({
  name: z.string(),
  acronym: z.string(),
});

export type CreateClubInput = z.infer<typeof createClubSchema>;

export const listClubsQuerySchema = z.object({
  sort: z.enum(['name', 'net_worth_asc', 'net_worth_desc']).optional(),
});

export type ListClubsQuery = z.infer<typeof listClubsQuerySchema>;
