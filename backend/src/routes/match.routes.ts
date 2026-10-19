import { Router } from 'express';
import {
  createMatch,
  getMatchById,
  listMatches,
} from '../controllers/match.controller.js';

export const matchRoutes = Router();

matchRoutes.post('/', createMatch);
matchRoutes.get('/', listMatches);
matchRoutes.get('/:id', getMatchById);
