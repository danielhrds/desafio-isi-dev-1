import express from 'express';
import request from 'supertest';
import { errorMiddleware } from '../src/middleware/error.middleware.js';

it('V9: erro interno não expõe mensagem técnica nem stack trace', async () => {
  const app = express();
  app.get('/failure', () => {
    throw new Error('segredo interno');
  });
  app.use(errorMiddleware);

  const response = await request(app).get('/failure');
  expect(response.status).toBe(500);
  expect(response.headers['content-type']).toMatch(/^application\/json/);
  expect(response.body).toEqual({ message: 'Erro interno do servidor.' });
  expect(response.text).not.toContain('segredo interno');
  expect(response.text).not.toContain('stack');
});
