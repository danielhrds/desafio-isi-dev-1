import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { HeartPulse, LoaderCircle, LockKeyhole } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useUpdatePlayerCondition } from '@/hooks/use-players';
import { cn } from '@/lib/utils';
import type {
  PlayerCondition,
  PlayerListItem,
  PlayerPosition,
} from '@/types/player';
import {
  playerConditionSchema,
  type PlayerConditionFormValues,
} from './player-condition-schema';

const conditionOptions: Array<{
  value: PlayerCondition;
  label: string;
  description: string;
}> = [
  {
    value: 'APTO',
    label: 'Apto',
    description: 'Sem desconto por condição.',
  },
  {
    value: 'MAL_CONDICIONADO',
    label: 'Mal condicionado',
    description:
      'Desconto de 15%. Agilidade de 80 a 100 corta pela metade; de 1 a 30 soma 10 pontos.',
  },
  {
    value: 'DOENTE',
    label: 'Doente',
    description: 'Desconto de 30%, com o mesmo ajuste de agilidade.',
  },
];

const conditionLabels: Record<PlayerCondition, string> = {
  APTO: 'Apto',
  MAL_CONDICIONADO: 'Mal condicionado',
  DOENTE: 'Doente',
};

const conditionStyles: Record<PlayerCondition, string> = {
  APTO: 'border-success-soft-border bg-success-soft text-success-soft-foreground',
  MAL_CONDICIONADO:
    'border-warning-soft-border bg-warning-soft text-warning-soft-foreground',
  DOENTE:
    'border-destructive-soft-border bg-destructive-soft text-destructive-soft-foreground',
};

const positionLabels: Record<PlayerPosition, string> = {
  GOL: 'Goleiro',
  ZAG: 'Zagueiro',
  LAT: 'Lateral',
  MEI: 'Meio-campo',
  ATA: 'Atacante',
};

const avatarStyles = [
  'bg-avatar-zinc text-avatar-zinc-foreground',
  'bg-avatar-violet text-avatar-violet-foreground',
  'bg-avatar-pink text-avatar-pink-foreground',
  'bg-avatar-cyan text-avatar-cyan-foreground',
  'bg-avatar-teal text-avatar-teal-foreground',
];

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  return `${words[0]?.[0] ?? ''}${words.length > 1 ? (words.at(-1)?.[0] ?? '') : ''}`.toLocaleUpperCase(
    'pt-BR',
  );
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? 'Tente novamente em instantes.';
  }
  return 'Tente novamente em instantes.';
}

export function PlayerConditionDialog({
  player,
  onClose,
}: {
  player: PlayerListItem;
  onClose: () => void;
}) {
  const updateCondition = useUpdatePlayerCondition();
  const [requestError, setRequestError] = useState<string | null>(null);
  const form = useForm<PlayerConditionFormValues>({
    resolver: zodResolver(playerConditionSchema),
    defaultValues: { condition: player.condition },
  });
  const saving = form.formState.isSubmitting || updateCondition.isPending;

  async function submit(values: PlayerConditionFormValues) {
    setRequestError(null);
    try {
      await updateCondition.mutateAsync({
        id: player.id,
        condition: values.condition,
      });
      toast.success('Condição física atualizada', {
        description: `${player.name} agora está ${conditionLabels[values.condition].toLocaleLowerCase('pt-BR')}.`,
      });
      onClose();
    } catch (error) {
      setRequestError(getErrorMessage(error));
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader className="gap-2 pr-7 text-left">
          <DialogTitle>Alterar condição física</DialogTitle>
          <DialogDescription>
            A condição muda o desconto do valor de mercado, recalculado ao
            salvar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 px-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-9">
              <AvatarFallback
                className={cn(
                  'font-medium',
                  avatarStyles[player.id % avatarStyles.length],
                )}
              >
                {initials(player.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{player.name}</p>
              <p className="text-xs text-muted-foreground">
                {positionLabels[player.position]} · {player.age} anos
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'shrink-0 font-normal',
              conditionStyles[player.condition],
            )}
          >
            <span
              aria-hidden="true"
              className="mr-1.5 size-1.5 rounded-full bg-current"
            />
            {conditionLabels[player.condition]}
          </Badge>
        </div>

        <form onSubmit={form.handleSubmit(submit)} className="grid gap-4">
          <Controller
            control={form.control}
            name="condition"
            render={({ field }) => (
              <RadioGroup
                aria-label="Condição física"
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                disabled={saving}
                className="gap-2"
              >
                {conditionOptions.map((option) => {
                  const disabled =
                    (player.condition === 'DOENTE' &&
                      option.value === 'APTO') ||
                    saving;
                  const selected = field.value === option.value;
                  const optionId = `condition-${option.value}`;

                  return (
                    <Label
                      key={option.value}
                      htmlFor={optionId}
                      className={cn(
                        'flex min-h-[72px] items-start gap-3 rounded-xl border px-3 py-3 font-normal transition-colors sm:px-4',
                        selected
                          ? 'border-primary bg-primary-soft'
                          : 'bg-background',
                        disabled
                          ? 'cursor-not-allowed opacity-60'
                          : 'cursor-pointer hover:bg-muted/50',
                      )}
                    >
                      <RadioGroupItem
                        ref={selected ? field.ref : undefined}
                        id={optionId}
                        value={option.value}
                        disabled={disabled}
                        className="mt-0.5 border-muted-foreground/50 shadow-none data-[state=checked]:border-primary"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {option.label}
                          {player.condition === option.value && (
                            <Badge variant="secondary" className="text-[10px]">
                              Atual
                            </Badge>
                          )}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                          {option.description}
                        </span>
                        {player.condition === 'DOENTE' &&
                          option.value === 'APTO' && (
                            <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <LockKeyhole
                                aria-hidden="true"
                                className="size-3 shrink-0"
                              />
                              De Doente não passa direto para Apto.
                            </span>
                          )}
                      </span>
                    </Label>
                  );
                })}
              </RadioGroup>
            )}
          />

          {requestError && (
            <Alert variant="destructive">
              <HeartPulse aria-hidden="true" />
              <AlertTitle>Não foi possível alterar a condição</AlertTitle>
              <AlertDescription>{requestError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <HeartPulse aria-hidden="true" />
              )}
              {saving ? 'Salvando...' : 'Salvar condição'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
