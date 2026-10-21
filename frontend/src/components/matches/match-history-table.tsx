import { Link } from 'react-router-dom';
import { ChevronRight, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ClubListItem } from '@/types/club';
import type { MatchSummary } from '@/types/match';
import {
  errorMessage,
  formatMatchDateTime,
  resultLabels,
} from './match-formatters';

function acronymForClub(clubs: ClubListItem[], clubId: number): string | null {
  return clubs.find((club) => club.id === clubId)?.acronym ?? null;
}

function ClubCell({
  clubId,
  clubName,
  clubs,
}: {
  clubId: number;
  clubName: string;
  clubs: ClubListItem[];
}) {
  const acronym = acronymForClub(clubs, clubId);

  return (
    <div className="flex items-center gap-2">
      {acronym && (
        <Badge
          variant="secondary"
          className="rounded-md px-1.5 py-0 text-[11px]"
        >
          {acronym}
        </Badge>
      )}
      <span className="font-medium">{clubName}</span>
    </div>
  );
}

export function MatchHistoryTable({
  matches,
  clubs,
  selectedClub,
  onClubChange,
  clubsLoading = false,
  clubsError,
  onRetryClubs,
}: {
  matches: MatchSummary[];
  clubs: ClubListItem[];
  selectedClub: string;
  onClubChange: (value: string) => void;
  clubsLoading?: boolean;
  clubsError?: unknown;
  onRetryClubs?: () => void;
}) {
  return (
    <Card className="min-w-0 gap-0 overflow-hidden py-0 shadow-xs">
      <CardHeader className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">Histórico de partidas</CardTitle>
          <CardDescription>Da mais recente para a mais antiga.</CardDescription>
        </div>
        <Select
          value={selectedClub}
          onValueChange={onClubChange}
          disabled={clubsLoading || Boolean(clubsError)}
        >
          <SelectTrigger
            className="w-full sm:w-56"
            aria-label="Filtrar partidas por clube"
          >
            <Shield aria-hidden="true" />
            <SelectValue placeholder="Clube: todos" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all">Clube: todos</SelectItem>
            {clubs.map((club) => (
              <SelectItem key={club.id} value={String(club.id)}>
                {club.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      {clubsError != null && (
        <Alert variant="destructive" className="mx-4 mb-3">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{errorMessage(clubsError)}</span>
            {onRetryClubs && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRetryClubs}
              >
                Tentar novamente
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {matches.length === 0 ? (
        <CardContent className="flex min-h-32 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Não há partidas para o clube selecionado.
          </p>
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            onClick={() => onClubChange('all')}
          >
            Limpar filtro
          </Button>
        </CardContent>
      ) : (
        <>
          <Table className="min-w-[900px]" aria-label="Histórico de partidas">
            <TableHeader>
              <TableRow className="bg-muted-subtle hover:bg-muted-subtle">
                <TableHead className="pl-4 text-muted-foreground">
                  Data e hora
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Mandante
                </TableHead>
                <TableHead className="text-center text-muted-foreground">
                  Placar
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Visitante
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Resultado
                </TableHead>
                <TableHead className="w-36 pr-4 text-right">
                  <span className="sr-only">Detalhes</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((match) => (
                <TableRow key={match.id}>
                  <TableCell className="pl-4 tabular-nums">
                    <time dateTime={match.played_at}>
                      {formatMatchDateTime(match.played_at)}
                    </time>
                  </TableCell>
                  <TableCell>
                    <ClubCell
                      clubId={match.home.club_id}
                      clubName={match.home.club_name}
                      clubs={clubs}
                    />
                  </TableCell>
                  <TableCell className="text-center font-semibold tabular-nums">
                    {match.home.goals} × {match.away.goals}
                  </TableCell>
                  <TableCell>
                    <ClubCell
                      clubId={match.away.club_id}
                      clubName={match.away.club_name}
                      clubs={clubs}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {resultLabels[match.result]}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/partidas/${match.id}`}>
                        Ver duelos
                        <ChevronRight aria-hidden="true" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t px-4 py-3 text-sm text-muted-foreground">
            {new Intl.NumberFormat('pt-BR').format(matches.length)}{' '}
            {matches.length === 1 ? 'partida' : 'partidas'}
          </div>
        </>
      )}
    </Card>
  );
}
