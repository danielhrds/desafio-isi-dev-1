import { Router } from 'express';
import { createMatch, getMatchById } from '../controllers/match.controller.js';

export const matchRoutes = Router();

matchRoutes.post('/', createMatch);
matchRoutes.get('/:id', getMatchById);
