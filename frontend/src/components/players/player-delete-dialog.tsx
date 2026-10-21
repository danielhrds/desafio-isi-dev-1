import { useState } from 'react';
import axios from 'axios';
import { LoaderCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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
import type { PlayerListItem } from '@/types/player';
import { useDeletePlayer } from '@/hooks/use-players';

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? 'Tente novamente em instantes.';
  }
  return 'Tente novamente em instantes.';
}

export function PlayerDeleteDialog({
  player,
  onClose,
  onDeleted,
}: {
  player: PlayerListItem;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const deletion = useDeletePlayer();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function confirmDelete() {
    setErrorMessage(null);
    try {
      await deletion.mutateAsync(player.id);
      toast.success('Jogador excluído', {
        description: `${player.name} não aparecerá mais na lista.`,
      });
      onDeleted();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !deletion.isPending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader className="gap-2 pr-7 text-left">
          <div className="flex size-9 items-center justify-center rounded-full bg-destructive-soft text-destructive">
            <Trash2 aria-hidden="true" className="size-5" />
          </div>
          <DialogTitle>Excluir jogador?</DialogTitle>
          <DialogDescription>
            {player.name} deixará de aparecer na lista. Esta ação não pode ser
            desfeita pela interface.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível excluir o jogador</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={deletion.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void confirmDelete()}
            disabled={deletion.isPending}
          >
            {deletion.isPending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" />
            )}
            {deletion.isPending ? 'Excluindo...' : 'Excluir jogador'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
