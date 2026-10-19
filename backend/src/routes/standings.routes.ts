import { Router } from 'express';
import { getStandings } from '../controllers/standings.controller.js';

export const standingsRoutes = Router();

standingsRoutes.get('/', getStandings);
