import { ErrorAlert } from '@/components/error-alert';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { MatchDuelsTable } from '@/components/matches/match-duels-table';
import { MatchPitch } from '@/components/matches/match-pitch';
import { MatchScoreCard } from '@/components/matches/match-score-card';
import {
  InvalidMatchId,
  MatchHistoryError,
} from '@/components/matches/match-list-states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useClubs } from '@/hooks/use-clubs';
import { useMatch, useMatches } from '@/hooks/use-matches';
import { usePlayers } from '@/hooks/use-players';
import {
  errorMessage,
  isNotFound,
} from '@/components/matches/match-formatters';

function MatchDetailSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando partida">
      <Skeleton className="h-9 w-44" />
      <Card className="py-0">
        <CardContent className="grid grid-cols-3 items-center gap-4 p-5">
          <Skeleton className="ml-auto h-8 w-32 max-w-full" />
          <Skeleton className="mx-auto h-20 w-28" />
          <Skeleton className="h-8 w-32 max-w-full" />
        </CardContent>
      </Card>
      <Card className="py-0">
        <CardHeader className="border-b px-4 py-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </CardHeader>
        <CardContent className="p-4">
          <Skeleton className="aspect-[2.4/1] min-h-[280px] w-full" />
        </CardContent>
      </Card>
      <Card className="py-0">
        <CardHeader className="border-b px-4 py-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function MatchDetailPage() {
  const { matchId: matchIdParam } = useParams();
  const matchId = Number(matchIdParam);
  const isValidMatchId =
    !!matchIdParam &&
    /^[1-9]\d*$/.test(matchIdParam) &&
    Number.isSafeInteger(matchId);
  const queryClient = useQueryClient();
  const match = useMatch(matchId, isValidMatchId);
  const allMatches = useMatches();
  const clubs = useClubs();
  const players = usePlayers(1);
  const title = match.data
    ? `${match.data.home.club_name} ${match.data.home.goals} × ${match.data.away.goals} ${match.data.away.club_name}`
    : 'Detalhes da partida';

  return (
    <AppShell
      clubs={clubs.data ?? []}
      playerTotal={players.data?.meta.total_items}
      matchCount={allMatches.data?.length}
      latestMatch={allMatches.data?.[0]}
      activeSection="matches"
      breadcrumbParent={{ label: 'Partidas', to: '/partidas' }}
      breadcrumbPage={title}
      refreshLabel="Atualizar partida"
      isRefreshing={
        match.isFetching ||
        allMatches.isFetching ||
        clubs.isFetching ||
        players.isFetching
      }
      onRefresh={() => {
        void Promise.all([
          isValidMatchId
            ? queryClient.invalidateQueries({ queryKey: ['match', matchId] })
            : Promise.resolve(),
          queryClient.invalidateQueries({ queryKey: ['matches'] }),
          queryClient.invalidateQueries({ queryKey: ['clubs'] }),
          queryClient.invalidateQueries({ queryKey: ['players', 1] }),
        ]);
      }}
    >
      <main className="min-w-0 flex-1 space-y-6 px-4 py-8 md:px-8">
        {!isValidMatchId ? (
          <InvalidMatchId message="O identificador da partida é inválido." />
        ) : match.isPending ? (
          <MatchDetailSkeleton />
        ) : match.isError && isNotFound(match.error) ? (
          <InvalidMatchId message={errorMessage(match.error)} />
        ) : match.isError ? (
          <MatchHistoryError
            error={match.error}
            title="Não foi possível carregar a partida"
            onRetry={() => void match.refetch()}
          />
        ) : match.data ? (
          <div className="space-y-6">
            <Button variant="ghost" className="-ml-3" asChild>
              <Link to="/partidas">
                <ArrowLeft aria-hidden="true" />
                Voltar para partidas
              </Link>
            </Button>
            <MatchScoreCard
              match={match.data}
              clubs={clubs.data ?? []}
              detail
            />
            <MatchPitch match={match.data} clubs={clubs.data ?? []} />
            <MatchDuelsTable match={match.data} clubs={clubs.data ?? []} />
          </div>
        ) : (
          <ErrorAlert
            title="Partida não encontrada"
            message={
              <>
                <Link to="/partidas" className="font-medium underline">
                  Voltar para partidas
                </Link>
              </>
            }
            icon={null}
          />
        )}
        {match.data && clubs.isError && (
          <ErrorAlert
            title="Não foi possível carregar os clubes"
            message={
              <>
                {errorMessage(clubs.error)}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void clubs.refetch()}
                >
                  Tentar novamente
                </Button>
              </>
            }
            icon={null}
            descriptionClassName="flex flex-wrap items-center justify-between gap-3"
          />
        )}
      </main>
    </AppShell>
  );
}
