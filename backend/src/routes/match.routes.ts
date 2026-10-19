import { Router } from 'express';
import { createMatch } from '../controllers/match.controller.js';

export const matchRoutes = Router();

matchRoutes.post('/', createMatch);
