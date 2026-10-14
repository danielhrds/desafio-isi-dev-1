import type { RequestHandler } from 'express';
import { createPlayerSchema } from '../schemas/player.schema.js';
import { playerService } from '../services/player.service.js';
import { asyncHandler } from '../middleware/async-handler.js';

export const createPlayer: RequestHandler = asyncHandler(
  async (request, response) => {
    const input = createPlayerSchema.parse(request.body);
    const player = await playerService.createPlayer(input);
    response.location(`/api/v1/players/${player.id}`).status(201).json(player);
  },
);
