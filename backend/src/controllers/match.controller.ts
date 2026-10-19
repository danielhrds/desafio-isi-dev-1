import type { RequestHandler } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  createMatchSchema,
  listMatchesQuerySchema,
} from '../schemas/match.schema.js';
import { matchService } from '../services/match.service.js';
import { parseResourceId } from '../validation/resource-id.js';

export const listMatches: RequestHandler = asyncHandler(
  async (request, response) => {
    const query = listMatchesQuerySchema.parse(request.query);
    const matches = await matchService.listMatches(query.club_id);
    response.status(200).json(matches);
  },
);

export const getMatchById: RequestHandler = asyncHandler(
  async (request, response) => {
    const id = parseResourceId(request.params.id);
    const match = await matchService.getMatchById(id);
    response.status(200).json(match);
  },
);

export const createMatch: RequestHandler = asyncHandler(
  async (request, response) => {
    const input = createMatchSchema.parse(request.body);
    const match = await matchService.playMatch(input);
    response.location(`/api/v1/matches/${match.id}`).status(201).json(match);
  },
);
