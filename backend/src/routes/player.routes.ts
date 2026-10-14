import { Router } from 'express';
import { createPlayer } from '../controllers/player.controller.js';

export const playerRoutes = Router();

playerRoutes.post('/', createPlayer);
