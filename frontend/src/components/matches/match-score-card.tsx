import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ClubListItem } from '@/types/club';
import type { MatchSummary } from '@/types/match';
import { cn } from '@/lib/utils';
import { formatMatchDateTime, resultLabels } from './match-formatters';

function ClubAcronym({
  clubId,
  clubs,
}: {
  clubId: number;
  clubs: ClubListItem[];
}) {
  const acronym = clubs.find((club) => club.id === clubId)?.acronym;

  return acronym ? (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-muted text-xs font-semibold">
      {acronym}
    </span>
  ) : null;
}

export function MatchScoreCard({
  match,
  clubs,
  detail = false,
}: {
  match: MatchSummary;
  clubs: ClubListItem[];
  detail?: boolean;
}) {
  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardContent
        className={cn(
          'grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 px-4 py-4 sm:gap-x-5 sm:px-6 sm:py-5',
          !detail && 'sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]',
        )}
      >
        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-semibold sm:text-base">
              {match.home.club_name}
            </p>
            <p className="text-xs text-muted-foreground">
              Mandante{detail ? ` · ${match.home.formation}` : ''}
            </p>
          </div>
          <ClubAcronym clubId={match.home.club_id} clubs={clubs} />
        </div>

        <div className="flex min-w-[5.5rem] flex-col items-center gap-1 text-center">
          <span className="rounded-md bg-muted px-3 py-1 text-lg font-semibold tabular-nums sm:text-xl">
            {match.home.goals} × {match.away.goals}
          </span>
          <time
            dateTime={match.played_at}
            className="text-[11px] tabular-nums text-muted-foreground sm:text-xs"
          >
            {formatMatchDateTime(match.played_at)}
          </time>
          <Badge
            variant="outline"
            className="max-w-full text-center font-normal"
          >
            {resultLabels[match.result]}
          </Badge>
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <ClubAcronym clubId={match.away.club_id} clubs={clubs} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold sm:text-base">
              {match.away.club_name}
            </p>
            <p className="text-xs text-muted-foreground">
              Visitante{detail ? ` · ${match.away.formation}` : ''}
            </p>
          </div>
        </div>

        {!detail && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="col-span-3 justify-self-end sm:col-span-1"
            asChild
          >
            <Link to={`/partidas/${match.id}`}>
              Ver duelos
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
