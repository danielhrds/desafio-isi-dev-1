import { Router } from 'express';
import {
  createPlayer,
  listPlayers,
  updatePlayer,
} from '../controllers/player.controller.js';

export const playerRoutes = Router();

playerRoutes.get('/', listPlayers);
playerRoutes.post('/', createPlayer);
playerRoutes.put('/:id', updatePlayer);
