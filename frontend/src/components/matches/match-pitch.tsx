import { HeartPulse } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { MatchDetail, MatchDuelPlayer } from '@/types/match';
import type { ClubFormation, ClubListItem } from '@/types/club';
import { attackAttributeLabels } from './match-formatters';

interface FieldPlayer {
  player: MatchDuelPlayer;
  lineSlot: number | null;
  isGoalkeeper: boolean;
  scored: boolean;
}

function getClubPlayers(match: MatchDetail, clubId: number): FieldPlayer[] {
  const isHome = match.home.club_id === clubId;
  const attackingDuels = match.duels.filter(
    (duel) => duel.attacking_club_id === clubId,
  );
  const defendingDuels = match.duels.filter(
    (duel) => duel.attacking_club_id !== clubId,
  );
  const attackOrders = isHome ? [1, 2, 3] : [4, 5, 6];
  const defenseOrders = isHome ? [4, 5, 6] : [1, 2, 3];
  const duelAt = (duels: typeof match.duels, order: number) =>
    duels.find((duel) => duel.order === order);
  const keeper = duelAt(defendingDuels, defenseOrders[0]);
  const defender = duelAt(defendingDuels, defenseOrders[1]);
  const attackSlots = isHome ? [3, 2, 1] : [3, 2, 1];
  const forwards = attackOrders.map((order, index) => ({
    duel: duelAt(attackingDuels, order),
    lineSlot: attackSlots[index] + 1,
  }));

  const players: FieldPlayer[] = [];
  if (keeper) {
    players.push({
      player: keeper.defender,
      lineSlot: null,
      isGoalkeeper: true,
      scored: false,
    });
  }
  if (defender) {
    players.push({
      player: defender.defender,
      lineSlot: 1,
      isGoalkeeper: false,
      scored: false,
    });
  }
  for (const { duel, lineSlot } of forwards) {
    if (duel) {
      players.push({
        player: duel.attacker,
        lineSlot,
        isGoalkeeper: false,
        scored: duel.goal,
      });
    }
  }

  return players;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/);

  return `${words[0]?.[0] ?? ''}${words.length > 1 ? (words.at(-1)?.[0] ?? '') : ''}`.toLocaleUpperCase(
    'pt-BR',
  );
}

function fieldRows(formation: ClubFormation): number[] {
  return formation.split('-').map(Number);
}

function rowY(index: number, count: number): number {
  return count === 1 ? 50 : 28 + (index * 44) / (count - 1);
}

function Marker({
  item,
  home,
  x,
  y,
}: {
  item: FieldPlayer;
  home: boolean;
  x: number;
  y: number;
}) {
  const attribute =
    item.player.attribute === 'defending'
      ? 'Def'
      : item.player.attribute === 'shooting'
        ? 'Fin'
        : attackAttributeLabels[item.player.attribute];
  const accessibleName = `${item.player.player_name}, ${item.player.position}, ${attribute} ${item.player.value}${item.player.condition === 'MAL_CONDICIONADO' ? ', mal condicionado' : ''}${item.scored ? ', marcou gol' : ''}`;

  return (
    <div
      className="absolute z-10 flex w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
      style={{ left: `${x}%`, top: `${y}%` }}
      role="group"
      aria-label={accessibleName}
    >
      <span
        className={cn(
          'relative flex size-10 items-center justify-center rounded-full border-2 text-xs font-semibold shadow-sm',
          home
            ? 'border-white bg-primary text-primary-foreground'
            : 'border-white bg-background text-foreground',
        )}
      >
        {initials(item.player.player_name)}
        {item.player.condition === 'MAL_CONDICIONADO' && (
          <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-background bg-warning-soft text-warning-soft-foreground">
            <HeartPulse aria-hidden="true" className="size-3" />
          </span>
        )}
        {item.scored && (
          <span
            className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border border-background bg-card text-xs"
            aria-hidden="true"
          >
            ⚽
          </span>
        )}
      </span>
      <span className="mt-1 max-w-full truncate rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
        {item.player.player_name}
      </span>
      <span className="max-w-full truncate rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/90">
        {item.player.position} · {attribute} {item.player.value}
      </span>
    </div>
  );
}

function TeamMarkers({
  club,
  clubs,
  players,
  home,
}: {
  club: MatchDetail['home'];
  clubs: ClubListItem[];
  players: FieldPlayer[];
  home: boolean;
}) {
  const formationRows = fieldRows(club.formation);
  const acronym = clubs.find((item) => item.id === club.club_id)?.acronym;
  return (
    <>
      {players.map((item) => {
        let x: number;
        let y: number;

        if (item.isGoalkeeper) {
          x = home ? 6 : 94;
          y = 50;
        } else {
          const slot = item.lineSlot ?? 1;
          let countBefore = 0;
          let rowIndex = 0;
          let rowPosition = 0;
          for (const [index, count] of formationRows.entries()) {
            if (slot <= countBefore + count) {
              rowIndex = index;
              rowPosition = slot - countBefore - 1;
              break;
            }
            countBefore += count;
          }
          const count = formationRows[rowIndex] ?? 1;
          const rowX = 16 + rowIndex * 12;
          x = home ? rowX : 100 - rowX;
          y = rowY(rowPosition, count);
        }

        return (
          <Marker
            key={item.player.player_id}
            item={item}
            home={home}
            x={x}
            y={y}
          />
        );
      })}
      <div
        className={cn(
          'absolute top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[11px] text-white',
          home ? 'left-3' : 'right-3',
        )}
      >
        <span
          className={cn(
            'size-2 rounded-full',
            home ? 'bg-primary' : 'bg-white',
          )}
        />
        <span className="max-w-40 truncate font-medium">{club.club_name}</span>
        {acronym && <span>{acronym}</span>}
        <span>{club.formation}</span>
        <span aria-hidden="true">{home ? 'ataca →' : 'ataca ←'}</span>
      </div>
    </>
  );
}

export function MatchPitch({
  match,
  clubs,
}: {
  match: MatchDetail;
  clubs: ClubListItem[];
}) {
  const homePlayers = getClubPlayers(match, match.home.club_id);
  const awayPlayers = getClubPlayers(match, match.away.club_id);

  return (
    <Card className="min-w-0 gap-0 overflow-hidden py-0 shadow-xs">
      <CardHeader className="gap-2 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">Em campo</CardTitle>
          <CardDescription>
            Titulares e valores usados nos duelos, conforme os dados devolvidos
            pela API.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <HeartPulse
              aria-hidden="true"
              className="size-4 text-warning-soft-foreground"
            />
            Mal condicionado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true">⚽</span>
            Gol no duelo
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-5">
        <div
          className="overflow-x-auto rounded-xl"
          tabIndex={0}
          role="region"
          aria-label="Campo da partida; use rolagem horizontal para ver toda a formação"
        >
          <div
            className="relative aspect-[2.4/1] min-h-[300px] min-w-[700px] overflow-hidden rounded-xl border border-white/20 bg-success-soft-foreground"
            role="group"
            aria-label={`Campo: ${match.home.club_name} contra ${match.away.club_name}`}
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 grid grid-cols-10"
            >
              {Array.from({ length: 10 }, (_, index) => (
                <span
                  key={index}
                  className={
                    index % 2 === 0 ? 'bg-black/5' : 'bg-white/[0.035]'
                  }
                />
              ))}
            </div>
            <div
              aria-hidden="true"
              className="absolute inset-[5%] border border-white/40"
            >
              <div className="absolute left-1/2 top-0 h-full border-l border-white/40" />
              <div className="absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" />
              <div className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60" />
              <div className="absolute left-0 top-1/2 h-[38%] w-[9%] -translate-y-1/2 border border-l-0 border-white/40" />
              <div className="absolute right-0 top-1/2 h-[38%] w-[9%] -translate-y-1/2 border border-r-0 border-white/40" />
              <div className="absolute left-0 top-1/2 h-[20%] w-[3%] -translate-y-1/2 border border-l-0 border-white/40" />
              <div className="absolute right-0 top-1/2 h-[20%] w-[3%] -translate-y-1/2 border border-r-0 border-white/40" />
            </div>
            <TeamMarkers
              club={match.home}
              clubs={clubs}
              players={homePlayers}
              home
            />
            <TeamMarkers
              club={match.away}
              clubs={clubs}
              players={awayPlayers}
              home={false}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
