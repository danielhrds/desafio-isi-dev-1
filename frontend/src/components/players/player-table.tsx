import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { ClubListItem } from '@/types/club';
import type {
  PlayerCondition,
  PlayerListItem,
  PlayerPosition,
} from '@/types/player';
import { cn } from '@/lib/utils';

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

const conditionStyles: Record<PlayerCondition, string> = {
  APTO: 'border-success-soft-border bg-success-soft text-success-soft-foreground',
  MAL_CONDICIONADO:
    'border-warning-soft-border bg-warning-soft text-warning-soft-foreground',
  DOENTE:
    'border-destructive-soft-border bg-destructive-soft text-destructive-soft-foreground',
};

const conditionLabels: Record<PlayerCondition, string> = {
  APTO: 'Apto',
  MAL_CONDICIONADO: 'Mal condicionado',
  DOENTE: 'Doente',
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

function tableHeader() {
  return (
    <TableHeader>
      <TableRow className="bg-muted-subtle hover:bg-muted-subtle">
        <TableHead className="pl-4 text-muted-foreground">Jogador</TableHead>
        <TableHead className="text-muted-foreground">Posição</TableHead>
        <TableHead className="text-right text-muted-foreground">
          Overall
        </TableHead>
        <TableHead className="text-muted-foreground">Agilidade</TableHead>
        <TableHead className="text-right text-muted-foreground">
          Idade
        </TableHead>
        <TableHead className="text-muted-foreground">Condição</TableHead>
        <TableHead className="text-right text-muted-foreground">
          Valor base
        </TableHead>
        <TableHead className="text-right text-muted-foreground">
          Valor de mercado
        </TableHead>
        <TableHead className="pr-4 text-muted-foreground">Clube</TableHead>
        <TableHead className="w-10 pr-2">
          <span className="sr-only">Ações</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

export function PlayerTable({
  players,
  clubs,
  onView,
  onEdit,
  onDelete,
}: {
  players: PlayerListItem[];
  clubs: ClubListItem[];
  onView: (player: PlayerListItem) => void;
  onEdit: (player: PlayerListItem) => void;
  onDelete: (player: PlayerListItem) => void;
}) {
  const clubById = new Map(clubs.map((club) => [club.id, club]));

  return (
    <Table aria-label="Jogadores" className="min-w-[1020px]">
      {tableHeader()}
      <TableBody>
        {players.map((player) => {
          const club =
            player.club_id === null ? undefined : clubById.get(player.club_id);
          const agilityColor =
            player.agility <= 30
              ? 'text-destructive'
              : player.agility >= 80
                ? 'text-success'
                : 'text-muted-foreground';

          return (
            <TableRow key={player.id} className="h-14">
              <TableCell className="pl-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback
                      className={cn(
                        'font-medium',
                        avatarStyles[player.id % avatarStyles.length],
                      )}
                    >
                      {initials(player.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 leading-tight">
                    <p className="font-medium text-foreground">{player.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {positionLabels[player.position]}
                    </p>
                  </div>
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
              <TableCell>
                <div className="flex items-center gap-2 tabular-nums">
                  <span className="w-6 text-right">{player.agility}</span>
                  <Progress
                    value={player.agility}
                    aria-label={`Agilidade de ${player.name}`}
                    className="h-1.5 w-10 bg-muted"
                    indicatorClassName={cn('bg-current', agilityColor)}
                  />
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {player.age}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn(
                    'gap-1 rounded-md font-normal',
                    conditionStyles[player.condition],
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-current"
                  />
                  {conditionLabels[player.condition]}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {moneyFormatter.format(player.base_value)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {moneyFormatter.format(player.market_value)}
              </TableCell>
              <TableCell className="pr-4">
                {player.club_id === null ? (
                  <Badge variant="secondary" className="font-normal">
                    Livre
                  </Badge>
                ) : club ? (
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                      {club.acronym}
                    </span>
                    <span>{club.name}</span>
                  </div>
                ) : (
                  'Clube indisponível'
                )}
              </TableCell>
              <TableCell className="w-10 pr-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Abrir ações de ${player.name}`}
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                      {player.name}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => onView(player)}>
                      <Eye aria-hidden="true" />
                      Ver detalhes
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onEdit(player)}>
                      <Pencil aria-hidden="true" />
                      Editar
                    </DropdownMenuItem>
                    {player.club_id === null && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => onDelete(player)}
                        >
                          <Trash2 aria-hidden="true" />
                          Excluir
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function PlayerTableSkeleton() {
  return (
    <Table aria-label="Carregando jogadores" className="min-w-[1020px]">
      {tableHeader()}
      <TableBody>
        {Array.from({ length: 10 }, (_, index) => (
          <TableRow key={index} className="h-14">
            <TableCell className="pl-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>
            </TableCell>
            {Array.from({ length: 8 }, (_, cell) => (
              <TableCell key={cell}>
                <Skeleton className="h-4 w-12" />
              </TableCell>
            ))}
            <TableCell>
              <Skeleton className="size-8 rounded-md" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
