import { AppError } from '../errors/app.error.js';

export function parseResourceId(value: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new AppError(404, 'Recurso não encontrado.');
  }

  const id = Number(value);
  if (!Number.isInteger(id) || id > 2_147_483_647) {
    throw new AppError(404, 'Recurso não encontrado.');
  }

  return id;
}
