import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import type { LucideIcon } from 'lucide-react';
import { FieldError } from '@/components/form-field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormInputProps extends ComponentPropsWithoutRef<typeof Input> {
  id: string;
  label: ReactNode;
  error?: string;
  help?: ReactNode;
  icon?: LucideIcon;
  fieldClassName?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  function FormInput(
    { id, label, error, help, icon: Icon, fieldClassName, className, ...props },
    ref,
  ) {
    const input = (
      <Input
        {...props}
        ref={ref}
        id={id}
        className={cn(Icon && 'pl-9', className)}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${id}-error` : help ? `${id}-help` : undefined
        }
      />
    );

    return (
      <div className={cn('space-y-2', fieldClassName)}>
        <Label htmlFor={id}>{label}</Label>
        {Icon ? (
          <div className="relative">
            <Icon
              aria-hidden="true"
              className="absolute top-2.5 left-3 size-4 text-muted-foreground"
            />
            {input}
          </div>
        ) : (
          input
        )}
        {error ? (
          <FieldError id={`${id}-error`} message={error} />
        ) : help ? (
          <p id={`${id}-help`} className="text-xs text-muted-foreground">
            {help}
          </p>
        ) : null}
      </div>
    );
  },
);
