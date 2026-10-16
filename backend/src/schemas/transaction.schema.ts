import { z } from 'zod';

const playerId = z
  .string({ invalid_type_error: 'ID de jogador inválido.' })
  .regex(/^[1-9][0-9]*$/, 'ID de jogador inválido.')
  .refine((value) => Number(value) <= 2_147_483_647, 'ID de jogador inválido.');

export const listTransactionsQuerySchema = z.object({
  type: z
    .enum(['COMPRA', 'VENDA', 'COMPRA,VENDA', 'VENDA,COMPRA'], {
      errorMap: () => ({ message: 'Tipo de transação inválido.' }),
    })
    .optional(),
  player_id: playerId.optional(),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
