import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { LockKeyhole, LoaderCircle, UserRound } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
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
import { useUpdatePlayer } from '@/hooks/use-players';
import { apiErrorMessage } from '@/lib/api-error';
import type { PlayerListItem } from '@/types/player';
import { PlayerPositionField } from './player-position-field';
import {
  createPlayerEditSchema,
  type PlayerEditFormValues,
  type PlayerEditPayload,
} from './player-edit-schema';

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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
    control,
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
  const selectedPosition = useWatch({ control, name: 'position' });
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
      setServerError(apiErrorMessage(error));
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
            <ErrorAlert
              title="Não foi possível salvar alterações"
              message={serverError}
            />
          )}

          <FormInput
            id="edit-name"
            label="Nome"
            icon={UserRound}
            autoComplete="name"
            error={errors.name?.message}
            help="De 3 a 100 caracteres, com pelo menos duas palavras e sem números."
            {...register('name')}
          />

          <PlayerPositionField
            idPrefix="edit"
            value={selectedPosition}
            error={errors.position?.message}
            disabled={saving}
            lockedPosition={isAssigned ? player.position : undefined}
            onChange={(position) =>
              setValue('position', position, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput
              id="edit-age"
              label="Idade"
              type="number"
              inputMode="numeric"
              step="1"
              min={player.age}
              max={45}
              className="appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              error={errors.age?.message}
              help={<>De 16 a 45, sem diminuir (atual: {player.age}).</>}
              {...register('age', { valueAsNumber: true })}
            />

            <FormInput
              id="edit-agility"
              label="Agilidade"
              type="number"
              inputMode="numeric"
              step="1"
              min={1}
              max={100}
              className="appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              error={errors.agility?.message}
              help="De 1 a 100 (até 85 com 35 anos ou mais)."
              {...register('agility', { valueAsNumber: true })}
            />
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
