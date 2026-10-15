import { Router } from 'express';
import { createClub, listClubs } from '../controllers/club.controller.js';

export const clubRoutes = Router();

clubRoutes.get('/', listClubs);
clubRoutes.post('/', createClub);
