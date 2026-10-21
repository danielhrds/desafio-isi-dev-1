import { Link } from 'react-router-dom';
import { LoaderCircle, SearchX, ServerOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from './match-formatters';

export function MatchHistorySkeleton() {
  return (
    <Card className="overflow-hidden py-0 shadow-xs">
      <CardHeader className="border-b px-4 py-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {Array.from({ length: 4 }, (_, row) => (
          <div key={row} className="flex items-center gap-4">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-5 flex-1" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function MatchHistoryError({
  error,
  onRetry,
  title = 'Não foi possível carregar as partidas',
}: {
  error: unknown;
  onRetry: () => void;
  title?: string;
}) {
  return (
    <Alert
      variant="destructive"
      className="flex min-h-64 flex-col items-center justify-center gap-2 text-center"
    >
      <ServerOff aria-hidden="true" />
      <AlertTitle className="text-base">{title}</AlertTitle>
      <AlertDescription className="block max-w-sm">
        {errorMessage(error)}
      </AlertDescription>
      <Button
        type="button"
        variant="outline"
        className="mt-2"
        onClick={onRetry}
      >
        Tentar novamente
      </Button>
    </Alert>
  );
}

export function MatchHistoryEmpty({
  onCreateMatch,
}: {
  onCreateMatch: () => void;
}) {
  return (
    <Card className="min-h-64 items-center justify-center gap-3 px-5 py-10 text-center shadow-xs">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <SearchX aria-hidden="true" className="size-5" />
      </div>
      <div className="space-y-1.5">
        <CardTitle className="text-base">Nenhuma partida jogada</CardTitle>
        <CardDescription className="mx-auto max-w-sm">
          Escale os titulares de dois clubes para acompanhar o histórico de
          partidas aqui.
        </CardDescription>
      </div>
      <Button type="button" variant="outline" onClick={onCreateMatch}>
        Nova partida
      </Button>
    </Card>
  );
}

export function MatchHistoryLoadingLabel() {
  return (
    <div
      className="mb-3 flex h-10 items-center gap-2 px-4 text-sm text-muted-foreground"
      role="status"
      aria-label="Carregando partidas"
    >
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      Carregando partidas...
    </div>
  );
}

export function InvalidMatchId({ message }: { message: string }) {
  return (
    <Card className="min-h-64 items-center justify-center gap-4 px-6 py-10 text-center shadow-xs">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <SearchX aria-hidden="true" className="size-5" />
      </div>
      <div className="space-y-2">
        <CardTitle className="text-base">Partida não encontrada</CardTitle>
        <CardDescription>{message}</CardDescription>
      </div>
      <Button variant="outline" asChild>
        <Link to="/partidas">Voltar para partidas</Link>
      </Button>
    </Card>
  );
}
