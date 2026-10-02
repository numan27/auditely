// app/_shared/components/auditely/bulkAuditControl/bulkAuditControl.tsx

'use client';

import { Button } from '@/app/_shared/components/ui/button/button';
import { Spinner } from '@/app/_shared/components/ui/spinner/spinner';
import { GaugeIcon } from '@/app/_shared/components/ui/icons/icons';
import type { BulkProgress } from '@/app/_shared/lib/hooks/useBulkAudit';

interface BulkAuditControlProps {
  /** Businesses in the current view still to audit */
  pending: number;
  progress: BulkProgress | null;
  onStart: () => void;
  onStop: () => void;
}

/** "Audit all" for the results in view: the button, then progress with Stop, then the outcome */
export function BulkAuditControl({ pending, progress, onStart, onStop }: BulkAuditControlProps) {
  if (progress?.isRunning) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]" role="status">
        <Spinner size="sm" />
        <span className="tabular-nums">
          Audited {progress.finished} of {progress.total}
          {progress.failed > 0 && <span className="text-red-600 dark:text-red-400"> · {progress.failed} failed</span>}
        </span>
        <Button variant="outline" size="sm" onClick={onStop} disabled={progress.isStopping}>
          {progress.isStopping ? 'Stopping…' : 'Stop'}
        </Button>
      </div>
    );
  }

  const audited = progress ? progress.finished - progress.failed : 0;
  return (
    <div className="flex items-center gap-2">
      {progress && (
        <span className="text-xs tabular-nums text-[var(--color-text-tertiary)]" role="status">
          {audited} audited
          {progress.failed > 0 && <span className="text-red-600 dark:text-red-400"> · {progress.failed} failed</span>}
        </span>
      )}
      {pending > 0 && (
        <Button variant="primary" size="sm" onClick={onStart} leftIcon={<GaugeIcon size={14} />}>
          Audit all <span className="tabular-nums opacity-80">{pending}</span>
        </Button>
      )}
    </div>
  );
}
