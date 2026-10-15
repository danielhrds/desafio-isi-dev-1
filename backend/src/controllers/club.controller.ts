import type { RequestHandler } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { createClubSchema } from '../schemas/club.schema.js';
import { clubService } from '../services/club.service.js';

export const createClub: RequestHandler = asyncHandler(
  async (request, response) => {
    const input = createClubSchema.parse(request.body);
    const club = await clubService.createClub(input);
    response.location(`/api/v1/clubs/${club.id}`).status(201).json(club);
  },
);
