import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './docs/openapi.js';

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  }),
);
app.use(express.json());
app.use(morgan('[:date[iso]] :method :url :status'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.get('/api/v1/health', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});

export { app };
