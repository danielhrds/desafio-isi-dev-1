import type { RequestHandler } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { listTransactionsQuerySchema } from '../schemas/transaction.schema.js';
import { transactionService } from '../services/transaction.service.js';
import { parseResourceId } from '../validation/resource-id.js';

export const listTransactions: RequestHandler = asyncHandler(
  async (request, response) => {
    const clubId = parseResourceId(request.params.id);
    const query = listTransactionsQuerySchema.parse(request.query);
    const result = await transactionService.listTransactions(clubId, query);
    response.status(200).json(result);
  },
);

export const exportTransactions: RequestHandler = asyncHandler(
  async (request, response) => {
    const clubId = parseResourceId(request.params.id);
    const query = listTransactionsQuerySchema.parse(request.query);
    const csv = await transactionService.exportTransactions(clubId, query);
    response
      .status(200)
      .type('text/csv')
      .set(
        'Content-Disposition',
        `attachment; filename="club-${clubId}-transactions.csv"`,
      )
      .send(csv);
  },
);
