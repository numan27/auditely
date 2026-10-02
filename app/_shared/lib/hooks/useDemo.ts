// app/_shared/lib/hooks/useDemo.ts

'use client';

import { createContext, useContext } from 'react';
import type { DemoLinks } from '@/app/_shared/lib/demo/demoLinks';
import type { DemoData } from '@/app/_shared/lib/demo/demoSamples';
import type { Post } from '@/app/_shared/lib/utils/bulkAudit';

/** What the demo doesn't run: each opens the notice instead */
export type DemoAction = 'search' | 'auditUrl' | 'reaudit' | 'findEmail' | 'sendEmail' | 'crm' | 'export';

export interface Demo {
  data: DemoData;
  links: DemoLinks;
  /** Answers audit and summary requests from the saved sample (see demo/replay.ts) */
  replay: Post;
  /** Opens the notice for an action the demo doesn't run */
  restrict: (action: DemoAction) => void;
}

export const DemoContext = createContext<Demo | null>(null);

/**
 * The public demo's sample data and stand-ins, or null in the real app.
 * Anything that would call the API asks this first.
 */
export const useDemo = (): Demo | null => useContext(DemoContext);
