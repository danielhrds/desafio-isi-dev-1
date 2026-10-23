import { FieldError } from '@/components/form-field-error';
import { Button } from '@/components/ui/button';
import type { PlayerPosition } from '@/types/player';

const positions: Array<{ value: PlayerPosition; label: string }> = [
  { value: 'GOL', label: 'Goleiro' },
  { value: 'ZAG', label: 'Zagueiro' },
  { value: 'LAT', label: 'Lateral' },
  { value: 'MEI', label: 'Meio-campo' },
  { value: 'ATA', label: 'Atacante' },
];

export function PlayerPositionField({
  idPrefix,
  value,
  onChange,
  error,
  disabled = false,
  lockedPosition,
}: {
  idPrefix: string;
  value?: PlayerPosition;
  onChange: (position: PlayerPosition) => void;
  error?: string;
  disabled?: boolean;
  lockedPosition?: PlayerPosition;
}) {
  return (
    <div className="space-y-2">
      <p id={`${idPrefix}-position-label`} className="text-sm font-medium">
        Posição
      </p>
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-5"
        role="group"
        aria-labelledby={`${idPrefix}-position-label`}
        aria-invalid={!!error}
        aria-describedby={
          error
            ? `${idPrefix}-position-error`
            : lockedPosition
              ? `${idPrefix}-position-help`
              : undefined
        }
      >
        {positions.map((position) => (
          <Button
            key={position.value}
            type="button"
            variant="outline"
            aria-pressed={value === position.value}
            disabled={
              disabled ||
              (!!lockedPosition && position.value !== lockedPosition)
            }
            onClick={() => onChange(position.value)}
            className="group h-14 min-w-0 flex-col gap-0.5 border-border font-semibold aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary"
          >
            {position.value}
            <span className="text-xs font-normal text-muted-foreground group-aria-pressed:text-primary">
              {position.label}
            </span>
          </Button>
        ))}
      </div>
      {error ? (
        <FieldError id={`${idPrefix}-position-error`} message={error} />
      ) : lockedPosition ? (
        <p
          id={`${idPrefix}-position-help`}
          className="text-xs text-muted-foreground"
        >
          Jogador com clube não muda de posição: as outras posições ficam
          desabilitadas.
        </p>
      ) : null}
    </div>
  );
}
