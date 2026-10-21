import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Swords } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { CreateMatchDialog } from '@/components/matches/create-match-dialog';
import {
  MatchHistoryEmpty,
  MatchHistoryError,
  MatchHistoryLoadingLabel,
  MatchHistorySkeleton,
} from '@/components/matches/match-list-states';
import { MatchHistoryTable } from '@/components/matches/match-history-table';
import { MatchScoreCard } from '@/components/matches/match-score-card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useClubs } from '@/hooks/use-clubs';
import { useMatches } from '@/hooks/use-matches';
import { usePlayers } from '@/hooks/use-players';

export function MatchesPage() {
  const queryClient = useQueryClient();
  const [selectedClub, setSelectedClub] = useState('all');
  const [createMatchOpen, setCreateMatchOpen] = useState(false);
  const clubId = selectedClub === 'all' ? undefined : Number(selectedClub);
  const matches = useMatches(clubId);
  const allMatches = useMatches();
  const clubs = useClubs();
  const players = usePlayers(1);
  const latestMatch = allMatches.data?.[0];
  const showLatestError = allMatches.isError && selectedClub !== 'all';

  return (
    <AppShell
      clubs={clubs.data ?? []}
      playerTotal={players.data?.meta.total_items}
      matchCount={allMatches.data?.length}
      latestMatch={latestMatch}
      activeSection="matches"
      breadcrumbPage="Partidas"
      refreshLabel="Atualizar partidas"
      isRefreshing={
        matches.isFetching ||
        allMatches.isFetching ||
        clubs.isFetching ||
        players.isFetching
      }
      onRefresh={() => {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ['matches'] }),
          queryClient.invalidateQueries({ queryKey: ['clubs'] }),
          queryClient.invalidateQueries({ queryKey: ['players', 1] }),
        ]);
      }}
    >
      <main className="min-w-0 flex-1 space-y-6 px-4 py-8 md:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-primary bg-primary-soft text-primary">
              <Swords aria-hidden="true" className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">
                Partidas
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Jogue partidas entre clubes com os 5 titulares escalados e
                acompanhe o histórico.
              </p>
            </div>
          </div>
          <Button
            type="button"
            className="self-start sm:shrink-0"
            onClick={() => setCreateMatchOpen(true)}
          >
            <Plus aria-hidden="true" />
            Nova partida
          </Button>
        </div>

        {(latestMatch || allMatches.isPending || showLatestError) && (
          <section aria-labelledby="latest-match-heading" className="space-y-2">
            <h2
              id="latest-match-heading"
              className="text-sm font-medium text-muted-foreground"
            >
              Última partida
            </h2>
            {latestMatch ? (
              <MatchScoreCard match={latestMatch} clubs={clubs.data ?? []} />
            ) : allMatches.isPending ? (
              <div className="flex min-h-32 items-center rounded-xl border px-4 py-5">
                <div className="grid w-full grid-cols-3 items-center gap-4">
                  <Skeleton className="ml-auto h-6 w-36 max-w-full" />
                  <Skeleton className="mx-auto h-14 w-24" />
                  <Skeleton className="h-6 w-36 max-w-full" />
                </div>
              </div>
            ) : showLatestError ? (
              <Alert variant="destructive">
                <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                  Não foi possível carregar a última partida.
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void allMatches.refetch()}
                  >
                    Tentar novamente
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
          </section>
        )}

        {matches.isError ? (
          <MatchHistoryError
            error={matches.error}
            onRetry={() => void matches.refetch()}
          />
        ) : matches.isPending ? (
          <>
            <MatchHistoryLoadingLabel />
            <MatchHistorySkeleton />
          </>
        ) : matches.data.length === 0 && selectedClub === 'all' ? (
          <MatchHistoryEmpty onCreateMatch={() => setCreateMatchOpen(true)} />
        ) : (
          <MatchHistoryTable
            matches={matches.data}
            clubs={clubs.data ?? []}
            selectedClub={selectedClub}
            onClubChange={setSelectedClub}
            clubsLoading={clubs.isPending}
            clubsError={clubs.error}
            onRetryClubs={() => void clubs.refetch()}
          />
        )}
      </main>
      <CreateMatchDialog
        open={createMatchOpen}
        onOpenChange={setCreateMatchOpen}
        clubs={clubs.data ?? []}
        clubsLoading={clubs.isPending}
        clubsError={clubs.error}
        onRetryClubs={() => void clubs.refetch()}
      />
    </AppShell>
  );
}
