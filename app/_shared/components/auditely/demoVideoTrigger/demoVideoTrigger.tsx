// app/_shared/components/auditely/demoVideoTrigger/demoVideoTrigger.tsx

'use client';

import type { ReactNode } from 'react';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';

interface DemoVideoTriggerProps {
  className?: string;
  children: ReactNode;
}

/**
 * Whatever is inside it starts the demo's recorded walkthrough: in the player
 * over the page for a Loom video, in a new tab for any other link.
 * Nothing without a walkthrough, and nothing in the real app.
 */
export function DemoVideoTrigger({ className, children }: DemoVideoTriggerProps) {
  const demo = useDemo();
  if (!demo?.links.videoUrl) return null;

  if (demo.links.videoPlayerUrl) {
    return (
      <button type="button" onClick={demo.playVideo} className={className}>
        {children}
      </button>
    );
  }
  return (
    <a href={demo.links.videoUrl} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
