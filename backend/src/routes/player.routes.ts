import { Router } from 'express';
import { buyPlayer } from '../controllers/market.controller.js';
import {
  createPlayer,
  deletePlayer,
  getPlayerById,
  listPlayers,
  updatePlayer,
  updatePlayerCondition,
} from '../controllers/player.controller.js';

export const playerRoutes = Router();

playerRoutes.get('/', listPlayers);
playerRoutes.get('/:id', getPlayerById);
playerRoutes.post('/', createPlayer);
playerRoutes.post('/:id/buy', buyPlayer);
playerRoutes.put('/:id', updatePlayer);
playerRoutes.patch('/:id/condition', updatePlayerCondition);
playerRoutes.delete('/:id', deletePlayer);
