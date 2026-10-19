import type { RequestHandler } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { standingsService } from '../services/standings.service.js';

export const getStandings: RequestHandler = asyncHandler(
  async (_request, response) => {
    response.status(200).json(await standingsService.getStandings());
  },
);
