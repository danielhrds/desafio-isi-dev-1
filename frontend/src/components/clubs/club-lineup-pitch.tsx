import { HeartPulse, LockKeyhole, Plus, Shirt } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ClubRosterPlayer } from '@/types/club';
import type { PlayerCondition, PlayerPosition } from '@/types/player';
import type { LineupSlot } from './club-lineup-config';

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

function playerInitials(name: string): string {
  const words = name.trim().split(/\s+/);

  return `${words[0]?.[0] ?? ''}${words.length > 1 ? (words.at(-1)?.[0] ?? '') : ''}`.toLocaleUpperCase(
    'pt-BR',
  );
}

function lastName(name: string): string {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

export function PlayerConditionBadge({
  condition,
}: {
  condition: PlayerCondition;
}) {
  return (
    <Badge
      variant="outline"
      className={cn('gap-1 rounded-md font-normal', conditionStyles[condition])}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {conditionLabels[condition]}
    </Badge>
  );
}

function PitchLines() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 size-full"
      preserveAspectRatio="none"
      viewBox="0 0 280 360"
    >
      <rect
        x="0"
        y="0"
        width="280"
        height="360"
        className="fill-success-soft-foreground"
      />
      {Array.from({ length: 8 }, (_, index) => (
        <rect
          key={index}
          x="0"
          y={index * 45}
          width="280"
          height="45"
          className={index % 2 === 0 ? 'fill-white/5' : 'fill-transparent'}
        />
      ))}
      <g fill="none" stroke="white" strokeOpacity="0.38" strokeWidth="1.5">
        <rect x="12" y="12" width="256" height="336" rx="2" />
        <line x1="12" y1="180" x2="268" y2="180" />
        <circle cx="140" cy="180" r="35" />
        <rect x="70" y="273" width="140" height="75" />
        <rect x="101" y="320" width="78" height="28" />
        <line x1="124" y1="348" x2="156" y2="348" />
      </g>
    </svg>
  );
}

function PitchPlayer({
  player,
  slot,
}: {
  player: ClubRosterPlayer;
  slot: LineupSlot;
}) {
  const isMalConditioned = player.condition === 'MAL_CONDICIONADO';

  return (
    <div
      role="group"
      aria-label={`${slot.label}: ${player.name}, ${positionLabels[player.position]}, ${conditionLabels[player.condition]}`}
      className="absolute z-10 flex w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
    >
      <div className="relative">
        <Avatar className="size-8 border-2 border-white shadow-md">
          <AvatarFallback
            className={cn(
              'text-[10px] font-semibold',
              avatarStyles[player.id % avatarStyles.length],
            )}
          >
            {playerInitials(player.name)}
          </AvatarFallback>
        </Avatar>
        {isMalConditioned && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                role="img"
                aria-label={`${player.name} está mal condicionado`}
                className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full border border-warning-soft-border bg-warning-soft text-warning-soft-foreground shadow-sm"
              >
                <HeartPulse aria-hidden="true" className="size-2.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Mal condicionado: pode jogar, mas sofre redução nos atributos
              durante a partida.
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <span className="mt-0.5 max-w-16 truncate rounded-full bg-black/55 px-1.5 py-0.5 text-center text-[10px] leading-3 text-white">
        {lastName(player.name)}
      </span>
    </div>
  );
}

function EmptyPitchSlot({ slot }: { slot: LineupSlot }) {
  return (
    <div
      role="img"
      aria-label={`Vaga de ${slot.label} vazia`}
      className="absolute z-10 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-dashed border-white/80 bg-success-soft-foreground/30 text-white"
      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
    >
      <Plus aria-hidden="true" className="size-4" />
    </div>
  );
}

export function ClubLineupPitch({
  formation,
  slots,
  playersBySlot,
}: {
  formation: string | null;
  slots: LineupSlot[];
  playersBySlot: Array<ClubRosterPlayer | undefined>;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-xs">
      <CardHeader className="gap-1 border-b px-4 py-4">
        <CardTitle className="text-base">Em campo</CardTitle>
        <CardDescription>
          {formation
            ? `Prévia da formação ${formation}, do goleiro ao ataque.`
            : 'Escolha uma formação para visualizar as vagas.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <TooltipProvider>
          <div
            className="relative mx-auto aspect-[7/9] w-full max-w-[286px] overflow-hidden rounded-xl bg-success-soft-foreground"
            aria-label="Prévia visual da escalação"
          >
            <PitchLines />
            {formation &&
              slots.map((slot, index) => {
                const player = playersBySlot[index];

                return player ? (
                  <PitchPlayer key={slot.id} player={player} slot={slot} />
                ) : (
                  <EmptyPitchSlot key={slot.id} slot={slot} />
                );
              })}
            {!formation && (
              <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 rounded-md bg-black/55 px-3 py-2 text-center text-xs text-white">
                Selecione uma formação para posicionar os titulares.
              </div>
            )}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

export function ClubLineupReserves({
  players,
}: {
  players: ClubRosterPlayer[];
}) {
  const illPlayers = players.some((player) => player.condition === 'DOENTE');

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-xs">
      <CardHeader className="gap-1 border-b px-4 py-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Reservas</CardTitle>
          <Badge variant="secondary">{players.length}</Badge>
        </div>
        <CardDescription>
          Jogadores do elenco fora da escalação.
        </CardDescription>
      </CardHeader>
      {players.length === 0 ? (
        <CardContent className="flex items-center gap-2 px-4 py-5 text-sm text-muted-foreground">
          <Shirt aria-hidden="true" className="size-4 shrink-0" />
          Todos os jogadores do elenco estão escolhidos.
        </CardContent>
      ) : (
        <CardContent className="space-y-3 p-4">
          {players.map((player) => (
            <div
              key={player.id}
              className={cn(
                'flex min-w-0 items-center justify-between gap-3',
                player.condition === 'DOENTE' && 'opacity-70',
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar className="size-8">
                  <AvatarFallback
                    className={cn(
                      'text-[10px] font-medium',
                      avatarStyles[player.id % avatarStyles.length],
                    )}
                  >
                    {playerInitials(player.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{player.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {positionLabels[player.position]}
                  </p>
                </div>
              </div>
              <PlayerConditionBadge condition={player.condition} />
            </div>
          ))}
          {illPlayers && (
            <div className="flex items-start gap-2 rounded-md bg-muted-subtle px-3 py-2 text-xs text-muted-foreground">
              <LockKeyhole
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0"
              />
              Doente não pode ser escalado.
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
