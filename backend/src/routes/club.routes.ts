import { Router } from 'express';
import { createClub } from '../controllers/club.controller.js';

export const clubRoutes = Router();

clubRoutes.post('/', createClub);
