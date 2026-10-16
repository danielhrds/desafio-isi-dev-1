import { Router } from 'express';
import {
  createClub,
  getClubById,
  listClubs,
} from '../controllers/club.controller.js';
import {
  exportTransactions,
  listTransactions,
} from '../controllers/transaction.controller.js';

export const clubRoutes = Router();

clubRoutes.get('/', listClubs);
clubRoutes.get('/:id/transactions/export', exportTransactions);
clubRoutes.get('/:id/transactions', listTransactions);
clubRoutes.get('/:id', getClubById);
clubRoutes.post('/', createClub);
