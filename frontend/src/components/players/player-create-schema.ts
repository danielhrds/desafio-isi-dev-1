import { z } from 'zod';

const attribute = z
  .number({ invalid_type_error: 'Informe um valor de 1 a 99.' })
  .int('Use um número inteiro de 1 a 99.')
  .min(1, 'Use um valor de 1 a 99.')
  .max(99, 'Use um valor de 1 a 99.');

function normalizeName(value: string): string {
  return value.replace(/^ +| +$/g, '').replace(/ {2,}/g, ' ');
}

function containsControl(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0);
    return code !== undefined && (code < 32 || (code >= 127 && code <= 159));
  });
}

export const playerCreateSchema = z
  .object({
    name: z
      .string()
      .transform(normalizeName)
      .superRefine((name, context) => {
        if ([...name].length < 3 || [...name].length > 100) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Use de 3 a 100 caracteres.',
          });
        } else if (name.split(' ').length < 2 || /[0-9]/u.test(name)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Use pelo menos duas palavras, sem números.',
          });
        } else if (containsControl(name)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Não use caracteres de controle.',
          });
        }
      }),
    position: z.enum(['GOL', 'ZAG', 'LAT', 'MEI', 'ATA']),
    age: z
      .number({ invalid_type_error: 'Informe a idade.' })
      .int('Use uma idade inteira de 16 a 45 anos.')
      .min(16, 'Use uma idade de 16 a 45 anos.')
      .max(45, 'Use uma idade de 16 a 45 anos.'),
    agility: z
      .number({ invalid_type_error: 'Informe a agilidade.' })
      .int('Use uma agilidade inteira de 1 a 100.')
      .min(1, 'Use uma agilidade de 1 a 100.')
      .max(100, 'Use uma agilidade de 1 a 100.'),
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
