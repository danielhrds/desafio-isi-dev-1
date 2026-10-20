import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { LoaderCircle, SearchX, ServerOff, UsersRound, X } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PlayerFilters } from '@/components/players/player-filters';
import { PlayerPagination } from '@/components/players/player-pagination';
import {
  PlayerTable,
  PlayerTableSkeleton,
} from '@/components/players/player-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useClubs } from '@/hooks/use-clubs';
import { usePlayerCounts, usePlayers } from '@/hooks/use-players';
import type { PlayerListFilters } from '@/types/player';

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return (
      error.response?.data?.message ?? 'Verifique a conexão e tente novamente.'
    );
  }
  return 'Verifique a conexão e tente novamente.';
}

export function PlayersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<PlayerListFilters>({});
  const [searchInput, setSearchInput] = useState('');
  const queryFilters = Object.keys(filters).length > 0 ? filters : undefined;
  const players = usePlayers(page, queryFilters);
  const allPlayers = usePlayers(1);
  const counts = usePlayerCounts(filters);
  const clubs = useClubs();
  const isLoading = players.isPending || clubs.isPending;
  const isError = players.isError || clubs.isError;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = searchInput.trim();
      const search = value.length >= 2 ? value : undefined;
      setFilters((current) => {
        if (current.search === search) return current;
        const next = { ...current, search };
        if (!search) delete next.search;
        setPage(1);
        return next;
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (players.data && page > Math.max(1, players.data.meta.total_pages)) {
      setPage(Math.max(1, players.data.meta.total_pages));
    }
  }, [page, players.data]);

  function changeFilters(change: Partial<PlayerListFilters>) {
    setFilters((current) => {
      const next = { ...current, ...change };
      for (const key of Object.keys(next) as (keyof PlayerListFilters)[]) {
        if (next[key] === undefined) delete next[key];
      }
      return next;
    });
    setPage(1);
  }

  function clearFilters() {
    setSearchInput('');
    setFilters({});
    setPage(1);
  }

  return (
    <AppShell
      clubs={clubs.data ?? []}
      playerTotal={allPlayers.data?.meta.total_items}
      isRefreshing={
        players.isFetching || allPlayers.isFetching || clubs.isFetching
      }
      onRefresh={() => {
        void queryClient.invalidateQueries({ queryKey: ['players'] });
        void queryClient.invalidateQueries({ queryKey: ['player-count'] });
        void queryClient.invalidateQueries({ queryKey: ['clubs'] });
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

        <PlayerFilters
          filters={filters}
          searchInput={searchInput}
          onSearchInput={setSearchInput}
          onChange={changeFilters}
          onClear={clearFilters}
          clubs={clubs.data ?? []}
          counts={
            filters.club_id && players.data
              ? {
                  ...counts,
                  all: players.data.meta.total_items,
                  assigned: players.data.meta.total_items,
                }
              : counts
          }
        >
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
            <>
              <div
                className="flex h-10 items-center gap-2 px-4 text-sm text-muted-foreground"
                role="status"
                aria-label="Carregando jogadores"
              >
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
                Carregando jogadores...
              </div>
              <PlayerTableSkeleton />
            </>
          ) : players.data.data.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <SearchX aria-hidden="true" className="size-5" />
              </div>
              <p className="font-semibold">
                {filters.search
                  ? `Nenhum jogador encontrado para “${filters.search}”`
                  : 'Nenhum jogador encontrado'}
              </p>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                {Object.keys(filters).length > 0
                  ? filters.search
                    ? 'Confira a grafia ou tire alguns filtros. A busca ignora maiúsculas, minúsculas e acentos.'
                    : 'Tente ajustar ou remover alguns filtros.'
                  : 'Os jogadores cadastrados aparecerão aqui.'}
              </p>
              {Object.keys(filters).length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={clearFilters}
                >
                  <X aria-hidden="true" />
                  Limpar filtros
                </Button>
              )}
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
        </PlayerFilters>
        <p className="mt-5 text-xs text-muted-foreground">
          {filters.free === true
            ? 'Com “Livres” ativo, o filtro por clube fica desabilitado porque essa combinação não é aceita.'
            : filters.search
              ? 'A busca procura o texto dentro do nome, sem diferenciar maiúsculas, minúsculas e acentos.'
              : filters.min_age !== undefined ||
                  filters.max_age !== undefined ||
                  filters.min_value !== undefined ||
                  filters.max_value !== undefined ||
                  filters.condition !== undefined ||
                  filters.position !== undefined ||
                  filters.club_id !== undefined
                ? 'Os filtros se combinam: a lista mostra só quem atende a todos. A faixa de valor usa o valor de mercado, nunca o valor base.'
                : 'Overall e valor de mercado são calculados pela API a cada consulta.'}
        </p>
      </div>
    </AppShell>
  );
}
