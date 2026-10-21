import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownUp,
  ChevronRight,
  LoaderCircle,
  Plus,
  SearchX,
  ServerOff,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { ClubCreateDialog } from '@/components/clubs/club-create-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useClubSummaries, useClubs } from '@/hooks/use-clubs';
import { usePlayers } from '@/hooks/use-players';
import { apiErrorMessage } from '@/lib/api-error';
import type { ClubSort } from '@/types/club';

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const sortLabels: Record<ClubSort, string> = {
  name: 'Ordenar: nome',
  net_worth_desc: 'Ordenar: patrimônio (maior para o menor)',
  net_worth_asc: 'Ordenar: patrimônio (menor para o maior)',
};

function ClubsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="grid grid-cols-6 gap-4 border-b bg-muted-subtle px-4 py-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-4 w-20" />
        ))}
      </div>
      {Array.from({ length: 5 }, (_, row) => (
        <div
          key={row}
          className="grid grid-cols-6 gap-4 border-b px-4 py-4 last:border-0"
        >
          {Array.from({ length: 6 }, (_, column) => (
            <Skeleton key={column} className="h-5 w-24" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ClubsPage() {
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<ClubSort>('name');
  const [createOpen, setCreateOpen] = useState(false);
  const clubs = useClubSummaries(sort);
  const sidebarClubs = useClubs();
  const players = usePlayers(1);

  return (
    <AppShell
      clubs={sidebarClubs.data ?? []}
      playerTotal={players.data?.meta.total_items}
      activeSection="clubs"
      breadcrumbPage="Clubes"
      refreshLabel="Atualizar clubes"
      isRefreshing={clubs.isFetching || sidebarClubs.isFetching}
      onRefresh={() => {
        void queryClient.invalidateQueries({ queryKey: ['clubs'] });
      }}
    >
      <main className="min-w-0 flex-1 px-4 py-8 md:px-8">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-primary bg-primary-soft text-primary">
              <Shield aria-hidden="true" className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Clubes</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Cada clube começa com 300,00 em caixa e sem jogadores. A liga
                aceita no máximo 20 clubes.
              </p>
            </div>
          </div>
          <Button
            type="button"
            className="self-start"
            onClick={() => setCreateOpen(true)}
          >
            <Plus aria-hidden="true" />
            Novo clube
          </Button>
        </div>

        {clubs.isError ? (
          <Alert
            variant="destructive"
            className="flex min-h-72 flex-col items-center justify-center gap-2 text-center"
          >
            <ServerOff aria-hidden="true" />
            <AlertTitle className="text-base">
              Não foi possível carregar os clubes
            </AlertTitle>
            <AlertDescription className="block max-w-sm">
              {apiErrorMessage(clubs.error)}
            </AlertDescription>
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={() => void clubs.refetch()}
            >
              Tentar novamente
            </Button>
          </Alert>
        ) : clubs.isPending ? (
          <>
            <div
              className="mb-3 flex h-10 items-center gap-2 px-4 text-sm text-muted-foreground"
              role="status"
              aria-label="Carregando clubes"
            >
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
              Carregando clubes...
            </div>
            <ClubsTableSkeleton />
          </>
        ) : clubs.data.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border px-4 text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <SearchX aria-hidden="true" className="size-5" />
            </div>
            <p className="font-semibold">Nenhum clube cadastrado</p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Crie o primeiro clube com nome e sigla. Ele começa com 300,00 em
              caixa e sem jogadores.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => setCreateOpen(true)}
            >
              <Plus aria-hidden="true" />
              Novo clube
            </Button>
          </div>
        ) : (
          <section
            className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-xs"
            aria-label="Lista de clubes"
          >
            <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span>
                  {clubs.data.length}{' '}
                  {clubs.data.length === 1 ? 'clube' : 'clubes'}
                </span>
                <Badge variant="secondary">{clubs.data.length} de 20</Badge>
              </div>
              <Select
                value={sort}
                onValueChange={(value) => setSort(value as ClubSort)}
              >
                <SelectTrigger
                  className="w-full sm:w-auto sm:min-w-72"
                  aria-label="Ordenar clubes"
                >
                  <ArrowDownUp aria-hidden="true" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="name">{sortLabels.name}</SelectItem>
                  <SelectItem value="net_worth_desc">
                    {sortLabels.net_worth_desc}
                  </SelectItem>
                  <SelectItem value="net_worth_asc">
                    {sortLabels.net_worth_asc}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Table aria-label="Clubes">
              <TableHeader>
                <TableRow className="bg-muted-subtle hover:bg-muted-subtle">
                  <TableHead>Clube</TableHead>
                  <TableHead>Sigla</TableHead>
                  <TableHead className="text-right">Caixa</TableHead>
                  <TableHead className="text-right">Valor do elenco</TableHead>
                  <TableHead className="text-right">Patrimônio</TableHead>
                  <TableHead className="w-32">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clubs.data.map((club) => (
                  <TableRow key={club.id}>
                    <TableCell>
                      <div className="flex min-w-40 items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted text-xs font-semibold">
                          {club.acronym}
                        </span>
                        <span className="font-medium">{club.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{club.acronym}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {moneyFormatter.format(club.cash)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {moneyFormatter.format(club.squad_value)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {moneyFormatter.format(club.net_worth)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/clubes/${club.id}`}>
                          Ver clube
                          <ChevronRight aria-hidden="true" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}
        {createOpen && (
          <ClubCreateDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={(club) => {
              setCreateOpen(false);
              toast.success('Clube criado', {
                description: `${club.name} (${club.acronym}) começa com ${moneyFormatter.format(club.cash)} em caixa.`,
              });
            }}
          />
        )}
      </main>
    </AppShell>
  );
}
