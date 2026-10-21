import { z } from 'zod';

const clubIdField = z
  .string()
  .min(1, 'Selecione um clube.')
  .regex(/^[1-9]\d*$/, 'Selecione um clube válido.')
  .refine((value) => Number(value) <= 2_147_483_647, {
    message: 'Selecione um clube válido.',
  })
  .transform(Number);

export const createMatchSchema = z
  .object({
    homeClubId: clubIdField,
    awayClubId: clubIdField,
  })
  .refine((values) => values.homeClubId !== values.awayClubId, {
    path: ['awayClubId'],
    message: 'Precisa ser um clube diferente do mandante.',
  })
  .transform(({ homeClubId, awayClubId }) => ({
    home_club_id: homeClubId,
    away_club_id: awayClubId,
  }));

export type CreateMatchFormValues = z.input<typeof createMatchSchema>;
export type CreateMatchPayload = z.output<typeof createMatchSchema>;

export const emptyCreateMatchForm: CreateMatchFormValues = {
  homeClubId: '',
  awayClubId: '',
};
