import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  BarChart3,
  Info,
  LoaderCircle,
  LockKeyhole,
  UserRound,
} from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { ErrorAlert } from '@/components/error-alert';
import { FormInput } from '@/components/form-input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useCreatePlayer } from '@/hooks/use-players';
import { apiErrorMessage } from '@/lib/api-error';
import type { PlayerDetail } from '@/types/player';
import { PlayerPositionField } from './player-position-field';
import {
  playerCreateSchema,
  type PlayerCreateFormValues,
  type PlayerCreatePayload,
} from './player-create-schema';

const attributes = [
  { key: 'pace', label: 'Velocidade' },
  { key: 'shooting', label: 'Finalização' },
  { key: 'passing', label: 'Passe' },
  { key: 'dribbling', label: 'Drible' },
  { key: 'defending', label: 'Defesa' },
  { key: 'physical', label: 'Físico' },
] as const;

type NumericField =
  | 'age'
  | 'agility'
  | 'pace'
  | 'shooting'
  | 'passing'
  | 'dribbling'
  | 'defending'
  | 'physical'
  | 'potential';

function CalculatedField({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex h-9 items-center gap-2 rounded-md border border-dashed bg-muted px-3 text-sm text-muted-foreground">
        <LockKeyhole aria-hidden="true" className="size-4 shrink-0" />
        Após salvar
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export function PlayerCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (player: PlayerDetail) => void;
}) {
  const createPlayer = useCreatePlayer();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    setValue,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<PlayerCreateFormValues, unknown, PlayerCreatePayload>({
    resolver: zodResolver(playerCreateSchema),
  });
  const values = useWatch({ control });
  const saving = isSubmitting || createPlayer.isPending;

  const attributeValues = attributes.map(({ key }) => values[key]);
  const highestAttribute = Math.max(
    ...attributeValues.map((value) => value ?? 0),
  );
  const validPreview =
    attributeValues.every(
      (value) =>
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= 99,
    ) &&
    attributeValues.reduce<number>((sum, value) => sum + (value ?? 0), 0) <=
      480 &&
    typeof values.potential === 'number' &&
    Number.isInteger(values.potential) &&
    values.potential >= highestAttribute &&
    values.potential <= 99 &&
    (typeof values.age !== 'number' ||
      values.age < 33 ||
      values.potential === highestAttribute);

  async function submit(payload: PlayerCreatePayload) {
    setServerError(null);
    try {
      const player = await createPlayer.mutateAsync(payload);
      onCreated(player);
    } catch (error) {
      setServerError(apiErrorMessage(error));
    }
  }

  function close() {
    if (!saving) onOpenChange(false);
  }

  function numberInput(
    name: NumericField,
    label: string,
    min: number,
    max: number,
    help?: string,
  ) {
    return (
      <FormInput
        key={name}
        id={`create-${name}`}
        label={label}
        type="number"
        inputMode="numeric"
        step="1"
        min={min}
        max={max}
        fieldClassName="min-w-0"
        className="appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        error={errors[name]?.message}
        help={help}
        {...register(name, { valueAsNumber: true })}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[852px]"
        showCloseButton={!saving}
      >
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 pr-12 text-left">
          <DialogTitle>Novo jogador</DialogTitle>
          <DialogDescription>
            {isSubmitted && Object.keys(errors).length > 0
              ? 'Corrija os campos destacados para salvar.'
              : 'Preencha os dados e os indicadores técnicos. O valor base, o overall e o valor de mercado são calculados ao salvar.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(submit)}
          noValidate
          className="flex min-h-0 flex-col"
        >
          <div className="min-h-0 space-y-5 overflow-y-auto px-6 pb-5">
            {serverError && (
              <ErrorAlert
                title="Não foi possível cadastrar"
                message={serverError}
              />
            )}

            <FormInput
              id="create-name"
              label="Nome"
              icon={UserRound}
              autoComplete="name"
              maxLength={110}
              error={errors.name?.message}
              help="De 3 a 100 caracteres, com pelo menos duas palavras e sem números."
              {...register('name')}
            />

            <PlayerPositionField
              idPrefix="create"
              value={values.position}
              error={errors.position?.message}
              onChange={(position) =>
                setValue('position', position, { shouldValidate: true })
              }
            />

            <div className="grid gap-4 sm:grid-cols-3">
              {numberInput('age', 'Idade', 16, 45, 'De 16 a 45 anos.')}
              {numberInput(
                'agility',
                'Agilidade',
                1,
                100,
                'De 1 a 100 (até 85 com 35 anos ou mais).',
              )}
              <CalculatedField
                label="Valor base (moedas)"
                description="Calculado no cadastro."
              />
            </div>

            <div className="border-t pt-5">
              <h3 className="font-semibold">Indicadores técnicos</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Seis atributos e o potencial, de 1 a 99. Não mudam depois do
                cadastro; a soma dos seis atributos não pode passar de 480.
              </p>
              <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_244px]">
                <div className="grid grid-cols-2 content-start gap-x-3 gap-y-4 sm:grid-cols-4">
                  {attributes.map(({ key, label }) =>
                    numberInput(key, label, 1, 99),
                  )}
                  {numberInput(
                    'potential',
                    'Potencial',
                    1,
                    99,
                    '≥ maior atributo; igual a ele com 33+ anos.',
                  )}
                  <CalculatedField
                    label="Overall"
                    description="Calculado automaticamente."
                  />
                </div>

                <div className="self-start rounded-xl border bg-muted/30 p-3">
                  <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <BarChart3 aria-hidden="true" className="size-3.5" />
                    Prévia dos atributos
                  </p>
                  {validPreview ? (
                    <div className="mt-3 space-y-2.5">
                      {attributes.map(({ key, label }) => (
                        <div
                          key={key}
                          className="grid grid-cols-[68px_1fr_24px] items-center gap-2 text-xs"
                        >
                          <span className="text-muted-foreground">{label}</span>
                          <div className="h-1.5 rounded-full bg-muted">
                            <Progress
                              value={
                                ((values[key] ?? 0) / (values.potential ?? 1)) *
                                100
                              }
                              className="h-1.5 bg-primary/20"
                              style={{ width: `${values.potential ?? 0}%` }}
                            />
                          </div>
                          <span className="text-right tabular-nums">
                            {values[key]}
                          </span>
                        </div>
                      ))}
                      <p className="pt-1 text-xs text-muted-foreground">
                        Faixa clara: até o potencial ({values.potential}). A
                        prévia só desenha os valores digitados; não calcula
                        overall nem valor base.
                      </p>
                    </div>
                  ) : (
                    <p className="flex min-h-32 items-center justify-center px-2 text-center text-xs text-muted-foreground">
                      Corrija os valores destacados para ver a prévia.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 items-center justify-between border-t px-6 py-4 sm:justify-between">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info aria-hidden="true" className="size-4 shrink-0" />O jogador
              começa livre e Apto.
            </p>
            <div className="flex gap-2 self-end">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={close}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                )}
                Salvar jogador
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
