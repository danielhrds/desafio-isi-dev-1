import axios from 'axios';
import {
  ArrowLeft,
  ClipboardList,
  Coins,
  History,
  Landmark,
  SearchX,
  ServerOff,
  Shirt,
  ShoppingCart,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/app-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClubLineupTab } from '@/components/clubs/club-lineup-tab';
import { ClubTransactionHistory } from '@/components/clubs/club-transaction-history';
import { useClubDetail, useClubs } from '@/hooks/use-clubs';
import { usePlayers } from '@/hooks/use-players';
import { useClubTransactions } from '@/hooks/use-transactions';
import { cn } from '@/lib/utils';
import type { ClubRosterPlayer } from '@/types/club';
import type { PlayerCondition } from '@/types/player';

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat('pt-BR');

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'America/Sao_Paulo',
});

const conditionLabels: Record<PlayerCondition, string> = {
  APTO: 'Apto',
  MAL_CONDICIONADO: 'Mal condicionado',
  DOENTE: 'Doente',
};

const conditionStyles: Record<PlayerCondition, string> = {
  APTO: 'border-success-soft-border bg-success-soft text-success-soft-foreground',
  MAL_CONDICIONADO:
    'border-warning-soft-border bg-warning-soft text-warning-soft-foreground',
  DOENTE:
    'border-destructive-soft-border bg-destructive-soft text-destructive-soft-foreground',
};

const avatarStyles = [
  'bg-avatar-zinc text-avatar-zinc-foreground',
  'bg-avatar-violet text-avatar-violet-foreground',
  'bg-avatar-pink text-avatar-pink-foreground',
  'bg-avatar-cyan text-avatar-cyan-foreground',
  'bg-avatar-teal text-avatar-teal-foreground',
];

function initials(name: string): string {
  const words = name.trim().split(/\s+/);

  return `${words[0]?.[0] ?? ''}${words.length > 1 ? (words.at(-1)?.[0] ?? '') : ''}`.toLocaleUpperCase(
    'pt-BR',
  );
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return (
      error.response?.data?.message ?? 'Verifique a conexão e tente novamente.'
    );
  }

  return 'Verifique a conexão e tente novamente.';
}

function isNotFound(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

function penaltyStyle(rate: number): string {
  if (rate === 0) {
    return 'border-success-soft-border bg-success-soft text-success-soft-foreground';
  }
  if (rate === 20) {
    return 'border-destructive-soft-border bg-destructive-soft text-destructive-soft-foreground';
  }

  return 'border-warning-soft-border bg-warning-soft text-warning-soft-foreground';
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  suffix,
}: {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  suffix?: string;
}) {
  return (
    <Card className="gap-0 py-5 shadow-xs">
      <CardHeader className="gap-0 px-5">
        <CardTitle className="text-sm font-normal text-muted-foreground">
          {title}
        </CardTitle>
        <CardAction>
          <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent className="px-5 pt-3">
        <p className="text-2xl font-semibold tabular-nums">
          {value}
          {suffix && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {suffix}
            </span>
          )}
        </p>
        <CardDescription className="mt-1">{description}</CardDescription>
      </CardContent>
    </Card>
  );
}

function ClubDetailSkeleton() {
  return (
    <div className="space-y-6" aria-label="Carregando clube" role="status">
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-5 w-36" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="gap-4 py-5 shadow-xs">
            <CardHeader className="px-5">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-2 px-5">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="gap-0 overflow-hidden py-0 shadow-xs">
        <CardHeader className="border-b px-4 py-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ClubNotFound({ clubLabel }: { clubLabel: string }) {
  return (
    <Card className="min-h-72 items-center justify-center gap-4 px-6 py-10 text-center shadow-xs">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <SearchX aria-hidden="true" className="size-5" />
      </div>
      <div className="space-y-2">
        <h2 className="font-semibold">Clube não encontrado</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {clubLabel}. O endereço pode estar errado ou o clube não existe.
        </p>
      </div>
      <Button variant="outline" asChild>
        <Link to="/clubes">
          <ArrowLeft aria-hidden="true" />
          Voltar para clubes
        </Link>
      </Button>
    </Card>
  );
}

function conditionBadge(player: ClubRosterPlayer) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 rounded-md font-normal',
        conditionStyles[player.condition],
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {conditionLabels[player.condition]}
    </Badge>
  );
}

function ClubRoster({ players }: { players: ClubRosterPlayer[] }) {
  return (
    <Card className="min-w-0 gap-0 overflow-hidden py-0 shadow-xs">
      <CardHeader className="gap-1 border-b px-4 py-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Elenco</CardTitle>
          <Badge variant="secondary">{players.length}</Badge>
        </div>
        <CardDescription>
          Ordem por posição (GOL, ZAG, LAT, MEI, ATA) e nome. Contrato calculado
          para uma venda agora.
        </CardDescription>
      </CardHeader>
      {players.length === 0 ? (
        <CardContent className="flex flex-col items-center px-4 py-12 text-center">
          <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Shirt aria-hidden="true" className="size-5" />
          </div>
          <p className="font-semibold">O clube ainda não tem jogadores</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Compre jogadores livres para formar o elenco.
          </p>
        </CardContent>
      ) : (
        <Table className="min-w-[1080px]" aria-label="Elenco do clube">
          <TableHeader>
            <TableRow className="bg-muted-subtle hover:bg-muted-subtle">
              <TableHead className="pl-4 text-muted-foreground">
                Jogador
              </TableHead>
              <TableHead className="text-muted-foreground">Posição</TableHead>
              <TableHead className="text-right text-muted-foreground">
                Overall
              </TableHead>
              <TableHead className="text-muted-foreground">Condição</TableHead>
              <TableHead className="text-right text-muted-foreground">
                Valor de mercado
              </TableHead>
              <TableHead className="text-right text-muted-foreground">
                Valor de compra
              </TableHead>
              <TableHead className="text-muted-foreground">
                Fim da fidelidade
              </TableHead>
              <TableHead className="text-right text-muted-foreground">
                Dias restantes
              </TableHead>
              <TableHead className="pr-4 text-muted-foreground">
                % de multa
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((player) => {
              const loyaltyUntil = new Date(player.contract.loyalty_until);

              return (
                <TableRow key={player.id}>
                  <TableCell className="pl-4">
                    <div className="flex min-w-40 items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback
                          className={
                            avatarStyles[player.id % avatarStyles.length]
                          }
                        >
                          {initials(player.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{player.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="rounded-md px-1.5 py-0 text-[11px] font-normal"
                    >
                      {player.position}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {player.overall}
                  </TableCell>
                  <TableCell>{conditionBadge(player)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {moneyFormatter.format(player.market_value)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {moneyFormatter.format(player.contract.purchase_value)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    <time dateTime={player.contract.loyalty_until}>
                      <span className="block">
                        {dateFormatter.format(loyaltyUntil)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {timeFormatter.format(loyaltyUntil)}
                      </span>
                    </time>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {integerFormatter.format(player.contract.remaining_days)}
                  </TableCell>
                  <TableCell className="pr-4">
                    <Badge
                      variant="outline"
                      className={cn(
                        'rounded-md font-normal',
                        penaltyStyle(player.contract.penalty_rate),
                      )}
                    >
                      {player.contract.penalty_rate}%
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

export function ClubDetailPage() {
  const { clubId: clubIdParam } = useParams();
  const clubId = Number(clubIdParam);
  const isValidClubId = Number.isSafeInteger(clubId) && clubId > 0;
  const queryClient = useQueryClient();
  const club = useClubDetail(clubId, isValidClubId);
  const transactions = useClubTransactions(
    clubId,
    { type: 'COMPRA,VENDA' },
    isValidClubId && club.isSuccess,
  );
  const sidebarClubs = useClubs();
  const players = usePlayers(1);
  const notFound = !isValidClubId || (club.isError && isNotFound(club.error));
  const breadcrumbPage =
    club.data?.name ?? (clubIdParam ? `Clube ${clubIdParam}` : 'Clube');

  return (
    <AppShell
      clubs={sidebarClubs.data ?? []}
      playerTotal={players.data?.meta.total_items}
      activeSection="clubs"
      activeClubId={isValidClubId ? clubId : undefined}
      breadcrumbParent={{ label: 'Clubes', to: '/clubes' }}
      breadcrumbPage={breadcrumbPage}
      refreshLabel="Atualizar clube"
      isRefreshing={
        club.isFetching || sidebarClubs.isFetching || transactions.isFetching
      }
      onRefresh={() => {
        if (isValidClubId) {
          void Promise.all([
            club.refetch(),
            queryClient.invalidateQueries({ queryKey: ['clubs'] }),
            queryClient.invalidateQueries({
              queryKey: ['club', clubId, 'transactions'],
            }),
          ]);
        } else {
          void queryClient.invalidateQueries({ queryKey: ['clubs'] });
        }
      }}
    >
      <main className="min-w-0 flex-1 px-4 py-8 md:px-8">
        {notFound ? (
          <ClubNotFound
            clubLabel={
              isValidClubId
                ? 'Clube não encontrado'
                : 'O identificador do clube é inválido'
            }
          />
        ) : club.isPending ? (
          <ClubDetailSkeleton />
        ) : club.isError ? (
          <Alert
            variant="destructive"
            className="flex min-h-72 flex-col items-center justify-center gap-2 text-center"
          >
            <ServerOff aria-hidden="true" />
            <AlertTitle className="text-base">
              Não foi possível carregar o clube
            </AlertTitle>
            <AlertDescription className="block max-w-sm">
              {errorMessage(club.error)}
            </AlertDescription>
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={() => void club.refetch()}
            >
              Tentar novamente
            </Button>
          </Alert>
        ) : club.data ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border bg-muted text-sm font-semibold">
                  {club.data.acronym}
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-semibold tracking-tight">
                    {club.data.name}
                  </h1>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-normal">
                      Sigla {club.data.acronym}
                    </Badge>
                    <Badge variant="outline" className="font-normal">
                      <Shirt aria-hidden="true" />
                      {club.data.players.length} de 12 jogadores
                    </Badge>
                  </div>
                </div>
              </div>
              <Button asChild className="shrink-0 self-start">
                <Link to="/jogadores">
                  <ShoppingCart aria-hidden="true" />
                  Comprar jogadores
                </Link>
              </Button>
            </div>

            <section
              aria-label="Resumo financeiro e do elenco"
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
              <MetricCard
                title="Caixa"
                value={moneyFormatter.format(club.data.cash)}
                suffix="moedas"
                description="Só muda por compras e vendas"
                icon={WalletCards}
              />
              <MetricCard
                title="Valor do elenco"
                value={moneyFormatter.format(club.data.squad_value)}
                suffix="moedas"
                description="Soma dos valores de mercado"
                icon={Coins}
              />
              <MetricCard
                title="Patrimônio"
                value={moneyFormatter.format(club.data.net_worth)}
                suffix="moedas"
                description="Caixa + valor do elenco"
                icon={Landmark}
              />
              <MetricCard
                title="Elenco"
                value={`${club.data.players.length} de 12`}
                description="Limite de 12 jogadores"
                icon={Shirt}
              />
            </section>

            <Tabs defaultValue="elenco" className="min-w-0">
              <TabsList
                variant="line"
                className="w-full justify-start rounded-none border-b p-0"
              >
                <TabsTrigger value="elenco" className="flex-none px-4">
                  <Shirt aria-hidden="true" />
                  Elenco
                  <Badge variant="secondary" className="ml-1">
                    {club.data.players.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="escalacao" className="flex-none px-4">
                  <ClipboardList aria-hidden="true" />
                  Escalação
                </TabsTrigger>
                <TabsTrigger value="historico" className="flex-none px-4">
                  <History aria-hidden="true" />
                  Histórico
                  {transactions.data && (
                    <Badge variant="secondary" className="ml-1">
                      {transactions.data.data.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="elenco" className="pt-4">
                <ClubRoster players={club.data.players} />
              </TabsContent>
              <TabsContent value="escalacao" className="pt-4">
                <ClubLineupTab
                  clubId={club.data.id}
                  clubName={club.data.name}
                  roster={club.data.players}
                />
              </TabsContent>
              <TabsContent value="historico" className="pt-4">
                <ClubTransactionHistory clubId={club.data.id} />
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
