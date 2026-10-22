import { z } from 'zod';

function normalizeName(value: string): string {
  return value.replace(/^ +| +$/g, '').replace(/ {2,}/g, ' ');
}

function containsControl(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0);
    return code !== undefined && (code < 32 || (code >= 127 && code <= 159));
  });
}

export const playerNameSchema = z
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
  });

export const playerPositionSchema = z.enum(
  ['GOL', 'ZAG', 'LAT', 'MEI', 'ATA'],
  {
    required_error: 'Selecione uma posição.',
  },
);

export const playerAgeSchema = z
  .number({ invalid_type_error: 'Informe a idade.' })
  .int('Use uma idade inteira de 16 a 45 anos.')
  .min(16, 'Use uma idade de 16 a 45 anos.')
  .max(45, 'Use uma idade de 16 a 45 anos.');

export const playerAgilitySchema = z
  .number({ invalid_type_error: 'Informe a agilidade.' })
  .int('Use uma agilidade inteira de 1 a 100.')
  .min(1, 'Use uma agilidade de 1 a 100.')
  .max(100, 'Use uma agilidade de 1 a 100.');
