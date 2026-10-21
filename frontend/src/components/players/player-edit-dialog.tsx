import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import {
  CircleAlert,
  LockKeyhole,
  LoaderCircle,
  UserRound,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdatePlayer } from '@/hooks/use-players';
import type { PlayerListItem, PlayerPosition } from '@/types/player';
import {
  createPlayerEditSchema,
  type PlayerEditFormValues,
  type PlayerEditPayload,
} from './player-edit-schema';

const positions: Array<{ value: PlayerPosition; label: string }> = [
  { value: 'GOL', label: 'Goleiro' },
  { value: 'ZAG', label: 'Zagueiro' },
  { value: 'LAT', label: 'Lateral' },
  { value: 'MEI', label: 'Meio-campo' },
  { value: 'ATA', label: 'Atacante' },
];

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      className="mt-1.5 flex items-start gap-1 text-xs text-destructive"
    >
      <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      {message}
    </p>
  );
}

export function PlayerEditDialog({
  player,
  onClose,
}: {
  player: PlayerListItem;
  onClose: () => void;
}) {
  const updatePlayer = useUpdatePlayer();
  const [serverError, setServerError] = useState<string | null>(null);
  const schema = useMemo(() => createPlayerEditSchema(player), [player]);
  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PlayerEditFormValues, unknown, PlayerEditPayload>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: player.name,
      position: player.position,
      age: player.age,
      agility: player.agility,
    },
  });
  const saving = isSubmitting || updatePlayer.isPending;
  const isAssigned = player.club_id !== null;

  async function submit(input: PlayerEditPayload) {
    setServerError(null);
    try {
      await updatePlayer.mutateAsync({ id: player.id, input });
      toast.success('Jogador atualizado', {
        description: `${input.name} foi atualizado com sucesso.`,
      });
      onClose();
    } catch (error) {
      setServerError(
        axios.isAxiosError<{ message?: string }>(error)
          ? (error.response?.data?.message ??
              'Verifique a conexão e tente novamente.')
          : 'Verifique a conexão e tente novamente.',
      );
    }
  }

  function close() {
    if (!saving) onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[560px]"
        showCloseButton={!saving}
      >
        <DialogHeader className="pr-7 text-left">
          <DialogTitle>Editar jogador</DialogTitle>
          <DialogDescription>
            Edite nome, posição, idade e agilidade. Os demais dados não mudam.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
          {serverError && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Não foi possível salvar alterações</AlertTitle>
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome</Label>
            <div className="relative">
              <UserRound
                aria-hidden="true"
                className="absolute top-2.5 left-3 size-4 text-muted-foreground"
              />
              <Input
                id="edit-name"
                autoComplete="name"
                maxLength={110}
                className="pl-9"
                aria-invalid={!!errors.name}
                aria-describedby={
                  errors.name ? 'edit-name-error' : 'edit-name-help'
                }
                {...register('name')}
              />
            </div>
            {errors.name ? (
              <FieldError id="edit-name-error" message={errors.name.message} />
            ) : (
              <p id="edit-name-help" className="text-xs text-muted-foreground">
                De 3 a 100 caracteres, com pelo menos duas palavras e sem
                números.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p id="edit-position-label" className="text-sm font-medium">
              Posição
            </p>
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-5"
              role="group"
              aria-labelledby="edit-position-label"
              aria-describedby={
                errors.position
                  ? 'edit-position-error'
                  : isAssigned
                    ? 'edit-position-help'
                    : undefined
              }
            >
              {positions.map((position) => (
                <Button
                  key={position.value}
                  type="button"
                  variant="outline"
                  aria-pressed={player.position === position.value}
                  disabled={
                    saving || (isAssigned && position.value !== player.position)
                  }
                  onClick={() =>
                    setValue('position', position.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  className="group h-14 min-w-0 flex-col gap-0.5 border-border font-semibold aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary"
                >
                  {position.value}
                  <span className="text-xs font-normal text-muted-foreground group-aria-pressed:text-primary">
                    {position.label}
                  </span>
                </Button>
              ))}
            </div>
            {errors.position ? (
              <FieldError
                id="edit-position-error"
                message={errors.position.message}
              />
            ) : isAssigned ? (
              <p
                id="edit-position-help"
                className="text-xs text-muted-foreground"
              >
                Jogador com clube não muda de posição: as outras posições ficam
                desabilitadas.
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-age">Idade</Label>
              <Input
                id="edit-age"
                type="number"
                inputMode="numeric"
                step="1"
                min={player.age}
                max={45}
                className="appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-invalid={!!errors.age}
                aria-describedby={
                  errors.age ? 'edit-age-error' : 'edit-age-help'
                }
                {...register('age', { valueAsNumber: true })}
              />
              {errors.age ? (
                <FieldError id="edit-age-error" message={errors.age.message} />
              ) : (
                <p id="edit-age-help" className="text-xs text-muted-foreground">
                  De 16 a 45, sem diminuir (atual: {player.age}).
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-agility">Agilidade</Label>
              <Input
                id="edit-agility"
                type="number"
                inputMode="numeric"
                step="1"
                min={1}
                max={100}
                className="appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-invalid={!!errors.agility}
                aria-describedby={
                  errors.agility ? 'edit-agility-error' : 'edit-agility-help'
                }
                {...register('agility', { valueAsNumber: true })}
              />
              {errors.agility ? (
                <FieldError
                  id="edit-agility-error"
                  message={errors.agility.message}
                />
              ) : (
                <p
                  id="edit-agility-help"
                  className="text-xs text-muted-foreground"
                >
                  De 1 a 100 (até 85 com 35 anos ou mais).
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
            <LockKeyhole aria-hidden="true" className="size-4 shrink-0" />
            <span>
              Não mudam depois do cadastro: valor base (
              {moneyFormatter.format(player.base_value)}), indicadores e
              potencial.
            </span>
          </div>

          <DialogFooter className="border-t pt-4">
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
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
