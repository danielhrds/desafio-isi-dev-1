import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app.error.js';

export const errorMiddleware: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    res
      .status(400)
      .json({ message: error.issues[0]?.message ?? 'Dados inválidos.' });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.status).json({ message: error.message });
    return;
  }

  if (
    error instanceof SyntaxError &&
    'type' in error &&
    error.type === 'entity.parse.failed'
  ) {
    res.status(400).json({ message: 'JSON inválido.' });
    return;
  }

  res.status(500).json({ message: 'Erro interno do servidor.' });
};
