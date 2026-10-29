// app/_shared/components/auditely/collapseAll/collapseAll.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { ChevronsDownUpIcon } from '@/app/_shared/components/ui/icons/icons';

/**
 * "Collapse all" for a list of business cards: each press changes `signal`,
 * which every card in the list is given as `collapseSignal` and closes on.
 */
export function useCollapseAll() {
  const [signal, setSignal] = useState(0);
  return { signal, collapseAll: () => setSignal((n) => n + 1) };
}

/** `count` is how many cards the list shows: one card has nothing to collapse all of */
export function CollapseAllButton({ count, onClick }: { count: number; onClick: () => void }) {
  if (count < 2) return null;
  return (
    <Button variant="ghost" size="sm" onClick={onClick} leftIcon={<ChevronsDownUpIcon size={14} />} className="shrink-0 whitespace-nowrap">
      Collapse all
    </Button>
  );
}
