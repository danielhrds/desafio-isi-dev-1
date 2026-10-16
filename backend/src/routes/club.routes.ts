import { Router } from 'express';
import { createClub, listClubs } from '../controllers/club.controller.js';
import { listTransactions } from '../controllers/transaction.controller.js';

export const clubRoutes = Router();

clubRoutes.get('/', listClubs);
clubRoutes.get('/:id/transactions', listTransactions);
clubRoutes.post('/', createClub);
