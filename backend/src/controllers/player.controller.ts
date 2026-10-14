import type { RequestHandler } from 'express';
import {
  createPlayerSchema,
  listPlayersQuerySchema,
  updatePlayerSchema,
} from '../schemas/player.schema.js';
import { playerService } from '../services/player.service.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { parseResourceId } from '../validation/resource-id.js';

export const listPlayers: RequestHandler = asyncHandler(
  async (request, response) => {
    const query = listPlayersQuerySchema.parse(request.query);
    const result = await playerService.listPlayers(query);
    response.status(200).json(result);
  },
);

export const getPlayerById: RequestHandler = asyncHandler(
  async (request, response) => {
    const id = parseResourceId(request.params.id);
    const player = await playerService.getPlayerById(id);
    response.status(200).json(player);
  },
);

export const createPlayer: RequestHandler = asyncHandler(
  async (request, response) => {
    const input = createPlayerSchema.parse(request.body);
    const player = await playerService.createPlayer(input);
    response.location(`/api/v1/players/${player.id}`).status(201).json(player);
  },
);

export const updatePlayer: RequestHandler = asyncHandler(
  async (request, response) => {
    const id = parseResourceId(request.params.id);
    const input = updatePlayerSchema.parse(request.body);
    const player = await playerService.updatePlayer(id, input);
    response.status(200).json(player);
  },
);
