import { useState } from 'react';
import { CheckCircle2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PlayerDetail, PlayerPosition } from '@/types/player';

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

export function PlayerCreatedDialog({
  player,
  onClose,
}: {
  player: PlayerDetail;
  onClose: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[540px]">
        <DialogHeader className="gap-3 pr-7 text-left">
          <div className="flex size-9 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckCircle2 aria-hidden="true" className="size-5" />
          </div>
          <DialogTitle>Jogador cadastrado</DialogTitle>
          <DialogDescription>
            {player.name} entrou livre e Apto. Valores em moedas, calculados
            pela API ao salvar.
          </DialogDescription>
        </DialogHeader>

        <dl className="overflow-hidden rounded-lg border text-sm">
          <div className="flex items-center justify-between gap-3 bg-muted/40 px-3 py-3">
            <div>
              <dt className="font-semibold">Valor base</dt>
              <p className="text-xs text-muted-foreground">
                Calculado no cadastro; não muda depois
              </p>
            </div>
            <dd className="font-semibold tabular-nums">
              {moneyFormatter.format(player.base_value)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-t px-3 py-3">
            <div>
              <dt className="text-muted-foreground">Valor de mercado</dt>
              <p className="text-xs text-muted-foreground">
                Com condição, agilidade e idade
              </p>
            </div>
            <dd className="font-medium tabular-nums">
              {moneyFormatter.format(player.market_value)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-t px-3 py-3">
            <div>
              <dt className="text-muted-foreground">Overall</dt>
              <p className="text-xs text-muted-foreground">
                Pelos pesos da posição {positionLabels[player.position]}
              </p>
            </div>
            <dd className="font-medium tabular-nums">{player.overall}</dd>
          </div>
        </dl>

        {showDetails && (
          <div className="rounded-lg border p-3 text-sm">
            <h3 className="font-semibold">Dados do jogador</h3>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {(
                [
                  ['Posição', positionLabels[player.position]],
                  ['Idade', player.age],
                  ['Agilidade', player.agility],
                  ['Velocidade', player.pace],
                  ['Finalização', player.shooting],
                  ['Passe', player.passing],
                  ['Drible', player.dribbling],
                  ['Defesa', player.defending],
                  ['Físico', player.physical],
                  ['Potencial', player.potential],
                  ['Condição', 'Apto'],
                  ['Clube', 'Livre'],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowDetails((value) => !value)}
          >
            <Eye aria-hidden="true" />
            {showDetails ? 'Ocultar detalhes' : 'Ver detalhes'}
          </Button>
          <Button type="button" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
