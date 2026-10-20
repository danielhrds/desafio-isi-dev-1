import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  CircleAlert,
  HeartPulse,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Shirt,
} from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useClubLineup, useSaveClubLineup } from '@/hooks/use-clubs';
import { cn } from '@/lib/utils';
import type { ClubFormation, ClubLineup, ClubRosterPlayer } from '@/types/club';
import type { PlayerPosition } from '@/types/player';
import {
  ClubLineupPitch,
  ClubLineupReserves,
  PlayerConditionBadge,
} from './club-lineup-pitch';
import { formationOptions, formationSlots } from './club-lineup-config';
import {
  clubLineupSchema,
  type ClubLineupFormValues,
} from './club-lineup-schema';

const positionLabels: Record<PlayerPosition, string> = {
  GOL: 'Goleiro',
  ZAG: 'Zagueiro',
  LAT: 'Lateral',
  MEI: 'Meio-campo',
  ATA: 'Atacante',
};

type PlayerIdFieldName =
  'playerIds.0' | 'playerIds.1' | 'playerIds.2' | 'playerIds.3' | 'playerIds.4';

const emptyPlayerIds = (): ClubLineupFormValues['playerIds'] => [
  null,
  null,
  null,
  null,
  null,
];

function lineupToFormValues(
  lineup: ClubLineup,
  roster: ClubRosterPlayer[],
): ClubLineupFormValues {
  const playerIds = emptyPlayerIds();

  if (!lineup.formation) {
    const draftFormation: ClubFormation = '2-1-1';
    const slots = formationSlots[draftFormation];

    slots.forEach((slot, index) => {
      const suggestedPlayer = roster.find(
        (player) =>
          player.condition !== 'DOENTE' &&
          slot.eligiblePositions.includes(player.position) &&
          !playerIds.includes(player.id),
      );

      if (suggestedPlayer) playerIds[index] = suggestedPlayer.id;
    });

    return { formation: draftFormation, playerIds };
  }

  const slots = formationSlots[lineup.formation];

  for (const lineupPlayer of lineup.players) {
    const rosterPlayer = roster.find((player) => player.id === lineupPlayer.id);

    if (!rosterPlayer || rosterPlayer.condition === 'DOENTE') continue;

    const slotIndex = slots.findIndex(
      (slot, index) =>
        playerIds[index] === null &&
        slot.eligiblePositions.includes(rosterPlayer.position),
    );

    if (slotIndex >= 0) playerIds[slotIndex] = rosterPlayer.id;
  }

  return { formation: lineup.formation, playerIds };
}

function formationChangeValues(
  formation: ClubFormation,
  playerIds: ClubLineupFormValues['playerIds'],
  roster: ClubRosterPlayer[],
): ClubLineupFormValues['playerIds'] {
  const nextPlayerIds = emptyPlayerIds();
  const nextSlots = formationSlots[formation];

  for (const playerId of playerIds) {
    if (playerId === null) continue;

    const player = roster.find((rosterPlayer) => rosterPlayer.id === playerId);
    if (!player || player.condition === 'DOENTE') continue;

    const slotIndex = nextSlots.findIndex(
      (slot, index) =>
        nextPlayerIds[index] === null &&
        slot.eligiblePositions.includes(player.position),
    );

    if (slotIndex >= 0) nextPlayerIds[slotIndex] = player.id;
  }

  return nextPlayerIds;
}

function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return (
      error.response?.data?.message ?? 'Verifique a conexão e tente novamente.'
    );
  }

  return 'Verifique a conexão e tente novamente.';
}

function isConflictResponse(error: unknown): boolean {
  return (
    axios.isAxiosError(error) &&
    [400, 404, 409].includes(error.response?.status ?? 0)
  );
}

function FormationPreview({ formation }: { formation: ClubFormation }) {
  return (
    <span className="relative h-11 w-8 shrink-0 overflow-hidden rounded border border-success-soft-border bg-success-soft-foreground">
      <svg
        aria-hidden="true"
        viewBox="0 0 32 44"
        className="absolute inset-0 size-full"
      >
        <rect
          x="3"
          y="3"
          width="26"
          height="38"
          rx="1"
          fill="none"
          stroke="white"
          strokeOpacity=".55"
        />
        <line
          x1="3"
          y1="22"
          x2="29"
          y2="22"
          stroke="white"
          strokeOpacity=".55"
        />
        <circle
          cx="16"
          cy="22"
          r="4"
          fill="none"
          stroke="white"
          strokeOpacity=".55"
        />
      </svg>
      {formationSlots[formation].map((slot) => (
        <span
          key={slot.id}
          className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-success-soft-foreground bg-white"
          style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
        />
      ))}
    </span>
  );
}

function LineupLoading() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2.4fr)_minmax(280px,1fr)]">
      <Card className="gap-4 py-5 shadow-xs">
        <CardHeader className="px-5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-4 px-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Skeleton className="mx-auto aspect-[7/9] w-full max-w-[320px] rounded-xl" />
        <Card className="gap-4 py-5 shadow-xs">
          <CardHeader className="px-5">
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent className="space-y-3 px-5">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LineupQueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="min-h-72 items-center justify-center gap-3 px-6 py-10 text-center shadow-xs">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <CircleAlert aria-hidden="true" className="size-5" />
      </div>
      <div className="space-y-2">
        <h2 className="font-semibold">Não foi possível carregar a escalação</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Verifique a conexão e tente novamente.
        </p>
      </div>
      <Button type="button" variant="outline" onClick={onRetry}>
        <RefreshCw aria-hidden="true" />
        Tentar novamente
      </Button>
    </Card>
  );
}

export function ClubLineupTab({
  clubId,
  clubName,
  roster,
}: {
  clubId: number;
  clubName: string;
  roster: ClubRosterPlayer[];
}) {
  const queryClient = useQueryClient();
  const lineup = useClubLineup(clubId);
  const saveLineup = useSaveClubLineup();
  const [serverError, setServerError] = useState<string | null>(null);
  const hasHydrated = useRef(false);
  const submitting = useRef(false);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ClubLineupFormValues>({
    resolver: zodResolver(clubLineupSchema),
    defaultValues: { formation: null, playerIds: emptyPlayerIds() },
  });
  const formation = useWatch({ control, name: 'formation' });
  const playerIds = useWatch({ control, name: 'playerIds' });
  const slots = formation ? formationSlots[formation] : [];
  const selectedIds = new Set(
    playerIds.filter((playerId): playerId is number => playerId !== null),
  );
  const selectedPlayers = playerIds.map((playerId) =>
    roster.find((player) => player.id === playerId),
  );
  const draftIsComplete =
    !!formation &&
    playerIds.every((playerId) => playerId !== null) &&
    new Set(playerIds).size === 5;
  const saving = saveLineup.isPending || isSubmitting;

  useEffect(() => {
    if (lineup.data && !hasHydrated.current) {
      reset(lineupToFormValues(lineup.data, roster));
      hasHydrated.current = true;
    }
  }, [lineup.data, reset, roster]);

  if (lineup.isPending) return <LineupLoading />;

  if (lineup.isError && !lineup.data) {
    return <LineupQueryError onRetry={() => void lineup.refetch()} />;
  }

  if (!lineup.data) return null;
  const currentLineup = lineup.data;

  function changeFormation(value: string) {
    const nextFormation = value as ClubFormation;
    setServerError(null);
    setValue(
      'playerIds',
      formationChangeValues(nextFormation, playerIds, roster),
      { shouldDirty: true, shouldValidate: true },
    );
    setValue('formation', nextFormation, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  async function submit(values: ClubLineupFormValues) {
    if (submitting.current) return;
    if (
      !values.formation ||
      values.playerIds.some((playerId) => playerId === null)
    ) {
      return;
    }

    submitting.current = true;
    setServerError(null);

    try {
      const savedLineup = await saveLineup.mutateAsync({
        id: clubId,
        input: {
          formation: values.formation,
          player_ids: values.playerIds.filter(
            (playerId): playerId is number => playerId !== null,
          ),
        },
      });

      reset(lineupToFormValues(savedLineup, roster));
      hasHydrated.current = true;
      toast.success('Escalação salva', {
        description: `${clubName} na ${savedLineup.formation}, com ${savedLineup.players.length} titulares devolvidos pela API.`,
      });
    } catch (error) {
      setServerError(getApiErrorMessage(error));

      if (isConflictResponse(error)) {
        const persistedLineup =
          queryClient.getQueryData<ClubLineup>(['club', clubId, 'lineup']) ??
          currentLineup;
        reset(lineupToFormValues(persistedLineup, roster));
      }
    } finally {
      submitting.current = false;
    }
  }

  const incomplete = !currentLineup.complete;

  return (
    <div className="space-y-4">
      {incomplete && (
        <Alert variant="warning">
          <ShieldAlert aria-hidden="true" />
          <AlertTitle>
            Escalação incompleta: {clubName} não pode jogar partidas
          </AlertTitle>
          <AlertDescription>
            O elenco tem {roster.length}{' '}
            {roster.length === 1 ? 'jogador' : 'jogadores'}, e a escalação
            precisa de 5: 1 goleiro e 4 jogadores de linha. Escolha jogadores
            elegíveis e salve a escalação com os cinco titulares.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2.4fr)_minmax(280px,1fr)]">
        <Card className="min-w-0 gap-0 overflow-hidden py-0 shadow-xs">
          <CardHeader className="gap-1 border-b px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Titulares</CardTitle>
              <Badge
                variant="outline"
                className={cn(
                  incomplete
                    ? 'border-warning-soft-border bg-warning-soft text-warning-soft-foreground'
                    : 'border-success-soft-border bg-success-soft text-success-soft-foreground',
                )}
              >
                {incomplete ? 'Incompleta' : 'Completa'}
              </Badge>
            </div>
            <CardDescription>
              1 goleiro e 4 jogadores de linha na formação escolhida. Salvar
              troca os 5 de uma vez.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit(submit)} noValidate>
            <CardContent className="space-y-5 p-4 sm:p-5">
              {serverError && (
                <Alert variant="destructive">
                  <CircleAlert aria-hidden="true" />
                  <AlertTitle>
                    {isConflictResponse(saveLineup.error)
                      ? 'A escalação foi recusada'
                      : 'Não foi possível salvar a escalação'}
                  </AlertTitle>
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}

              <fieldset disabled={saving} className="space-y-3">
                <legend className="mb-2 text-sm font-medium">Formação</legend>
                <Controller
                  control={control}
                  name="formation"
                  render={({ field }) => (
                    <RadioGroup
                      aria-label="Formação do clube"
                      value={field.value ?? ''}
                      onValueChange={changeFormation}
                      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                    >
                      {formationOptions.map((option) => (
                        <div
                          key={option.value}
                          onClick={() => {
                            if (!saving) changeFormation(option.value);
                          }}
                          className={cn(
                            'flex min-h-20 cursor-pointer flex-col items-start gap-1 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/50',
                            field.value === option.value &&
                              'border-primary bg-primary/5 ring-1 ring-primary/20',
                          )}
                        >
                          <span className="flex w-full items-center justify-between gap-2">
                            <span className="flex items-center gap-2">
                              <FormationPreview formation={option.value} />
                              <span className="text-sm font-semibold tabular-nums">
                                {option.value}
                              </span>
                            </span>
                            <RadioGroupItem
                              id={`formation-${option.value}`}
                              value={option.value}
                              aria-label={`Formação ${option.value}`}
                            />
                          </span>
                          <span className="text-[11px] leading-4 text-muted-foreground">
                            {option.description}
                          </span>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                />
                {errors.formation?.message && (
                  <p className="text-xs text-destructive" role="alert">
                    {errors.formation.message}
                  </p>
                )}
              </fieldset>

              <div className="space-y-2">
                <div>
                  <h3 className="text-sm font-medium">Vagas da formação</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Os números contam os jogadores de linha de trás para frente.
                    O goleiro fica fora da conta.
                  </p>
                </div>

                {formation ? (
                  <div className="overflow-x-auto rounded-md border">
                    <Table className="min-w-[520px]">
                      <TableHeader>
                        <TableRow className="bg-muted-subtle hover:bg-muted-subtle">
                          <TableHead className="w-24 pl-3">Vaga</TableHead>
                          <TableHead>Titular</TableHead>
                          <TableHead className="w-32">Condição</TableHead>
                          <TableHead className="w-20 pr-3 text-right">
                            OVR
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {slots.map((slot, index) => {
                          const selectedPlayer = selectedPlayers[index];
                          const availablePlayers = roster.filter(
                            (player) =>
                              player.condition !== 'DOENTE' &&
                              slot.eligiblePositions.includes(
                                player.position,
                              ) &&
                              (!selectedIds.has(player.id) ||
                                player.id === playerIds[index]),
                          );
                          const fieldName =
                            `playerIds.${index}` as PlayerIdFieldName;
                          const fieldError = errors.playerIds?.[index]?.message;

                          return (
                            <TableRow key={slot.id}>
                              <TableCell className="pl-3 align-top">
                                <span className="block font-medium">
                                  {slot.label}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {slot.positionHint}
                                </span>
                              </TableCell>
                              <TableCell className="align-top">
                                <Controller
                                  control={control}
                                  name={fieldName}
                                  render={({ field, fieldState }) => (
                                    <Select
                                      value={field.value?.toString() ?? ''}
                                      onValueChange={(value) => {
                                        setServerError(null);
                                        field.onChange(Number(value));
                                      }}
                                      disabled={
                                        saving || availablePlayers.length === 0
                                      }
                                    >
                                      <SelectTrigger
                                        className="w-full min-w-44"
                                        aria-label={`Titular para ${slot.label} (${slot.positionHint})`}
                                        aria-invalid={!!fieldState.error}
                                        aria-describedby={
                                          fieldError
                                            ? `lineup-slot-${index}-error`
                                            : undefined
                                        }
                                      >
                                        <SelectValue
                                          placeholder={
                                            availablePlayers.length === 0
                                              ? 'Sem jogadores elegíveis'
                                              : 'Selecione um jogador'
                                          }
                                        />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {availablePlayers.map((player) => (
                                          <SelectItem
                                            key={player.id}
                                            value={player.id.toString()}
                                          >
                                            <span className="flex min-w-0 items-center gap-2">
                                              <span className="max-w-40 truncate">
                                                {player.name}
                                              </span>
                                              <span className="text-xs text-muted-foreground">
                                                {
                                                  positionLabels[
                                                    player.position
                                                  ]
                                                }
                                              </span>
                                              {player.condition ===
                                                'MAL_CONDICIONADO' && (
                                                <HeartPulse
                                                  aria-label="Mal condicionado"
                                                  className="size-3.5 text-warning-soft-foreground"
                                                />
                                              )}
                                            </span>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                                {fieldError && (
                                  <p
                                    id={`lineup-slot-${index}-error`}
                                    className="mt-1 text-xs text-destructive"
                                    role="alert"
                                  >
                                    {fieldError}
                                  </p>
                                )}
                                {availablePlayers.length === 0 && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Nenhum jogador apto para esta vaga.
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="align-top">
                                {selectedPlayer ? (
                                  <PlayerConditionBadge
                                    condition={selectedPlayer.condition}
                                  />
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    Pendente
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="pr-3 text-right align-top font-semibold tabular-nums">
                                {selectedPlayer?.overall ?? '—'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed px-4 text-center text-sm text-muted-foreground">
                    Selecione uma formação para exibir as cinco vagas.
                  </div>
                )}
              </div>

              {roster.some(
                (player) => player.condition === 'MAL_CONDICIONADO',
              ) && (
                <Alert variant="warning" className="py-3">
                  <HeartPulse aria-hidden="true" />
                  <AlertDescription className="text-xs">
                    Jogadores mal condicionados podem ser escalados. O ícone
                    indica quem terá redução nos atributos durante a partida.
                  </AlertDescription>
                </Alert>
              )}

              {roster.some((player) => player.condition === 'DOENTE') && (
                <div className="flex items-start gap-2 rounded-md bg-muted-subtle px-3 py-2 text-xs text-muted-foreground">
                  <Shirt
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0"
                  />
                  Jogadores doentes não aparecem nos seletores e não podem ser
                  escalados.
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    setServerError(null);
                    reset(lineupToFormValues(currentLineup, roster));
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving || !draftIsComplete}>
                  {saving && (
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  )}
                  Salvar escalação
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>

        <div className="min-w-0 space-y-4">
          <ClubLineupPitch
            formation={formation}
            slots={slots}
            playersBySlot={selectedPlayers}
          />
          <ClubLineupReserves
            players={roster.filter((player) => !selectedIds.has(player.id))}
          />
        </div>
      </div>
    </div>
  );
}
