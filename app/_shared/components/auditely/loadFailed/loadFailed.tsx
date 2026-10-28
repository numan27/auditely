// app/_shared/components/auditely/loadFailed/loadFailed.tsx

// In place of a list that didn't load: what failed, why, and a way to try again.
// Never an empty list, which would look like there's nothing there.

import { Button } from '@/app/_shared/components/ui/button/button';

interface LoadFailedProps {
  title: string;
  message: string;
  onRetry: () => void;
}

export function LoadFailed({ title, message, onRetry }: LoadFailedProps) {
  return (
    <div role="alert" className="px-6 py-14 text-center">
      <p className="font-medium text-[var(--color-text-primary)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">{message}</p>
      <div className="mt-5">
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
