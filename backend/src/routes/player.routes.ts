import { Router } from 'express';
import { buyPlayer } from '../controllers/market.controller.js';
import {
  createPlayer,
  deletePlayer,
  getPlayerById,
  listPlayers,
  updatePlayer,
} from '../controllers/player.controller.js';

export const playerRoutes = Router();

playerRoutes.get('/', listPlayers);
playerRoutes.get('/:id', getPlayerById);
playerRoutes.post('/', createPlayer);
playerRoutes.post('/:id/buy', buyPlayer);
playerRoutes.put('/:id', updatePlayer);
playerRoutes.delete('/:id', deletePlayer);
