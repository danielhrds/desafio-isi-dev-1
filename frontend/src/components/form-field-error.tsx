import { CircleAlert } from 'lucide-react';

export function FieldError({ id, message }: { id: string; message?: string }) {
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
