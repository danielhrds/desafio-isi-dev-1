import axios from 'axios';

export function apiErrorMessage(
  error: unknown,
  fallback = 'Verifique a conexão e tente novamente.',
): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? fallback;
  }

  return fallback;
}
