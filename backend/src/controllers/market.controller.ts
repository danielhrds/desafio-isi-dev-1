import type { RequestHandler } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { buyPlayerSchema } from '../schemas/market.schema.js';
import { marketService } from '../services/market.service.js';
import { parseResourceId } from '../validation/resource-id.js';

export const buyPlayer: RequestHandler = asyncHandler(
  async (request, response) => {
    const playerId = parseResourceId(request.params.id);
    const input = buyPlayerSchema.parse(request.body);
    const purchase = await marketService.buyPlayer(playerId, input);
    response.status(200).json(purchase);
  },
);

export const sellPlayer: RequestHandler = asyncHandler(
  async (request, response) => {
    const playerId = parseResourceId(request.params.id);
    const sale = await marketService.sellPlayer(playerId);
    response.status(200).json(sale);
  },
);
