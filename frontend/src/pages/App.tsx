import axios from 'axios';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useClubs } from '@/hooks/use-clubs';
import { usePlayers } from '@/hooks/use-players';
import type { PlayerCondition } from '@/types/player';

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const conditionLabels: Record<PlayerCondition, string> = {
  APTO: 'Apto',
  MAL_CONDICIONADO: 'Mal condicionado',
  DOENTE: 'Doente',
};

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return (
      error.response?.data?.message ?? 'Não foi possível carregar os jogadores.'
    );
  }
  return 'Não foi possível carregar os jogadores.';
}

export function App() {
  const players = usePlayers(1);
  const clubs = useClubs();
  const isLoading = players.isPending || clubs.isPending;
  const isError = players.isError || clubs.isError;
  const clubNames = new Map(clubs.data?.map((club) => [club.id, club.name]));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-8">
          <div
            className="flex size-9 items-center justify-center rounded-[10px] bg-primary text-lg font-bold text-primary-foreground"
            aria-hidden="true"
          >
            P
          </div>
          <div>
            <p className="font-semibold leading-5">Passe</p>
            <p className="text-xs text-muted-foreground">Gestão da liga</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <div className="mb-7">
          <p className="mb-2 text-sm text-muted-foreground">
            Mercado / Jogadores
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Jogadores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe os indicadores e valores dos jogadores.
          </p>
        </div>

        <section
          aria-label="Lista de jogadores"
          className="overflow-hidden rounded-[10px] border bg-card shadow-sm"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-semibold">Todos os jogadores</h2>
            {!isLoading && !isError && (
              <span className="text-sm tabular-nums text-muted-foreground">
                {players.data.meta.total_items} encontrados
              </span>
            )}
          </div>

          {isError ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>Erro ao carregar jogadores</AlertTitle>
                <AlertDescription>
                  <p>{errorMessage(players.error ?? clubs.error)}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      if (players.isError) void players.refetch();
                      if (clubs.isError) void clubs.refetch();
                    }}
                  >
                    Tentar novamente
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : isLoading ? (
            <div
              aria-label="Carregando jogadores"
              role="status"
              className="space-y-3 p-4"
            >
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : players.data.data.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="font-medium">Nenhum jogador encontrado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Os jogadores cadastrados aparecerão aqui.
              </p>
            </div>
          ) : (
            <>
              <Table aria-label="Jogadores">
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Nome</TableHead>
                    <TableHead>Posição</TableHead>
                    <TableHead className="text-right">Overall</TableHead>
                    <TableHead className="text-right">Agilidade</TableHead>
                    <TableHead className="text-right">Idade</TableHead>
                    <TableHead>Condição</TableHead>
                    <TableHead className="text-right">Valor base</TableHead>
                    <TableHead className="text-right">
                      Valor de mercado
                    </TableHead>
                    <TableHead>Clube</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.data.data.map((player) => (
                    <TableRow key={player.id}>
                      <TableCell className="font-medium">
                        {player.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{player.position}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {player.overall}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {player.agility}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {player.age}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            player.condition === 'APTO'
                              ? 'secondary'
                              : player.condition === 'DOENTE'
                                ? 'destructive'
                                : 'outline'
                          }
                        >
                          {conditionLabels[player.condition]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {moneyFormatter.format(player.base_value)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {moneyFormatter.format(player.market_value)}
                      </TableCell>
                      <TableCell>
                        {player.club_id === null ? (
                          <Badge variant="secondary">Livre</Badge>
                        ) : (
                          (clubNames.get(player.club_id) ??
                          'Clube indisponível')
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t px-4 py-3 text-sm tabular-nums text-muted-foreground">
                Mostrando {players.data.data.length} de{' '}
                {players.data.meta.total_items} jogadores
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
