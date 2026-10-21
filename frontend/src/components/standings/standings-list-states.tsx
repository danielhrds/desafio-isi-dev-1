import { CircleAlert, ListOrdered } from 'lucide-react';
import { apiErrorMessage } from '@/lib/api-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function StandingsLoading() {
  return (
    <Card
      className="gap-0 overflow-hidden py-0 shadow-xs"
      aria-label="Carregando classificação"
    >
      <div className="flex h-10 items-center gap-5 border-b bg-muted-subtle px-4">
        <Skeleton className="h-4 w-5" />
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="ml-auto h-4 w-7" />
        ))}
      </div>
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="flex h-[52px] items-center gap-5 border-b px-4 last:border-b-0"
        >
          <Skeleton className="size-6 shrink-0" />
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 8 }, (_, cellIndex) => (
            <Skeleton key={cellIndex} className="ml-auto h-4 w-7" />
          ))}
        </div>
      ))}
      <span className="sr-only" role="status">
        Carregando classificação...
      </span>
    </Card>
  );
}

export function StandingsEmpty() {
  return (
    <Card className="min-h-64 items-center justify-center gap-3 px-5 py-10 text-center shadow-xs">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <ListOrdered aria-hidden="true" className="size-5" />
      </div>
      <div className="space-y-1.5">
        <CardTitle className="text-base">Nenhum clube cadastrado</CardTitle>
        <CardDescription className="mx-auto max-w-sm">
          A classificação mostra todos os clubes, mesmo os que ainda não
          jogaram.
        </CardDescription>
      </div>
    </Card>
  );
}

export function StandingsError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <Alert
      variant="destructive"
      className="flex min-h-64 flex-col items-center justify-center gap-2 text-center"
    >
      <CircleAlert aria-hidden="true" />
      <AlertTitle className="text-base">
        Não foi possível carregar a classificação
      </AlertTitle>
      <AlertDescription className="block max-w-sm">
        {apiErrorMessage(error)}
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
