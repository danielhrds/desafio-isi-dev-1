import { Fragment } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { MatchDetail, MatchDuel, MatchDuelPlayer } from '@/types/match';
import { conditionLabels, matchAttributeLabel } from './match-formatters';

function initials(name: string): string {
  const words = name.trim().split(/\s+/);

  return `${words[0]?.[0] ?? ''}${words.length > 1 ? (words.at(-1)?.[0] ?? '') : ''}`.toLocaleUpperCase(
    'pt-BR',
  );
}

function attackingLine(order: number): number {
  return order % 3 === 1 ? 4 : order % 3 === 2 ? 3 : 2;
}

function defendingLine(order: number): string {
  const positionInCycle = ((order - 1) % 3) + 1;
  if (positionInCycle === 1) return 'Goleiro';
  return `${positionInCycle - 1}º de linha`;
}

function PlayerSnapshot({
  player,
  subtitle,
}: {
  player: MatchDuelPlayer;
  subtitle: string;
}) {
  return (
    <div className="flex min-w-44 items-center gap-2.5">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-avatar-cyan text-avatar-cyan-foreground text-[10px]">
          {initials(player.player_name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-medium">{player.player_name}</p>
        <p className="text-xs text-muted-foreground">
          {player.position} · {subtitle}
        </p>
        {player.condition === 'MAL_CONDICIONADO' && (
          <Badge
            variant="outline"
            className="mt-1 border-warning-soft-border bg-warning-soft px-1.5 py-0 text-[10px] font-normal text-warning-soft-foreground"
          >
            {conditionLabels[player.condition]}
          </Badge>
        )}
      </div>
    </div>
  );
}

function DuelGroupRow({
  duel,
  match,
  clubs,
}: {
  duel: MatchDuel;
  match: MatchDetail;
  clubs: { id: number; acronym: string }[];
}) {
  const isHome = duel.attacking_club_id === match.home.club_id;
  const club = isHome ? match.home : match.away;
  const acronym = clubs.find((item) => item.id === club.club_id)?.acronym;

  return (
    <TableRow className="bg-muted-subtle hover:bg-muted-subtle">
      <TableCell colSpan={6} className="px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-medium">
          {acronym && (
            <Badge variant="secondary" className="rounded-md px-1.5 py-0">
              {acronym}
            </Badge>
          )}
          Ataques de {club.club_name} ({isHome ? 'mandante' : 'visitante'})
        </div>
      </TableCell>
    </TableRow>
  );
}

export function MatchDuelsTable({
  match,
  clubs,
}: {
  match: MatchDetail;
  clubs: { id: number; acronym: string }[];
}) {
  return (
    <Card className="min-w-0 gap-0 overflow-hidden py-0 shadow-xs">
      <CardHeader className="border-b px-4 py-4">
        <CardTitle className="text-base">Duelos</CardTitle>
        <CardDescription>
          Os três ataques do mandante são seguidos pelos três ataques do
          visitante, na ordem devolvida pela API.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="min-w-[950px]" aria-label="Seis duelos da partida">
          <TableHeader>
            <TableRow className="bg-muted-subtle hover:bg-muted-subtle">
              <TableHead className="pl-4 text-muted-foreground">
                Duelo
              </TableHead>
              <TableHead className="text-muted-foreground">Atacante</TableHead>
              <TableHead className="text-muted-foreground">Ataque</TableHead>
              <TableHead className="text-muted-foreground">Defensor</TableHead>
              <TableHead className="text-muted-foreground">Defesa</TableHead>
              <TableHead className="pr-4 text-muted-foreground">
                Resultado
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {match.duels.map((duel, index) => {
              const previous = match.duels[index - 1];
              const attackingClub =
                duel.attacking_club_id === match.home.club_id
                  ? match.home
                  : match.away;
              const defendingClub =
                duel.attacking_club_id === match.home.club_id
                  ? match.away
                  : match.home;
              const startsNewGroup =
                index === 0 ||
                previous?.attacking_club_id !== duel.attacking_club_id;

              return (
                <Fragment key={duel.order}>
                  {startsNewGroup && (
                    <DuelGroupRow duel={duel} match={match} clubs={clubs} />
                  )}
                  <TableRow>
                    <TableCell className="pl-4">
                      <Badge variant="secondary" className="tabular-nums">
                        {duel.order}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <PlayerSnapshot
                        player={duel.attacker}
                        subtitle={`${attackingLine(duel.order)}º de linha · ${attackingClub.club_name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {matchAttributeLabel(duel.attacker.attribute)}
                      </span>{' '}
                      <strong className="tabular-nums">
                        {duel.attacker.value}
                      </strong>
                    </TableCell>
                    <TableCell>
                      <PlayerSnapshot
                        player={duel.defender}
                        subtitle={`${defendingLine(duel.order)} · ${defendingClub.club_name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {matchAttributeLabel(duel.defender.attribute)}
                      </span>{' '}
                      <strong className="tabular-nums">
                        {duel.defender.value}
                      </strong>
                    </TableCell>
                    <TableCell className="pr-4">
                      {duel.goal ? (
                        <Badge className="border-success-soft-border bg-success-soft text-success-soft-foreground">
                          Gol
                        </Badge>
                      ) : (
                        <Badge variant="outline">Sem gol</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
