import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { clubRoutes } from './routes/club.routes.js';
import { openApiDocument } from './docs/openapi.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { playerRoutes } from './routes/player.routes.js';
import { matchRoutes } from './routes/match.routes.js';
import { standingsRoutes } from './routes/standings.routes.js';

const app = express();
const jsonParser = express.json();
const requestsWithoutBody = new Set(['GET', 'HEAD', 'DELETE']);
const playerSalePath = /^\/api\/v1\/players\/[^/]+\/sell\/?$/i;

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  }),
);
app.use((request, response, next) => {
  const isSaleWithoutBody =
    request.method === 'POST' && playerSalePath.test(request.path);

  if (requestsWithoutBody.has(request.method) || isSaleWithoutBody) {
    request.resume();
    next();
    return;
  }

  jsonParser(request, response, next);
});
app.use(morgan('[:date[iso]] :method :url :status'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.get('/api/v1/health', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});

app.use('/api/v1/players', playerRoutes);
app.use('/api/v1/clubs', clubRoutes);
app.use('/api/v1/matches', matchRoutes);
app.use('/api/v1/standings', standingsRoutes);
app.use((_request, response) => {
  response.status(404).json({ message: 'Rota não encontrada.' });
});
app.use(errorMiddleware);

export { app };
