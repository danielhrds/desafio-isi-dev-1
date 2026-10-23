import request from 'supertest';
import { app } from '../src/app.js';

describe('B5.4: uma linha de log por requisição HTTP', () => {
  it.each([
    ['sucesso', 'get', '/api/v1/health', 200],
    ['rota inexistente', 'get', '/api/v1/logging-not-found', 404],
    ['JSON malformado', 'post', '/api/v1/players', 400],
    ['preflight CORS', 'options', '/api/v1/players', 204],
  ] as const)(
    '%s inclui data, método, caminho e status',
    async (_label, method, path, status) => {
      const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

      try {
        let operation = request(app)[method](path);
        if (method === 'post') {
          operation = operation
            .set('Content-Type', 'application/json')
            .send('{"name":');
        }
        if (method === 'options') {
          operation = operation
            .set(
              'Origin',
              process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
            )
            .set('Access-Control-Request-Method', 'POST');
        }

        const response = await operation;
        expect(response.status).toBe(status);

        await vi.waitFor(() => {
          expect(write).toHaveBeenCalledTimes(1);
        });
        const line = String(write.mock.calls[0][0]);
        const log = line.match(
          /^\[([^\]]+)\] (GET|POST|OPTIONS) (\S+) (\d{3})\n$/,
        );
        expect(log).not.toBeNull();
        expect(log!.slice(2)).toEqual([
          method.toUpperCase(),
          path,
          String(status),
        ]);
        expect(new Date(log![1]).toISOString()).toBe(log![1]);
      } finally {
        write.mockRestore();
      }
    },
  );
});
