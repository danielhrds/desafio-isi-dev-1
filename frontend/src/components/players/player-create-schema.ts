import { z } from 'zod';
import {
  playerAgeSchema,
  playerAgilitySchema,
  playerNameSchema,
  playerPositionSchema,
} from './player-validation';

const attribute = z
  .number({ invalid_type_error: 'Informe um valor de 1 a 99.' })
  .int('Use um número inteiro de 1 a 99.')
  .min(1, 'Use um valor de 1 a 99.')
  .max(99, 'Use um valor de 1 a 99.');

export const playerCreateSchema = z
  .object({
    name: playerNameSchema,
    position: playerPositionSchema,
    age: playerAgeSchema,
    agility: playerAgilitySchema,
    pace: attribute,
    shooting: attribute,
    passing: attribute,
    dribbling: attribute,
    defending: attribute,
    physical: attribute,
    potential: z
      .number({ invalid_type_error: 'Informe o potencial.' })
      .int('Use um potencial inteiro de 1 a 99.')
      .min(1, 'Use um potencial de 1 a 99.')
      .max(99, 'Use um potencial de 1 a 99.'),
  })
  .superRefine((player, context) => {
    if (player.age >= 35 && player.agility > 85) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['agility'],
        message: 'Com 35 anos ou mais, use no máximo 85.',
      });
    }

    const attributes = [
      player.pace,
      player.shooting,
      player.passing,
      player.dribbling,
      player.defending,
      player.physical,
    ];
    if (attributes.reduce((sum, value) => sum + value, 0) > 480) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['physical'],
        message: 'A soma dos seis atributos não pode passar de 480.',
      });
    }

    const highest = Math.max(...attributes);
    if (player.potential < highest) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['potential'],
        message: 'O potencial deve ser pelo menos igual ao maior atributo.',
      });
    } else if (player.age >= 33 && player.potential !== highest) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['potential'],
        message: 'Com 33 anos ou mais, iguale o potencial ao maior atributo.',
      });
    }
  });

export type PlayerCreateFormValues = z.input<typeof playerCreateSchema>;
export type PlayerCreatePayload = z.output<typeof playerCreateSchema>;
