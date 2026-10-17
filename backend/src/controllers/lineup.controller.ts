import type { RequestHandler } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { putLineupSchema } from '../schemas/lineup.schema.js';
import { lineupService } from '../services/lineup.service.js';
import { parseResourceId } from '../validation/resource-id.js';

export const putClubLineup: RequestHandler = asyncHandler(
  async (request, response) => {
    const clubId = parseResourceId(request.params.id);
    const input = putLineupSchema.parse(request.body);
    const lineup = await lineupService.setLineup(clubId, input);
    response.status(200).json(lineup);
  },
);
