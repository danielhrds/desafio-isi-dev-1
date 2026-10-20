import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { CircleAlert, LoaderCircle, Shield, WalletCards } from 'lucide-react';
import { useForm } from 'react-hook-form';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateClub } from '@/hooks/use-clubs';
import type { ClubSummary } from '@/types/club';
import {
  clubCreateSchema,
  type ClubCreateFormValues,
  type ClubCreatePayload,
} from './club-create-schema';

const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;

  return (
    <p
      id={id}
      className="mt-1.5 flex items-start gap-1 text-xs text-destructive"
    >
      <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      {message}
    </p>
  );
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return (
      error.response?.data?.message ?? 'Verifique a conexão e tente novamente.'
    );
  }

  return 'Verifique a conexão e tente novamente.';
}

export function ClubCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (club: ClubSummary) => void;
}) {
  const createClub = useCreateClub();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClubCreateFormValues, unknown, ClubCreatePayload>({
    resolver: zodResolver(clubCreateSchema),
  });
  const saving = isSubmitting || createClub.isPending;

  async function submit(payload: ClubCreatePayload) {
    setServerError(null);
    try {
      const club = await createClub.mutateAsync(payload);
      onCreated(club);
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  }

  function close() {
    if (!saving) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[480px]"
        showCloseButton={!saving}
      >
        <DialogHeader className="text-left">
          <DialogTitle>Novo clube</DialogTitle>
          <DialogDescription>
            Informe o nome e a sigla do clube.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
          {serverError && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Não foi possível criar o clube</AlertTitle>
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="create-club-name">Nome</Label>
            <div className="relative">
              <Shield
                aria-hidden="true"
                className="absolute top-2.5 left-3 size-4 text-muted-foreground"
              />
              <Input
                id="create-club-name"
                autoComplete="organization"
                maxLength={60}
                aria-invalid={!!errors.name}
                aria-describedby={
                  errors.name
                    ? 'create-club-name-error'
                    : 'create-club-name-help'
                }
                className="pl-9"
                {...register('name')}
              />
            </div>
            {errors.name ? (
              <FieldError
                id="create-club-name-error"
                message={errors.name.message}
              />
            ) : (
              <p
                id="create-club-name-help"
                className="text-xs text-muted-foreground"
              >
                De 3 a 60 caracteres e de 2 a 5 palavras; só letras, espaços,
                hífen e ponto. Não pode repetir outro clube.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-club-acronym">Sigla</Label>
            <Input
              id="create-club-acronym"
              autoCapitalize="characters"
              maxLength={3}
              aria-invalid={!!errors.acronym}
              aria-describedby={
                errors.acronym
                  ? 'create-club-acronym-error'
                  : 'create-club-acronym-help'
              }
              {...register('acronym')}
            />
            {errors.acronym ? (
              <FieldError
                id="create-club-acronym-error"
                message={errors.acronym.message}
              />
            ) : (
              <p
                id="create-club-acronym-help"
                className="text-xs text-muted-foreground"
              >
                3 letras de A a Z, maiúsculas, que aparecem no nome nessa ordem;
                a primeira é a primeira letra do nome.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-lg border bg-muted-subtle px-3 py-2.5 text-sm text-muted-foreground">
            <WalletCards aria-hidden="true" className="size-4 shrink-0" />
            <span>
              O clube começa com {moneyFormatter.format(300)} em caixa e sem
              jogadores.
            </span>
          </div>

          <DialogFooter className="border-t pt-4 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={close}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              )}
              Criar clube
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
