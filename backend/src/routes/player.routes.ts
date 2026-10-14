import { Router } from 'express';
import {
  createPlayer,
  updatePlayer,
} from '../controllers/player.controller.js';

export const playerRoutes = Router();

playerRoutes.post('/', createPlayer);
playerRoutes.put('/:id', updatePlayer);
