import { Router } from 'express';
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
playerRoutes.put('/:id', updatePlayer);
playerRoutes.delete('/:id', deletePlayer);
