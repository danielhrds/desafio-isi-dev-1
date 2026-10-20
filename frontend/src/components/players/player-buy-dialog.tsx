import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { CalendarDays, Clock3, Info, Shield, ShoppingCart } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useClubSummaries } from '@/hooks/use-clubs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PlayerListItem, PlayerPosition } from '@/types/player';
import {
  playerBuySchema,
  type PlayerBuyFormValues,
  type PlayerBuyPayload,
} from './player-buy-schema';

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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

export function PlayerBuyDialog({
  player,
  onClose,
}: {
  player: PlayerListItem;
  onClose: () => void;
}) {
  const clubsQuery = useClubSummaries('name');
  const clubs = clubsQuery.data ?? [];
  const form = useForm<PlayerBuyFormValues, unknown, PlayerBuyPayload>({
    resolver: zodResolver(playerBuySchema),
    defaultValues: {
      club_id: '',
      loyalty_date: '',
      loyalty_time: '',
    },
    mode: 'onTouched',
  });

  const selectedClubId = form.watch('club_id');
  const selectedClub = clubs.find(
    (club) => club.id.toString() === selectedClubId,
  );
  const clubsError = axios.isAxiosError<{ message?: string }>(clubsQuery.error)
    ? (clubsQuery.error.response?.data?.message ??
      'Verifique a conexão e tente novamente.')
    : 'Verifique a conexão e tente novamente.';

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto p-5 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle>Comprar jogador</DialogTitle>
          <DialogDescription>
            Escolha o clube comprador e até quando vai a fidelidade do contrato.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-lg border bg-muted-subtle p-3">
            <Avatar>
              <AvatarFallback
                className={`font-medium ${avatarStyles[player.id % avatarStyles.length]}`}
              >
                {initials(player.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{player.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {player.position} · {positionLabels[player.position]} ·{' '}
                {player.age} anos
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-muted-foreground">Valor de mercado</p>
              <p className="tabular-nums font-semibold">
                {moneyFormatter.format(player.market_value)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="buy-club">Clube comprador</Label>
            <Controller
              control={form.control}
              name="club_id"
              render={({ field, fieldState }) => (
                <>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={
                      clubsQuery.isPending ||
                      clubsQuery.isError ||
                      clubs.length === 0
                    }
                  >
                    <SelectTrigger
                      id="buy-club"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={
                        fieldState.error ? 'buy-club-error' : undefined
                      }
                      onBlur={field.onBlur}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Shield
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <SelectValue
                          placeholder={
                            clubsQuery.isPending
                              ? 'Carregando clubes...'
                              : 'Selecione o clube'
                          }
                        />
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {clubs.map((club) => (
                        <SelectItem key={club.id} value={club.id.toString()}>
                          {club.name} ({club.acronym}) · caixa{' '}
                          {moneyFormatter.format(club.cash)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.error && (
                    <p
                      id="buy-club-error"
                      className="text-sm text-destructive"
                      role="alert"
                    >
                      {fieldState.error.message}
                    </p>
                  )}
                </>
              )}
            />
            {clubsQuery.isError && (
              <Alert variant="destructive" className="items-center">
                <AlertDescription className="block text-sm">
                  {clubsError}
                </AlertDescription>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="col-start-2 mt-2"
                  onClick={() => void clubsQuery.refetch()}
                >
                  Tentar novamente
                </Button>
              </Alert>
            )}
            {clubsQuery.isSuccess && clubs.length === 0 && (
              <Alert>
                <AlertDescription className="block text-sm">
                  Cadastre um clube antes de comprar jogadores.
                </AlertDescription>
              </Alert>
            )}
            <p className="text-xs text-muted-foreground">
              {selectedClub
                ? `Caixa atual: ${moneyFormatter.format(selectedClub.cash)}.`
                : 'Selecione um clube para consultar o caixa atual.'}{' '}
              O custo total (valor + taxa) pode ser até 50% do caixa.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="buy-loyalty-date">Fim da fidelidade</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
              <div>
                <div className="relative">
                  <CalendarDays
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="buy-loyalty-date"
                    type="date"
                    className="pl-9"
                    aria-invalid={Boolean(form.formState.errors.loyalty_date)}
                    aria-describedby={
                      form.formState.errors.loyalty_date
                        ? 'buy-loyalty-date-error'
                        : undefined
                    }
                    {...form.register('loyalty_date')}
                  />
                </div>
                {form.formState.errors.loyalty_date && (
                  <p
                    id="buy-loyalty-date-error"
                    className="mt-1 text-sm text-destructive"
                    role="alert"
                  >
                    {form.formState.errors.loyalty_date.message}
                  </p>
                )}
              </div>
              <div>
                <div className="relative">
                  <Clock3
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="buy-loyalty-time"
                    type="time"
                    step={60}
                    className="pl-9"
                    aria-label="Horário do fim da fidelidade"
                    aria-invalid={Boolean(form.formState.errors.loyalty_time)}
                    aria-describedby={
                      form.formState.errors.loyalty_time
                        ? 'buy-loyalty-time-error'
                        : undefined
                    }
                    {...form.register('loyalty_time')}
                  />
                </div>
                {form.formState.errors.loyalty_time && (
                  <p
                    id="buy-loyalty-time-error"
                    className="mt-1 text-sm text-destructive"
                    role="alert"
                  >
                    {form.formState.errors.loyalty_time.message}
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Depois do momento da compra e até 1.095 dias. Horário de Brasília;
              a data será enviada com o fuso (-03:00).
            </p>
          </div>

          <Alert className="grid-cols-[1rem_1fr] gap-x-2 bg-muted-subtle px-3 py-2.5 text-xs text-muted-foreground [&>svg]:size-4">
            <Info aria-hidden="true" />
            <AlertDescription className="block text-xs text-muted-foreground">
              A taxa é de 5% do valor de mercado, só quando ele passa de 30,00.
              Taxa, custo e novo caixa serão calculados ao confirmar.
            </AlertDescription>
          </Alert>

          <DialogFooter className="border-t pt-4 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button type="button" className="w-full sm:w-auto" disabled>
              <ShoppingCart aria-hidden="true" />
              Confirmar compra
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
