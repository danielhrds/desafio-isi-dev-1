import type { ComponentProps, ReactNode } from 'react';
import { CircleAlert, type LucideIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ErrorAlertProps extends Omit<
  ComponentProps<typeof Alert>,
  'title' | 'children' | 'variant'
> {
  title: ReactNode;
  message: ReactNode;
  icon?: LucideIcon | null;
  leading?: ReactNode;
  titleClassName?: string;
  descriptionClassName?: string;
  groupContent?: boolean;
  onRetry?: () => void;
}

export function ErrorAlert({
  title,
  message,
  icon: Icon = CircleAlert,
  leading,
  titleClassName,
  descriptionClassName,
  groupContent = false,
  onRetry,
  ...props
}: ErrorAlertProps) {
  const content = (
    <>
      <AlertTitle className={titleClassName}>{title}</AlertTitle>
      <AlertDescription className={descriptionClassName}>
        {message}
      </AlertDescription>
    </>
  );
  return (
    <Alert variant="destructive" {...props}>
      {leading ?? (Icon && <Icon aria-hidden="true" />)}
      {groupContent ? <div>{content}</div> : content}
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          className="mt-2"
          onClick={onRetry}
        >
          Tentar novamente
        </Button>
      )}
    </Alert>
  );
}
