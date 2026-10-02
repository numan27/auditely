// app/_shared/components/providers/DemoProvider.tsx

'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { DemoNoticeModal } from '@/app/_shared/components/auditely/demoNoticeModal/demoNoticeModal';
import { DemoVideoModal } from '@/app/_shared/components/auditely/demoVideoModal/demoVideoModal';
import type { DemoLinks } from '@/app/_shared/lib/demo/demoLinks';
import { allSamples, type DemoData } from '@/app/_shared/lib/demo/demoSamples';
import { replayPost } from '@/app/_shared/lib/demo/replay';
import { DemoContext, type Demo, type DemoAction } from '@/app/_shared/lib/hooks/useDemo';

interface DemoProviderProps {
  /** The saved sample, loaded on the server */
  data: DemoData;
  links: DemoLinks;
  children: ReactNode;
}

/** Puts everything inside it in demo mode: sample data, replayed audits, and a notice instead of live actions */
export function DemoProvider({ data, links, children }: DemoProviderProps) {
  const [restricted, setRestricted] = useState<DemoAction | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const demo = useMemo<Demo>(
    () => ({
      data,
      links,
      replay: replayPost(allSamples(data)),
      restrict: setRestricted,
      // The notice offers the walkthrough too: the video takes its place
      playVideo: () => {
        setRestricted(null);
        setVideoOpen(true);
      },
    }),
    [data, links]
  );

  return (
    <DemoContext.Provider value={demo}>
      {children}
      {restricted && <DemoNoticeModal action={restricted} links={links} onClose={() => setRestricted(null)} />}
      {videoOpen && links.videoPlayerUrl && (
        <DemoVideoModal playerUrl={links.videoPlayerUrl} onClose={() => setVideoOpen(false)} />
      )}
    </DemoContext.Provider>
  );
}
