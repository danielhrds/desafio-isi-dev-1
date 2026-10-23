import { ErrorAlert } from '@/components/error-alert';
import axios from 'axios';
import { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BadgePercent,
  Check,
  Download,
  HandCoins,
  History,
  RefreshCw,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useClubTransactions,
  useExportClubTransactions,
} from '@/hooks/use-transactions';
import type {
  ClubTransaction,
  ClubTransactionFilters,
  ClubTransactionSummary,
  TransactionType,
} from '@/types/transaction.js';

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

const typeLabels: Record<TransactionType, string> = {
  COMPRA: 'Compra',
  VENDA: 'Venda',
};

const avatarStyles = [
  'bg-avatar-zinc text-avatar-zinc-foreground',
  'bg-avatar-violet text-avatar-violet-foreground',
  'bg-avatar-pink text-avatar-pink-foreground',
  'bg-avatar-cyan text-avatar-cyan-foreground',
  'bg-avatar-teal text-avatar-teal-foreground',
];

function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

function formatSignedMoney(value: number): string {
  if (value === 0) return formatMoney(value);

  return `${value < 0 ? '-' : '+'} ${formatMoney(Math.abs(value))}`;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/);

  return `${words[0]?.[0] ?? ''}${words.length > 1 ? (words.at(-1)?.[0] ?? '') : ''}`.toLocaleUpperCase(
    'pt-BR',
  );
}

function getApiMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return (
      error.response?.data?.message ?? 'Verifique a conexão e tente novamente.'
    );
  }

  return 'Verifique a conexão e tente novamente.';
}

function isApiFilterRejection(error: unknown): boolean {
  return (
    axios.isAxiosError(error) &&
    [400, 404].includes(error.response?.status ?? 0)
  );
}

function uniquePlayers(transactions: ClubTransaction[]) {
  const playersById = new Map<number, string>();

  for (const transaction of transactions) {
    if (!playersById.has(transaction.player_id)) {
      playersById.set(transaction.player_id, transaction.player_name);
    }
  }

  return [...playersById.entries()].map(([id, name]) => ({ id, name }));
}

function downloadFile(file: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function getExportErrorMessage(error: unknown): Promise<string> {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const body = JSON.parse(await error.response.data.text()) as {
        message?: string;
      };

      if (body.message) return body.message;
    } catch {
      // Fall through to the shared connection message when the response is not JSON.
    }
  }

  return getApiMessage(error);
}

function TypeFilterButton({
  type,
  selected,
  onClick,
}: {
  type: TransactionType;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={selected}
      aria-label={`Filtrar por ${typeLabels[type].toLocaleLowerCase('pt-BR')}`}
      onClick={onClick}
      className={
        selected
          ? 'border-primary bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary'
          : 'text-foreground'
      }
    >
      <span
        aria-hidden="true"
        className={`flex size-4 items-center justify-center rounded-sm border ${
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-input bg-background'
        }`}
      >
        {selected && <Check className="size-3" />}
      </span>
      {typeLabels[type]}
    </Button>
  );
}

function SummaryStrip({ summary }: { summary: ClubTransactionSummary }) {
  const profitIcon = summary.total_profit < 0 ? TrendingDown : TrendingUp;
  const items: {
    label: string;
    value: number;
    hint: string;
    icon: LucideIcon;
    signed?: boolean;
    valueClassName?: string;
  }[] = [
    {
      label: 'Total pago em compras',
      value: summary.total_spent,
      hint: 'Valor + taxa',
      icon: ShoppingCart,
    },
    {
      label: 'Total recebido em vendas',
      value: summary.total_received,
      hint: 'Crédito líquido',
      icon: HandCoins,
    },
    {
      label: 'Taxas e comissões',
      value: summary.total_fees,
      hint: 'Somadas',
      icon: BadgePercent,
    },
    {
      label: 'Multas',
      value: summary.total_penalties,
      hint: 'Por fidelidade',
      icon: TriangleAlert,
    },
    {
      label: 'Lucro total',
      value: summary.total_profit,
      hint: 'Soma dos lucros, com sinal',
      icon: profitIcon,
      signed: true,
      valueClassName:
        summary.total_profit < 0
          ? 'text-destructive'
          : summary.total_profit > 0
            ? 'text-success'
            : 'text-foreground',
    },
  ];

  return (
    <div
      aria-label="Resumo das transações"
      className="grid min-w-[1040px] grid-cols-5 divide-x border-t bg-muted-subtle"
    >
      {items.map(
        ({ label, value, hint, icon: Icon, signed, valueClassName }) => (
          <div key={label} className="min-w-0 px-3 py-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{label}</span>
            </p>
            <p
              className={`mt-1 font-semibold tabular-nums ${valueClassName ?? ''}`}
            >
              {signed ? formatSignedMoney(value) : formatMoney(value)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
        ),
      )}
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: ClubTransaction }) {
  const createdAt = new Date(transaction.created_at);
  const isPurchase = transaction.type === 'COMPRA';
  const TypeIcon = isPurchase ? ShoppingCart : HandCoins;
  const profitClassName =
    transaction.profit === null || transaction.profit === 0
      ? 'text-muted-foreground'
      : transaction.profit < 0
        ? 'text-destructive'
        : 'text-success';

  return (
    <TableRow>
      <TableCell className="pl-4 tabular-nums">
        <time
          dateTime={transaction.created_at}
          className="flex items-center gap-2 whitespace-nowrap"
        >
          <span>{dateFormatter.format(createdAt)}</span>
          <span className="text-muted-foreground">
            {timeFormatter.format(createdAt)}
          </span>
        </time>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            isPurchase
              ? 'gap-1 border-border bg-background text-foreground'
              : 'gap-1 border-transparent bg-muted text-foreground'
          }
        >
          <TypeIcon aria-hidden="true" />
          {typeLabels[transaction.type]}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex min-w-44 items-center gap-2.5">
          <Avatar className="size-8">
            <AvatarFallback
              className={
                avatarStyles[transaction.player_id % avatarStyles.length]
              }
            >
              {initials(transaction.player_name)}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{transaction.player_name}</span>
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMoney(transaction.value)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMoney(transaction.fee)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMoney(transaction.penalty)}
      </TableCell>
      <TableCell className={`text-right tabular-nums ${profitClassName}`}>
        {transaction.profit === null
          ? '—'
          : formatSignedMoney(transaction.profit)}
      </TableCell>
      <TableCell
        className={`pr-4 text-right font-semibold tabular-nums ${
          transaction.cash_change < 0 ? 'text-destructive' : 'text-success'
        }`}
      >
        {formatSignedMoney(transaction.cash_change)}
      </TableCell>
    </TableRow>
  );
}

function HistoryTable({ transactions }: { transactions: ClubTransaction[] }) {
  return (
    <Table className="min-w-full" aria-label="Histórico de transações do clube">
      <TableHeader>
        <TableRow className="bg-muted-subtle hover:bg-muted-subtle">
          <TableHead className="pl-4 text-muted-foreground">
            Data e hora
          </TableHead>
          <TableHead className="text-muted-foreground">Tipo</TableHead>
          <TableHead className="text-muted-foreground">Jogador</TableHead>
          <TableHead className="text-right text-muted-foreground">
            Valor
          </TableHead>
          <TableHead className="text-right text-muted-foreground">
            Taxa ou comissão
          </TableHead>
          <TableHead className="text-right text-muted-foreground">
            Multa
          </TableHead>
          <TableHead className="text-right text-muted-foreground">
            Lucro
          </TableHead>
          <TableHead className="pr-4 text-right text-muted-foreground">
            Variação do caixa
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => (
          <TransactionRow key={transaction.id} transaction={transaction} />
        ))}
      </TableBody>
    </Table>
  );
}

function EmptyHistory({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex min-h-[230px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <History aria-hidden="true" className="size-5" />
      </div>
      <p className="font-semibold">
        {filtered ? 'Nenhuma transação encontrada' : 'Nenhuma transação ainda'}
      </p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {filtered
          ? 'Ajuste ou limpe os filtros para consultar outras transações.'
          : 'As compras e vendas do clube aparecem aqui, com os totais logo abaixo.'}
      </p>
    </div>
  );
}

function HistoryLoading() {
  return (
    <div
      className="overflow-x-auto"
      role="status"
      aria-label="Carregando histórico"
    >
      <div className="min-w-[1040px]">
        <div className="flex gap-4 border-b bg-muted-subtle p-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-4 min-w-20 flex-1" />
          ))}
        </div>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex gap-4 border-b p-4 last:border-0">
            {Array.from({ length: 8 }, (_, cellIndex) => (
              <Skeleton key={cellIndex} className="h-4 min-w-20 flex-1" />
            ))}
          </div>
        ))}
        <div className="grid grid-cols-5 divide-x border-t bg-muted-subtle">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="space-y-2 p-3">
              <Skeleton className="h-3 w-28 max-w-full" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GenericHistoryError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <Card className="min-h-72 items-center justify-center gap-4 px-6 py-10 text-center shadow-xs">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <AlertCircle aria-hidden="true" className="size-5" />
      </div>
      <div className="space-y-2">
        <CardTitle className="text-base">
          Não foi possível carregar o histórico
        </CardTitle>
        <CardDescription className="max-w-md">
          {getApiMessage(error)}
        </CardDescription>
      </div>
      <Button type="button" variant="outline" onClick={onRetry}>
        <RefreshCw aria-hidden="true" />
        Tentar novamente
      </Button>
    </Card>
  );
}

export function ClubTransactionHistory({ clubId }: { clubId: number }) {
  const [selectedTypes, setSelectedTypes] = useState<TransactionType[]>([
    'COMPRA',
    'VENDA',
  ]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('all');
  const exportInFlight = useRef(false);

  const typeFilter: ClubTransactionFilters['type'] =
    selectedTypes.length === 2 ? 'COMPRA,VENDA' : selectedTypes[0];
  const playerIdFilter =
    selectedPlayerId === 'all' ? undefined : Number(selectedPlayerId);
  const filters: ClubTransactionFilters = {
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(playerIdFilter ? { player_id: playerIdFilter } : {}),
  };
  const needsUnfilteredPlayers =
    selectedTypes.length === 1 || playerIdFilter !== undefined;
  const allTransactions = useClubTransactions(
    clubId,
    {},
    needsUnfilteredPlayers,
  );
  const transactions = useClubTransactions(clubId, filters);
  const exportMutation = useExportClubTransactions();
  const playerOptionsResponse = needsUnfilteredPlayers
    ? allTransactions.data
    : transactions.data;
  const players = useMemo(
    () => uniquePlayers(playerOptionsResponse?.data ?? []),
    [playerOptionsResponse?.data],
  );
  const hasActiveFilters =
    selectedTypes.length === 1 || selectedPlayerId !== 'all';
  const filterRejected =
    transactions.isError &&
    hasActiveFilters &&
    isApiFilterRejection(transactions.error);

  function toggleType(type: TransactionType) {
    setSelectedTypes((current) =>
      current.includes(type)
        ? current.length === 1
          ? current
          : current.filter((selectedType) => selectedType !== type)
        : [...current, type],
    );
  }

  function clearFilters() {
    setSelectedTypes(['COMPRA', 'VENDA']);
    setSelectedPlayerId('all');
  }

  async function handleExport() {
    if (exportInFlight.current) return;
    exportInFlight.current = true;

    try {
      const exported = await exportMutation.mutateAsync({ clubId, filters });
      downloadFile(exported.file, exported.filename);
      toast.success('CSV baixado', {
        description: `${exported.filename}, com os filtros aplicados.`,
      });
    } catch (error) {
      toast.error('Não foi possível exportar o histórico', {
        description: await getExportErrorMessage(error),
      });
    } finally {
      exportInFlight.current = false;
    }
  }

  if (transactions.isError && !filterRejected) {
    return (
      <GenericHistoryError
        error={transactions.error}
        onRetry={() => void transactions.refetch()}
      />
    );
  }

  return (
    <div className="space-y-3">
      <Card className="min-w-0 gap-0 overflow-hidden py-0 shadow-xs">
        <CardHeader className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">Histórico de transações</CardTitle>
            <CardDescription>
              Da mais recente para a mais antiga, com o nome e os valores do
              momento de cada operação.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => void handleExport()}
            disabled={transactions.isPending || exportMutation.isPending}
          >
            <Download aria-hidden="true" />
            {exportMutation.isPending ? 'Exportando…' : 'Exportar CSV'}
          </Button>
        </CardHeader>

        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-5">
          <span className="mr-1 text-sm text-muted-foreground">Tipo</span>
          {(['COMPRA', 'VENDA'] as const).map((type) => (
            <TypeFilterButton
              key={type}
              type={type}
              selected={selectedTypes.includes(type)}
              onClick={() => toggleType(type)}
            />
          ))}

          <Separator
            orientation="vertical"
            className="mx-1 hidden h-5 sm:block"
          />

          <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
            <SelectTrigger
              aria-label="Filtrar por jogador"
              className="w-full min-w-48 justify-start sm:w-auto"
            >
              <UserRound aria-hidden="true" />
              <span className="text-muted-foreground">Jogador:</span>
              <SelectValue placeholder="todos" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              align="start"
              className="w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]"
            >
              <SelectItem value="all">todos</SelectItem>
              {players.map((player) => (
                <SelectItem
                  key={player.id}
                  value={String(player.id)}
                  className="whitespace-normal break-all"
                >
                  {player.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="px-2"
              onClick={clearFilters}
            >
              Limpar filtros
            </Button>
          )}
        </div>

        {transactions.isPending ? (
          <HistoryLoading />
        ) : filterRejected ? (
          <ErrorAlert
            className="m-4"
            title="O filtro foi recusado."
            message={getApiMessage(transactions.error)}
            icon={AlertCircle}
          />
        ) : transactions.data ? (
          <div
            role="region"
            aria-label="Tabela e resumo do histórico de transações"
            tabIndex={0}
            className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {transactions.data.data.length === 0 ? (
              <EmptyHistory filtered={hasActiveFilters} />
            ) : (
              <div className="min-w-[1040px]">
                <HistoryTable transactions={transactions.data.data} />
              </div>
            )}
            <SummaryStrip summary={transactions.data.summary} />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
