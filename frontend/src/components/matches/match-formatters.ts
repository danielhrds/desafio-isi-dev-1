import axios from 'axios';
import type { MatchAttackAttribute, MatchResult } from '@/types/match';
import type { PlayerCondition, PlayerPosition } from '@/types/player';

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'America/Sao_Paulo',
});

export function formatMatchDateTime(dateTime: string): string {
  return dateTimeFormatter.format(new Date(dateTime));
}

export const resultLabels: Record<MatchResult, string> = {
  MANDANTE: 'Vitória do mandante',
  VISITANTE: 'Vitória do visitante',
  EMPATE: 'Empate',
};

export const attackAttributeLabels: Record<MatchAttackAttribute, string> = {
  shooting: 'Finalização',
  passing: 'Passe',
  dribbling: 'Drible',
};

export function matchAttributeLabel(
  attribute: MatchAttackAttribute | 'defending',
): string {
  return attribute === 'defending'
    ? 'Defesa'
    : attackAttributeLabels[attribute];
}

export const positionLabels: Record<PlayerPosition, string> = {
  GOL: 'Goleiro',
  ZAG: 'Zagueiro',
  LAT: 'Lateral',
  MEI: 'Meio-campo',
  ATA: 'Atacante',
};

export const conditionLabels: Record<PlayerCondition, string> = {
  APTO: 'Apto',
  MAL_CONDICIONADO: 'Mal condicionado',
  DOENTE: 'Doente',
};

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return (
      error.response?.data?.message ?? 'Verifique a conexão e tente novamente.'
    );
  }

  return 'Verifique a conexão e tente novamente.';
}

export function isNotFound(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}
