import { useState } from 'react';
import axios from 'axios';
import { LoaderCircle, SearchX, ServerOff, UsersRound } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PlayerPagination } from '@/components/players/player-pagination';
import {
  PlayerTable,
  PlayerTableSkeleton,
} from '@/components/players/player-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useClubs } from '@/hooks/use-clubs';
import { usePlayers } from '@/hooks/use-players';

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return (
      error.response?.data?.message ?? 'Verifique a conexão e tente novamente.'
    );
  }
  return 'Verifique a conexão e tente novamente.';
}

export function App() {
  const [page, setPage] = useState(1);
  const players = usePlayers(page);
  const clubs = useClubs();
  const isLoading = players.isPending || clubs.isPending;
  const isError = players.isError || clubs.isError;

  return (
    <AppShell
      clubs={clubs.data ?? []}
      playerTotal={players.data?.meta.total_items}
      isRefreshing={players.isFetching || clubs.isFetching}
      onRefresh={() => {
        void players.refetch();
        void clubs.refetch();
      }}
    >
      <div className="min-w-0 flex-1 px-4 py-8 md:px-8">
        <div className="mb-7 flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-primary bg-primary-soft text-primary">
            <UsersRound aria-hidden="true" className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Jogadores</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre jogadores, acompanhe os indicadores e compre os que estão
              livres.
            </p>
          </div>
        </div>

        <section
          aria-label="Lista de jogadores"
          className="overflow-hidden rounded-xl border bg-card shadow-sm"
        >
          {!isError && (
            <div className="flex min-h-14 items-center justify-between border-b px-4">
              {isLoading ? (
                <div
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  role="status"
                  aria-label="Carregando jogadores"
                >
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                  Carregando jogadores...
                </div>
              ) : (
                <Badge
                  variant="secondary"
                  className="rounded-md px-2 py-1 text-sm font-medium"
                >
                  Todos{' '}
                  <span className="ml-1 tabular-nums text-muted-foreground">
                    {players.data.meta.total_items}
                  </span>
                </Badge>
              )}
            </div>
          )}

          {isError ? (
            <Alert
              variant="destructive"
              className="flex min-h-72 flex-col items-center justify-center gap-2 border-0 text-center"
            >
              <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-muted">
                <ServerOff
                  aria-hidden="true"
                  className="size-5 text-muted-foreground"
                />
              </div>
              <AlertTitle className="text-base text-foreground">
                Não foi possível carregar os jogadores
              </AlertTitle>
              <AlertDescription className="block max-w-sm text-muted-foreground">
                {errorMessage(players.error ?? clubs.error)}
              </AlertDescription>
              <Button
                type="button"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  if (players.isError) void players.refetch();
                  if (clubs.isError) void clubs.refetch();
                }}
              >
                Tentar novamente
              </Button>
            </Alert>
          ) : isLoading ? (
            <PlayerTableSkeleton />
          ) : players.data.data.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <SearchX aria-hidden="true" className="size-5" />
              </div>
              <p className="font-semibold">Nenhum jogador encontrado</p>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Os jogadores cadastrados aparecerão aqui.
              </p>
            </div>
          ) : (
            <>
              <PlayerTable players={players.data.data} clubs={clubs.data} />
              <PlayerPagination
                meta={players.data.meta}
                itemsOnPage={players.data.data.length}
                onPageChange={setPage}
              />
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
