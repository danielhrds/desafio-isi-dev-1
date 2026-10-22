import axios from 'axios';
import { Eye, LoaderCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ClubListItem } from '@/types/club';
import type {
  PlayerDetail,
  PlayerListItem,
  PlayerPosition,
} from '@/types/player';
import { usePlayer } from '@/hooks/use-players';

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

type PlayerAttribute = keyof Pick<
  PlayerDetail,
  | 'pace'
  | 'shooting'
  | 'passing'
  | 'dribbling'
  | 'defending'
  | 'physical'
  | 'potential'
>;

const attributeLabels: Array<[PlayerAttribute, string]> = [
  ['pace', 'Velocidade'],
  ['shooting', 'Finalização'],
  ['passing', 'Passe'],
  ['dribbling', 'Drible'],
  ['defending', 'Defesa'],
  ['physical', 'Físico'],
  ['potential', 'Potencial'],
];

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? 'Tente novamente em instantes.';
  }
  return 'Tente novamente em instantes.';
}

function playerClubLabel(player: PlayerDetail, clubs: ClubListItem[]): string {
  if (player.club_id === null) return 'Livre';
  const club = clubs.find(({ id }) => id === player.club_id);
  return club ? `${club.acronym} · ${club.name}` : 'Clube indisponível';
}

function PlayerSummary({ player }: { player: PlayerDetail }) {
  const rows = [
    ['Valor base', moneyFormatter.format(player.base_value)],
    ['Valor de mercado', moneyFormatter.format(player.market_value)],
    ['Overall', player.overall],
  ] as const;

  return (
    <dl className="overflow-hidden rounded-lg border text-sm">
      {rows.map(([label, value], index) => (
        <div
          key={label}
          className={`flex items-center justify-between gap-3 px-3 py-3 ${index === 0 ? 'bg-muted/40' : 'border-t'}`}
        >
          <dt
            className={index === 0 ? 'font-semibold' : 'text-muted-foreground'}
          >
            {label}
          </dt>
          <dd className="font-medium tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PlayerAttributes({
  player,
  clubs,
}: {
  player: PlayerDetail;
  clubs: ClubListItem[];
}) {
  const rows: Array<[string, string | number]> = [
    ['Posição', positionLabels[player.position]],
    ['Idade', player.age],
    ['Agilidade', player.agility],
    [
      'Condição',
      player.condition === 'MAL_CONDICIONADO'
        ? 'Mal condicionado'
        : player.condition === 'DOENTE'
          ? 'Doente'
          : 'Apto',
    ],
    ['Clube', playerClubLabel(player, clubs)],
    ...attributeLabels.map(
      ([key, label]) => [label, player[key]] as [string, number],
    ),
  ];

  return (
    <section className="rounded-lg border p-3 text-sm">
      <h3 className="font-semibold">Dados do jogador</h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="truncate font-medium" title={String(value)}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function PlayerDetailsDialog({
  player: listPlayer,
  clubs,
  onClose,
}: {
  player: PlayerListItem;
  clubs: ClubListItem[];
  onClose: () => void;
}) {
  const player = usePlayer(listPlayer.id);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[540px]">
        <DialogHeader className="gap-2 pr-7 text-left">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Eye aria-hidden="true" className="size-5" />
          </div>
          <DialogTitle>Detalhes do jogador</DialogTitle>
          <DialogDescription>
            {listPlayer.name} · {positionLabels[listPlayer.position]}
          </DialogDescription>
        </DialogHeader>

        {player.isPending ? (
          <div
            role="status"
            className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Carregando detalhes...
          </div>
        ) : player.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível carregar os detalhes</AlertTitle>
            <AlertDescription>{getErrorMessage(player.error)}</AlertDescription>
            <Button
              type="button"
              variant="outline"
              className="col-start-2 mt-3 justify-self-start"
              onClick={() => void player.refetch()}
            >
              Tentar novamente
            </Button>
          </Alert>
        ) : (
          <div className="grid gap-3">
            <PlayerSummary player={player.data} />
            <PlayerAttributes player={player.data} clubs={clubs} />
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          <Button type="button" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
