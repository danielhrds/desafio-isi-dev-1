import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardFooter } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ClubListItem } from '@/types/club';
import type { Standing } from '@/types/standing';

const statisticColumns = [
  { short: 'J', label: 'Jogos', field: 'played' },
  { short: 'V', label: 'Vitórias', field: 'wins' },
  { short: 'E', label: 'Empates', field: 'draws' },
  { short: 'D', label: 'Derrotas', field: 'losses' },
  { short: 'GP', label: 'Gols marcados', field: 'goals_for' },
  { short: 'GC', label: 'Gols sofridos', field: 'goals_against' },
  { short: 'SG', label: 'Saldo de gols', field: 'goal_difference' },
  { short: 'Pts', label: 'Pontos', field: 'points' },
] as const;

function formatGoalDifference(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return '0';
}

export function StandingsTable({
  standings,
  clubs,
}: {
  standings: Standing[];
  clubs: ClubListItem[];
}) {
  const acronyms = new Map(clubs.map((club) => [club.id, club.acronym]));

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-xs">
      <Table aria-label="Classificação dos clubes" className="min-w-[720px]">
        <TableHeader>
          <TableRow className="bg-muted-subtle hover:bg-muted-subtle">
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead className="min-w-48">Clube</TableHead>
            {statisticColumns.map((column) => (
              <TableHead
                key={column.field}
                scope="col"
                aria-label={column.label}
                className="text-right"
              >
                {column.short}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {standings.map((standing) => (
            <TableRow key={standing.club_id}>
              <TableCell className="text-center">
                <Badge
                  variant={standing.position === 1 ? 'default' : 'secondary'}
                  className="size-6 rounded-md p-0 tabular-nums"
                >
                  {standing.position}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex min-w-0 items-center gap-2">
                  {acronyms.has(standing.club_id) && (
                    <Badge
                      variant="secondary"
                      className="rounded-sm px-1.5 font-normal"
                    >
                      {acronyms.get(standing.club_id)}
                    </Badge>
                  )}
                  <Link
                    to={`/clubes/${standing.club_id}`}
                    className="truncate underline underline-offset-2 hover:text-primary"
                  >
                    {standing.club_name}
                  </Link>
                </div>
              </TableCell>
              {statisticColumns.map(({ field }) => {
                const value = standing[field];
                const displayValue =
                  field === 'goal_difference'
                    ? formatGoalDifference(value)
                    : value;

                return (
                  <TableCell
                    key={field}
                    className={`text-right tabular-nums ${field === 'points' ? 'font-semibold' : ''}`}
                  >
                    {displayValue}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <CardFooter className="border-t px-4 py-2">
        <p className="min-w-0 text-xs leading-relaxed text-muted-foreground">
          J: jogos · V: vitórias · E: empates · D: derrotas · GP: gols marcados
          · GC: gols sofridos · SG: saldo de gols · Pts: pontos
        </p>
      </CardFooter>
    </Card>
  );
}
