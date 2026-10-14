import { Router } from 'express';
import {
  createPlayer,
  getPlayerById,
  listPlayers,
  updatePlayer,
} from '../controllers/player.controller.js';

export const playerRoutes = Router();

playerRoutes.get('/', listPlayers);
playerRoutes.get('/:id', getPlayerById);
playerRoutes.post('/', createPlayer);
playerRoutes.put('/:id', updatePlayer);
