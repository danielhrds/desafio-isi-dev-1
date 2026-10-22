import axios from 'axios';
import {
  CircleAlert,
  CircleCheck,
  HandCoins,
  History,
  Info,
  LoaderCircle,
  TriangleAlert,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSellPlayer } from '@/hooks/use-market';
import { cn } from '@/lib/utils';
import type { ClubListItem, ClubRosterPlayer } from '@/types/club';
import type { PlayerPosition } from '@/types/player';
import type { SellPlayerResult } from '@/types/market';

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

const positionLabels: Record<PlayerPosition, string> = {
  GOL: 'Goleiro',
  ZAG: 'Zagueiro',
  LAT: 'Lateral',
  MEI: 'Meio-campo',
  ATA: 'Atacante',
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

function formatDateTime(value: string): string {
  const date = new Date(value);

  return `${dateFormatter.format(date)}, ${timeFormatter.format(date)}`;
}

function signedMoney(value: number): string {
  return `${value >= 0 ? '+' : ''}${moneyFormatter.format(value)}`;
}

function getSaleError(error: unknown): { title: string; message: string } {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    const status = error.response?.status;
    const message = error.response?.data?.message;

    if (status === 404 || status === 409) {
      return {
        title: 'A venda foi recusada',
        message: message ?? 'O jogador não pode ser vendido neste momento.',
      };
    }

    return {
      title: 'Não foi possível concluir a venda',
      message: message ?? 'Verifique sua conexão e tente novamente.',
    };
  }

  return {
    title: 'Não foi possível concluir a venda',
    message: 'Verifique sua conexão e tente novamente.',
  };
}

function DetailRow({
  label,
  value,
  description,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  description?: string;
  valueClassName?: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-3.5 py-2.5 sm:px-4">
      <dt className="min-w-0 text-sm text-muted-foreground">
        <span>{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
            {description}
          </span>
        )}
      </dt>
      <dd
        className={cn(
          'text-right text-sm font-medium tabular-nums',
          valueClassName,
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function DetailList({ children }: { children: ReactNode }) {
  return (
    <Card className="gap-0 overflow-hidden rounded-lg py-0 shadow-none">
      <CardContent className="p-0">
        <dl className="divide-y">{children}</dl>
      </CardContent>
    </Card>
  );
}

function PlayerSummary({ player }: { player: ClubRosterPlayer }) {
  return (
    <Card className="gap-0 rounded-lg bg-muted-subtle py-0 shadow-none">
      <CardContent className="flex min-w-0 items-center gap-3 px-3.5 py-3 sm:px-4">
        <Avatar className="size-9 shrink-0">
          <AvatarFallback
            className={avatarStyles[player.id % avatarStyles.length]}
          >
            {initials(player.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{player.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {player.position} · {positionLabels[player.position]} · {player.age}{' '}
            anos
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-foreground">Valor de mercado</p>
          <p className="text-base font-semibold tabular-nums">
            {moneyFormatter.format(player.market_value)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SaleResult({
  result,
  clubName,
  isStarter,
}: {
  result: SellPlayerResult;
  clubName: string;
  isStarter: boolean;
}) {
  const contractBadge =
    result.contract_status === 'RESCINDIDO' ? (
      <Badge
        variant="outline"
        className="border-warning-soft-border bg-warning-soft text-warning-soft-foreground"
      >
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
        Rescindido
      </Badge>
    ) : (
      <Badge variant="secondary">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
        Encerrado
      </Badge>
    );

  return (
    <>
      <DialogHeader className="gap-2 pr-7 text-left">
        <div className="flex size-9 items-center justify-center rounded-full bg-success-soft text-success">
          <CircleCheck aria-hidden="true" className="size-5" />
        </div>
        <DialogTitle id="sale-success-title">Venda concluída</DialogTitle>
        <DialogDescription>
          {result.player_name} voltou a ficar livre
          {isStarter ? ' e saiu da escalação' : ''}.
        </DialogDescription>
      </DialogHeader>

      <DetailList>
        <DetailRow
          label="Valor de compra"
          value={moneyFormatter.format(result.purchase_value)}
        />
        <DetailRow
          label="Valor de venda"
          description="Valor de mercado no momento da venda"
          value={moneyFormatter.format(result.value)}
        />
        <DetailRow
          label="Dias restantes"
          value={String(result.remaining_days)}
        />
        <DetailRow
          label="Multa"
          description={
            result.penalty_rate === 0
              ? 'Fidelidade cumprida: sem multa'
              : `${result.penalty_rate}% do valor de venda, com teto de 10,00`
          }
          value={moneyFormatter.format(result.penalty)}
        />
        <DetailRow
          label="Lucro"
          value={signedMoney(result.profit)}
          valueClassName={
            result.profit > 0
              ? 'text-success'
              : result.profit < 0
                ? 'text-destructive'
                : 'text-muted-foreground'
          }
        />
        <DetailRow
          label="Comissão"
          description={
            result.profit > 0
              ? '10% do lucro até 10,00 + 20% do que passar'
              : 'Sem lucro: sem comissão'
          }
          value={moneyFormatter.format(result.fee)}
        />
        <DetailRow
          label="Crédito no caixa"
          description="Valor de venda − multa − comissão"
          value={signedMoney(result.cash_change)}
          valueClassName="font-semibold"
        />
        <DetailRow label="Contrato" value={contractBadge} />
        <DetailRow
          label={`Novo caixa do ${clubName}`}
          value={moneyFormatter.format(result.club_cash)}
          valueClassName="font-semibold"
        />
      </DetailList>
    </>
  );
}

export function ClubSellDialog({
  clubId,
  clubName,
  clubs,
  player,
  isStarter,
  isLineupLoading,
  isLineupUnavailable,
  onClose,
  onViewHistory,
}: {
  clubId: number;
  clubName: string;
  clubs: ClubListItem[];
  player: ClubRosterPlayer;
  isStarter: boolean;
  isLineupLoading: boolean;
  isLineupUnavailable: boolean;
  onClose: () => void;
  onViewHistory: (clubId: number) => void;
}) {
  const sellMutation = useSellPlayer();
  const result = sellMutation.data;
  const error = sellMutation.error ? getSaleError(sellMutation.error) : null;
  const isPending = sellMutation.isPending;
  const [starterAtConfirmation, setStarterAtConfirmation] = useState<
    boolean | null
  >(null);
  const loyaltyUntil = player.contract.loyalty_until;
  const shouldCheckLineup = isLineupLoading && !result && !isPending;
  const wasStarter = starterAtConfirmation ?? isStarter;

  function close() {
    if (!isPending) onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[520px]"
        aria-labelledby={result ? 'sale-success-title' : 'sale-dialog-title'}
        showCloseButton={!isPending}
      >
        {result ? (
          <>
            <SaleResult
              result={result}
              clubName={
                result.club_id === clubId
                  ? clubName
                  : (clubs.find((clubItem) => clubItem.id === result.club_id)
                      ?.name ?? `Clube #${result.club_id}`)
              }
              isStarter={result.club_id === clubId && wasStarter}
            />
            <DialogFooter className="border-t pt-4 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => onViewHistory(result.club_id)}
              >
                <History aria-hidden="true" />
                Ver histórico
              </Button>
              <Button type="button" onClick={close}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="gap-1 pr-7 text-left">
              <DialogTitle id="sale-dialog-title">
                Vender {player.name}?
              </DialogTitle>
              <DialogDescription>
                O jogador sai do elenco do {clubName} e volta a ficar livre.
              </DialogDescription>
            </DialogHeader>

            {shouldCheckLineup && (
              <Alert>
                <LoaderCircle aria-hidden="true" className="animate-spin" />
                <AlertTitle>Consultando a escalação</AlertTitle>
                <AlertDescription>
                  Aguarde para confirmar se {player.name} é titular.
                </AlertDescription>
              </Alert>
            )}

            {isStarter && !shouldCheckLineup && (
              <Alert variant="warning">
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>{player.name} é titular</AlertTitle>
                <AlertDescription>
                  Ao vender, ele sai da escalação, e o {clubName} só volta a
                  jogar partidas depois de escalar de novo os 5 titulares.
                </AlertDescription>
              </Alert>
            )}

            {isLineupUnavailable && !shouldCheckLineup && !isPending && (
              <Alert variant="warning">
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>Não foi possível consultar a escalação</AlertTitle>
                <AlertDescription>
                  A venda continua disponível, mas não conseguimos confirmar se{' '}
                  {player.name} é titular. A API atualiza a escalação junto com
                  a venda.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <CircleAlert aria-hidden="true" />
                <AlertTitle>{error.title}</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}

            <PlayerSummary player={player} />

            <DetailList>
              <DetailRow
                label="Valor de compra"
                value={moneyFormatter.format(player.contract.purchase_value)}
              />
              <DetailRow
                label="Fim da fidelidade"
                value={formatDateTime(loyaltyUntil)}
              />
              <DetailRow
                label="Dias restantes"
                value={String(player.contract.remaining_days)}
              />
              <DetailRow
                label="% de multa se vender agora"
                value={
                  <Badge
                    variant="outline"
                    className={cn(
                      'font-normal',
                      player.contract.penalty_rate === 0
                        ? 'border-success-soft-border bg-success-soft text-success-soft-foreground'
                        : 'border-warning-soft-border bg-warning-soft text-warning-soft-foreground',
                    )}
                  >
                    {player.contract.penalty_rate}%
                  </Badge>
                }
              />
            </DetailList>

            <Alert>
              <Info aria-hidden="true" />
              <AlertDescription>
                A venda é pelo valor de mercado do momento. Multa (teto de
                10,00), lucro, comissão e crédito são calculados ao confirmar.
              </AlertDescription>
            </Alert>

            {isPending && (
              <Alert>
                <Info aria-hidden="true" />
                <AlertDescription>
                  Enviando a venda. Os botões ficam desabilitados até a
                  resposta.
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="border-t pt-4 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={close}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setStarterAtConfirmation(isStarter);
                  sellMutation.mutate({ playerId: player.id, clubId });
                }}
                disabled={isPending || shouldCheckLineup}
                className="sm:min-w-[168px]"
              >
                {isPending ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <HandCoins aria-hidden="true" />
                )}
                {isPending ? 'Vendendo…' : 'Confirmar venda'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
