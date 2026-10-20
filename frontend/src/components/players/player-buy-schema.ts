import { z } from 'zod';

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}

export const playerBuySchema = z
  .object({
    club_id: z
      .string()
      .min(1, 'Selecione o clube comprador.')
      .refine((value) => value === '' || /^[1-9]\d*$/.test(value), {
        message: 'Selecione um clube válido.',
      }),
    loyalty_date: z
      .string()
      .min(1, 'Informe a data do fim da fidelidade.')
      .refine((value) => value === '' || isValidCalendarDate(value), {
        message: 'Informe uma data válida.',
      }),
    loyalty_time: z
      .string()
      .min(1, 'Informe o horário do fim da fidelidade.')
      .refine(
        (value) => value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value),
        {
          message: 'Informe um horário válido.',
        },
      ),
  })
  .transform(({ club_id, loyalty_date, loyalty_time }) => ({
    club_id: Number(club_id),
    loyalty_until: `${loyalty_date}T${loyalty_time}-03:00`,
  }));

export type PlayerBuyFormValues = z.input<typeof playerBuySchema>;
export type PlayerBuyPayload = z.output<typeof playerBuySchema>;
