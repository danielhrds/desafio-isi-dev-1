import { Link } from 'react-router-dom';
import { ArrowRight, CircleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMatchDateTime } from '@/components/matches/match-formatters';
import { apiErrorMessage } from '@/lib/api-error';
import type { MatchSummary } from '@/types/match';

function RecentMatchRow({ match }: { match: MatchSummary }) {
  return (
    <Link
      to={`/partidas/${match.id}`}
      aria-label={`${match.home.club_name} ${match.home.goals} a ${match.away.goals} ${match.away.club_name}, ${formatMatchDateTime(match.played_at)}`}
      className="block space-y-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="block text-xs text-muted-foreground">
        {formatMatchDateTime(match.played_at)}
      </span>
      <span className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm">
        <span
          className={`truncate ${match.home.goals > match.away.goals ? 'font-medium' : ''}`}
        >
          {match.home.club_name}
        </span>
        <Badge variant="secondary" className="tabular-nums">
          {match.home.goals} × {match.away.goals}
        </Badge>
        <span
          className={`truncate ${match.away.goals > match.home.goals ? 'font-medium' : ''}`}
        >
          {match.away.club_name}
        </span>
      </span>
    </Link>
  );
}

export function RecentMatchesCard({
  matches,
  isLoading,
  error,
  onRetry,
  onCreateMatch,
}: {
  matches: MatchSummary[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onCreateMatch: () => void;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-xs">
      <CardHeader className="gap-1 border-b px-5 py-4">
        <CardTitle className="text-base">Últimas partidas</CardTitle>
        <CardDescription>Da mais recente para a mais antiga.</CardDescription>
      </CardHeader>
      {isLoading ? (
        <CardContent className="space-y-5 px-5 py-4">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </CardContent>
      ) : error ? (
        <CardContent className="px-4 py-4">
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Não foi possível carregar as partidas</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              {apiErrorMessage(error)}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRetry}
              >
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      ) : (
        <CardContent className="space-y-4 px-5 py-4">
          {matches.length > 0 ? (
            matches
              .slice(0, 2)
              .map((match) => <RecentMatchRow key={match.id} match={match} />)
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium">Nenhuma partida jogada</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCreateMatch}
              >
                Nova partida
              </Button>
            </div>
          )}
        </CardContent>
      )}
      <CardFooter className="border-t px-5 py-3">
        <Button asChild variant="link" className="h-auto p-0">
          <Link to="/partidas">
            Ver todas as partidas
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

const tieBreakCriteria = [
  'Mais pontos',
  'Maior saldo de gols',
  'Mais gols marcados',
  'Nome do clube, de A a Z',
];

export function TieBreakCard() {
  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-xs">
      <CardHeader className="gap-1 border-b px-5 py-4">
        <CardTitle className="text-base">Ordem da tabela</CardTitle>
        <CardDescription>
          Critérios de classificação, nesta ordem.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-5 py-4">
        {tieBreakCriteria.map((criterion, index) => (
          <div key={criterion} className="flex items-center gap-3 text-sm">
            <Badge
              variant="secondary"
              className="size-6 rounded-full p-0 tabular-nums"
            >
              {index + 1}
            </Badge>
            <span>{criterion}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
