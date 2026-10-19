import { z } from 'zod';

const attribute = z.number().int().min(1).max(99);

export const createPlayerSchema = z.object({
  name: z.string(),
  position: z.enum(['GOL', 'ZAG', 'LAT', 'MEI', 'ATA']),
  agility: z.number().int().min(1).max(100),
  age: z.number().int().min(16).max(45),
  pace: attribute,
  shooting: attribute,
  passing: attribute,
  dribbling: attribute,
  defending: attribute,
  physical: attribute,
  potential: attribute,
});

export type CreatePlayerInput = z.infer<typeof createPlayerSchema>;

export const updatePlayerSchema = z.object(
  {
    name: z.string({
      required_error: 'O campo name é obrigatório.',
      invalid_type_error: 'O campo name deve ser um texto.',
    }),
    position: z.enum(['GOL', 'ZAG', 'LAT', 'MEI', 'ATA'], {
      errorMap: (issue) => ({
        message:
          issue.code === 'invalid_type' && issue.received === 'undefined'
            ? 'O campo position é obrigatório.'
            : 'O campo position deve ser GOL, ZAG, LAT, MEI ou ATA.',
      }),
    }),
    agility: z
      .number({
        required_error: 'O campo agility é obrigatório.',
        invalid_type_error: 'O campo agility deve ser um número inteiro.',
      })
      .int('O campo agility deve ser um número inteiro.')
      .min(1, 'O campo agility deve estar entre 1 e 100.')
      .max(100, 'O campo agility deve estar entre 1 e 100.'),
    age: z
      .number({
        required_error: 'O campo age é obrigatório.',
        invalid_type_error: 'O campo age deve ser um número inteiro.',
      })
      .int('O campo age deve ser um número inteiro.')
      .min(16, 'O campo age deve estar entre 16 e 45.')
      .max(45, 'O campo age deve estar entre 16 e 45.'),
  },
  { invalid_type_error: 'O corpo do PUT deve ser um objeto JSON.' },
);

export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>;

export const updatePlayerConditionSchema = z.object({
  condition: z.enum(['APTO', 'MAL_CONDICIONADO', 'DOENTE']),
});

export type UpdatePlayerConditionInput = z.infer<
  typeof updatePlayerConditionSchema
>;

const canonicalPositiveInteger = z
  .string()
  .regex(/^[1-9][0-9]*$/)
  .refine((value) => Number(value) <= 2_147_483_647);

const ageFilter = canonicalPositiveInteger.refine(
  (value) => Number(value) >= 16 && Number(value) <= 45,
);

const monetaryFilter = z
  .string()
  .regex(/^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/)
  .refine((value) => Number(value) <= 550);

const sortFields = [
  'name',
  'value_asc',
  'value_desc',
  'age_asc',
  'age_desc',
  'position',
] as const;

export type PlayerSort = (typeof sortFields)[number];

function sortField(value: string): string {
  if (value.startsWith('value_')) return 'value';
  if (value.startsWith('age_')) return 'age';
  return value;
}

export function normalizePlayerSearch(value: string): string {
  return value.replace(/^ +| +$/g, '').replace(/ {2,}/g, ' ');
}

export const listPlayersQuerySchema = z
  .object({
    search: z
      .string()
      .refine((value) => {
        const normalized = normalizePlayerSearch(value);
        return (
          !/\p{Cc}/u.test(value) &&
          [...normalized].length >= 2 &&
          [...normalized].length <= 100
        );
      })
      .optional(),
    position: z.enum(['GOL', 'ZAG', 'LAT', 'MEI', 'ATA']).optional(),
    condition: z.enum(['APTO', 'MAL_CONDICIONADO', 'DOENTE']).optional(),
    free: z.enum(['true', 'false']).optional(),
    club_id: canonicalPositiveInteger.optional(),
    min_age: ageFilter.optional(),
    max_age: ageFilter.optional(),
    min_value: monetaryFilter.optional(),
    max_value: monetaryFilter.optional(),
    sort: z
      .string()
      .refine((value) => {
        const parts = value.split(',');
        return (
          parts.length <= 2 &&
          parts.every((part) => sortFields.includes(part as PlayerSort)) &&
          new Set(parts.map(sortField)).size === parts.length
        );
      })
      .optional(),
    page: canonicalPositiveInteger.optional(),
    limit: canonicalPositiveInteger
      .refine((value) => Number(value) <= 50)
      .optional(),
  })
  .superRefine((query, context) => {
    if (
      query.min_age !== undefined &&
      query.max_age !== undefined &&
      Number(query.min_age) > Number(query.max_age)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['min_age'],
        message: 'Faixa de idade inválida.',
      });
    }
    if (
      query.min_value !== undefined &&
      query.max_value !== undefined &&
      Number(query.min_value) > Number(query.max_value)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['min_value'],
        message: 'Faixa de valor inválida.',
      });
    }
    if (query.free === 'true' && query.club_id !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['free'],
        message: 'Jogadores livres não podem ser filtrados por clube.',
      });
    }
  });

export type ListPlayersQuery = z.infer<typeof listPlayersQuerySchema>;
