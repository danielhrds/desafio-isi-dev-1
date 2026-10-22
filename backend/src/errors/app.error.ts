export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'AppError';
  }
}
