import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ListOrdered, Plus } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { CreateMatchDialog } from '@/components/matches/create-match-dialog';
import {
  RecentMatchesCard,
  TieBreakCard,
} from '@/components/standings/standings-side-cards';
import {
  StandingsEmpty,
  StandingsError,
  StandingsLoading,
} from '@/components/standings/standings-list-states';
import { StandingsTable } from '@/components/standings/standings-table';
import { Button } from '@/components/ui/button';
import { useClubs } from '@/hooks/use-clubs';
import { useMatches } from '@/hooks/use-matches';
import { usePlayers } from '@/hooks/use-players';
import { useStandings } from '@/hooks/use-standings';

export function StandingsPage() {
  const queryClient = useQueryClient();
  const [createMatchOpen, setCreateMatchOpen] = useState(false);
  const standings = useStandings();
  const matches = useMatches();
  const clubs = useClubs();
  const players = usePlayers(1);
  const latestMatch = matches.data?.[0];

  return (
    <AppShell
      clubs={clubs.data ?? []}
      playerTotal={players.data?.meta.total_items}
      matchCount={matches.data?.length}
      latestMatch={latestMatch}
      activeSection="standings"
      breadcrumbPage="Classificação"
      refreshLabel="Atualizar classificação"
      isRefreshing={
        standings.isFetching ||
        matches.isFetching ||
        clubs.isFetching ||
        players.isFetching
      }
      onRefresh={() => {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ['standings'] }),
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
              <ListOrdered aria-hidden="true" className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">
                Classificação
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Todos os clubes, com 3 pontos por vitória e 1 por empate.
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

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-label="Tabela de classificação" className="min-w-0">
            {standings.isError ? (
              <StandingsError
                error={standings.error}
                onRetry={() => void standings.refetch()}
              />
            ) : standings.isPending ? (
              <StandingsLoading />
            ) : standings.data.length === 0 ? (
              <StandingsEmpty />
            ) : (
              <StandingsTable
                standings={standings.data}
                clubs={clubs.data ?? []}
              />
            )}
          </section>

          <aside className="grid content-start gap-4">
            <RecentMatchesCard
              matches={matches.data ?? []}
              isLoading={matches.isPending}
              error={matches.isError ? matches.error : null}
              onRetry={() => void matches.refetch()}
              onCreateMatch={() => setCreateMatchOpen(true)}
            />
            <TieBreakCard />
          </aside>
        </div>
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
