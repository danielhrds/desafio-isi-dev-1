import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { CircleAlert, Info, LoaderCircle, Swords } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FieldError } from '@/components/form-field-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateMatch } from '@/hooks/use-matches';
import { errorMessage } from './match-formatters';
import {
  createMatchSchema,
  emptyCreateMatchForm,
  type CreateMatchFormValues,
  type CreateMatchPayload,
} from './create-match-schema';
import type { ClubListItem } from '@/types/club';

export function CreateMatchDialog({
  open,
  onOpenChange,
  clubs,
  clubsLoading,
  clubsError,
  onRetryClubs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubs: ClubListItem[];
  clubsLoading: boolean;
  clubsError: Error | null;
  onRetryClubs: () => void;
}) {
  const navigate = useNavigate();
  const createMatch = useCreateMatch();
  const [requestError, setRequestError] = useState<string | null>(null);
  const form = useForm<CreateMatchFormValues, unknown, CreateMatchPayload>({
    resolver: zodResolver(createMatchSchema),
    defaultValues: emptyCreateMatchForm,
    mode: 'onChange',
  });
  const saving = form.formState.isSubmitting || createMatch.isPending;
  const canSelectClubs = !clubsLoading && clubs.length >= 2;

  function changeOpen(nextOpen: boolean) {
    if (saving) return;

    if (!nextOpen) {
      form.reset(emptyCreateMatchForm);
      createMatch.reset();
      setRequestError(null);
    }

    onOpenChange(nextOpen);
  }

  async function submit(payload: CreateMatchPayload) {
    setRequestError(null);

    try {
      const match = await createMatch.mutateAsync(payload);
      toast.success('Partida jogada com sucesso.');
      form.reset(emptyCreateMatchForm);
      createMatch.reset();
      setRequestError(null);
      onOpenChange(false);
      navigate(`/partidas/${match.id}`);
    } catch (error) {
      setRequestError(errorMessage(error));
    }
  }

  function clearRequestError() {
    setRequestError(null);
    createMatch.reset();
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[520px]"
        showCloseButton={!saving}
      >
        <DialogHeader className="text-left">
          <DialogTitle>Nova partida</DialogTitle>
          <DialogDescription>
            Escolha o mandante e o visitante. O placar sai dos atributos dos
            titulares, sem sorteio.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(submit)}
          noValidate
          className="space-y-4"
        >
          {requestError && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Não foi possível jogar a partida</AlertTitle>
              <AlertDescription>{requestError}</AlertDescription>
            </Alert>
          )}

          {clubsError && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Não foi possível carregar os clubes</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                {errorMessage(clubsError)}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onRetryClubs}
                >
                  Tentar novamente
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!clubsLoading && !clubsError && clubs.length < 2 && (
            <Alert>
              <Info aria-hidden="true" />
              <AlertTitle>Dois clubes são necessários</AlertTitle>
              <AlertDescription>
                Cadastre pelo menos dois clubes antes de jogar uma partida.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="create-match-home">Mandante</Label>
            <Controller
              control={form.control}
              name="homeClubId"
              render={({ field, fieldState }) => (
                <>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      clearRequestError();
                      void form.trigger();
                    }}
                    onOpenChange={(isOpen) => {
                      if (!isOpen) {
                        field.onBlur();
                        void form.trigger();
                      }
                    }}
                    disabled={!canSelectClubs || saving}
                  >
                    <SelectTrigger
                      id="create-match-home"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={
                        fieldState.error
                          ? 'create-match-home-error'
                          : 'create-match-home-help'
                      }
                      className="w-full"
                    >
                      <SelectValue
                        placeholder={
                          clubsLoading
                            ? 'Carregando clubes...'
                            : 'Selecione o mandante'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {clubs.map((club) => (
                        <SelectItem key={club.id} value={String(club.id)}>
                          {club.name} ({club.acronym})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError
                    id="create-match-home-error"
                    message={fieldState.error?.message}
                  />
                  <p
                    id="create-match-home-help"
                    className="text-xs text-muted-foreground"
                  >
                    Faz os 3 primeiros ataques.
                  </p>
                </>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-match-away">Visitante</Label>
            <Controller
              control={form.control}
              name="awayClubId"
              render={({ field, fieldState }) => (
                <>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      clearRequestError();
                      void form.trigger();
                    }}
                    onOpenChange={(isOpen) => {
                      if (!isOpen) {
                        field.onBlur();
                        void form.trigger();
                      }
                    }}
                    disabled={!canSelectClubs || saving}
                  >
                    <SelectTrigger
                      id="create-match-away"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={
                        fieldState.error
                          ? 'create-match-away-error'
                          : 'create-match-away-help'
                      }
                      className="w-full"
                    >
                      <SelectValue
                        placeholder={
                          clubsLoading
                            ? 'Carregando clubes...'
                            : 'Selecione o visitante'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {clubs.map((club) => (
                        <SelectItem key={club.id} value={String(club.id)}>
                          {club.name} ({club.acronym})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError
                    id="create-match-away-error"
                    message={fieldState.error?.message}
                  />
                  <p
                    id="create-match-away-help"
                    className="text-xs text-muted-foreground"
                  >
                    Precisa ser um clube diferente do mandante.
                  </p>
                </>
              )}
            />
          </div>

          <Card className="py-0 shadow-none">
            <CardContent className="flex items-start gap-2.5 p-3">
              <Info
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              />
              <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <h3 className="text-sm font-medium text-foreground">
                  Como sai o placar
                </h3>
                <p>
                  Cada time faz 3 ataques. Pela ordem do elenco, os jogadores de
                  linha vão do 1º (o mais recuado) ao 4º (o mais avançado): o 4º
                  enfrenta o goleiro, o 3º enfrenta o 1º e o 2º enfrenta o 2º do
                  adversário. O atacante usa finalização (ATA), passe (MEI) ou
                  drible (ZAG e LAT), e quem defende usa defesa. É gol só quando
                  o ataque é maior; mal condicionado joga com 15% a menos.
                </p>
                <p>
                  Os dois clubes precisam ter os 5 titulares escalados. A
                  partida não mexe no caixa.
                </p>
              </div>
            </CardContent>
          </Card>

          <DialogFooter className="border-t pt-4 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => changeOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !form.formState.isValid || !canSelectClubs}
            >
              {saving ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <Swords aria-hidden="true" />
              )}
              {saving ? 'Jogando partida...' : 'Jogar partida'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
