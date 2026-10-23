import { z } from 'zod';
import { normalizeSpaces } from '@/lib/text';

export const clubCreateSchema = z.object({
  name: z
    .string({ required_error: 'Informe o nome do clube.' })
    .transform(normalizeSpaces)
    .superRefine((name, context) => {
      const length = [...name].length;
      if (length < 3 || length > 60) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            length < 3
              ? 'Use pelo menos 3 caracteres.'
              : 'Use no máximo 60 caracteres.',
        });
      }
    }),
  acronym: z
    .string({ required_error: 'Informe a sigla do clube.' })
    .length(3, 'A sigla deve ter exatamente 3 letras.')
    .regex(/^[A-Z]{3}$/, 'Use 3 letras maiúsculas de A a Z.'),
});

export type ClubCreateFormValues = z.input<typeof clubCreateSchema>;
export type ClubCreatePayload = z.output<typeof clubCreateSchema>;
