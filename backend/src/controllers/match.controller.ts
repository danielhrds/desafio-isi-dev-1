import type { RequestHandler } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { createMatchSchema } from '../schemas/match.schema.js';
import { matchService } from '../services/match.service.js';

export const createMatch: RequestHandler = asyncHandler(
  async (request, response) => {
    const input = createMatchSchema.parse(request.body);
    const match = await matchService.playMatch(input);
    response.location(`/api/v1/matches/${match.id}`).status(201).json(match);
  },
);
