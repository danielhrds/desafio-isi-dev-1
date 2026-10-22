import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  LoaderCircle,
  Plus,
  SearchX,
  ServerOff,
  UsersRound,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PlayerConditionDialog } from '@/components/players/player-condition-dialog';
import { PlayerBuyDialog } from '@/components/players/player-buy-dialog';
import { PlayerDeleteDialog } from '@/components/players/player-delete-dialog';
import { PlayerDetailsDialog } from '@/components/players/player-details-dialog';
import { PlayerEditDialog } from '@/components/players/player-edit-dialog';
import { PlayerCreateDialog } from '@/components/players/player-create-dialog';
import { PlayerCreatedDialog } from '@/components/players/player-created-dialog';
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
import { apiErrorMessage } from '@/lib/api-error';
import type {
  PlayerDetail,
  PlayerListFilters,
  PlayerListItem,
} from '@/types/player';

export function PlayersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<PlayerListFilters>({});
  const [searchInput, setSearchInput] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createdPlayer, setCreatedPlayer] = useState<PlayerDetail | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<PlayerListItem | null>(
    null,
  );
  const [viewingPlayer, setViewingPlayer] = useState<PlayerListItem | null>(
    null,
  );
  const [deletingPlayer, setDeletingPlayer] = useState<PlayerListItem | null>(
    null,
  );
  const [changingConditionPlayer, setChangingConditionPlayer] =
    useState<PlayerListItem | null>(null);
  const [buyingPlayer, setBuyingPlayer] = useState<PlayerListItem | null>(null);
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
      activeSection="players"
      breadcrumbPage="Jogadores"
      refreshLabel="Atualizar jogadores"
      isRefreshing={
        players.isFetching || allPlayers.isFetching || clubs.isFetching
      }
      onRefresh={() => {
        if (
          queryClient.isFetching({ queryKey: ['players'] }) > 0 ||
          queryClient.isFetching({ queryKey: ['player-count'] }) > 0 ||
          queryClient.isFetching({ queryKey: ['clubs'] }) > 0
        ) {
          return;
        }
        void queryClient.invalidateQueries({ queryKey: ['players'] });
        void queryClient.invalidateQueries({ queryKey: ['player-count'] });
        void queryClient.invalidateQueries({ queryKey: ['clubs'] });
      }}
    >
      <div className="min-w-0 flex-1 px-4 py-8 md:px-8">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-primary bg-primary-soft text-primary">
              <UsersRound aria-hidden="true" className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Jogadores
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Cadastre jogadores, acompanhe os indicadores e compre os que
                estão livres.
              </p>
            </div>
          </div>
          <Button
            type="button"
            className="self-start"
            onClick={() => setCreateOpen(true)}
          >
            <Plus aria-hidden="true" />
            Novo jogador
          </Button>
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
                {apiErrorMessage(players.error ?? clubs.error)}
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
              <p className="max-w-full font-semibold [overflow-wrap:anywhere]">
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
              <PlayerTable
                players={players.data.data}
                clubs={clubs.data}
                onView={setViewingPlayer}
                onEdit={setEditingPlayer}
                onChangeCondition={setChangingConditionPlayer}
                onDelete={setDeletingPlayer}
                onBuy={setBuyingPlayer}
              />
              <PlayerPagination
                meta={players.data.meta}
                itemsOnPage={players.data.data.length}
                onPageChange={setPage}
              />
            </>
          )}
        </PlayerFilters>
        {createOpen && (
          <PlayerCreateDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={(player) => {
              clearFilters();
              setCreateOpen(false);
              setCreatedPlayer(player);
            }}
          />
        )}
        {createdPlayer && (
          <PlayerCreatedDialog
            player={createdPlayer}
            onClose={() => setCreatedPlayer(null)}
          />
        )}
        {editingPlayer && (
          <PlayerEditDialog
            key={editingPlayer.id}
            player={editingPlayer}
            onClose={() => setEditingPlayer(null)}
          />
        )}
        {viewingPlayer && (
          <PlayerDetailsDialog
            player={viewingPlayer}
            clubs={clubs.data ?? []}
            onClose={() => setViewingPlayer(null)}
          />
        )}
        {deletingPlayer && (
          <PlayerDeleteDialog
            player={deletingPlayer}
            onClose={() => setDeletingPlayer(null)}
            onDeleted={() => setDeletingPlayer(null)}
          />
        )}
        {changingConditionPlayer && (
          <PlayerConditionDialog
            key={changingConditionPlayer.id}
            player={changingConditionPlayer}
            onClose={() => setChangingConditionPlayer(null)}
          />
        )}
        {buyingPlayer && (
          <PlayerBuyDialog
            player={buyingPlayer}
            onClose={() => setBuyingPlayer(null)}
          />
        )}
      </div>
    </AppShell>
  );
}
