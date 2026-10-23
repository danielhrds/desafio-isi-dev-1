import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle, Shield, WalletCards } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { ErrorAlert } from '@/components/error-alert';
import { FormInput } from '@/components/form-input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateClub } from '@/hooks/use-clubs';
import { apiErrorMessage } from '@/lib/api-error';
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
      setServerError(apiErrorMessage(error));
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
            <ErrorAlert
              title="Não foi possível criar o clube"
              message={serverError}
            />
          )}

          <FormInput
            id="create-club-name"
            label="Nome"
            icon={Shield}
            autoComplete="organization"
            error={errors.name?.message}
            help="De 3 a 60 caracteres e de 2 a 5 palavras; só letras, espaços, hífen e ponto. Não pode repetir outro clube."
            {...register('name')}
          />

          <FormInput
            id="create-club-acronym"
            label="Sigla"
            autoCapitalize="characters"
            maxLength={3}
            error={errors.acronym?.message}
            help="3 letras de A a Z, maiúsculas, que aparecem no nome nessa ordem; a primeira é a primeira letra do nome."
            {...register('acronym')}
          />

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
