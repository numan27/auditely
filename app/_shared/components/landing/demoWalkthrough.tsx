'use client';

// app/_shared/components/landing/demoWalkthrough.tsx

// The demo section's recorded walkthrough (DEMO_VIDEO_URL). A Loom video plays
// right here: its player loads only once the visitor presses play. Any other
// link opens in a new tab.

import { useState } from 'react';
import { ExternalLinkIcon, PlayIcon } from '@/app/_shared/components/ui/icons/icons';
import motion from '@/app/_shared/components/landing/landingMotion.module.scss';

export interface WalkthroughLinks {
  url: string;
  /** Loom's player for the link; null for anything else */
  playerUrl: string | null;
}

const frame = 'relative mt-9 aspect-video overflow-hidden rounded-[20px] border border-[#1a2136] bg-[#0f1424]';
const playClasses =
  'grid h-[76px] w-[76px] place-items-center rounded-full bg-white text-[#2f4fe0] shadow-[0_10px_40px_rgba(112,137,255,.45)] transition-transform group-hover:scale-105 min-[601px]:h-[88px] min-[601px]:w-[88px]';

function Poster({ note }: { note: string }) {
  return (
    <>
      <span className={motion.dotsInk} aria-hidden />
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <span className={playClasses} aria-hidden>
          <PlayIcon size={28} />
        </span>
        <span className="font-display text-2xl font-semibold tracking-tight text-white min-[601px]:text-[32px]">Auditely in 45 seconds</span>
        <span className="max-w-[460px] text-[15px] text-[#b9c1d6] min-[601px]:text-base">{note}</span>
      </span>
    </>
  );
}

export function DemoWalkthrough({ video }: { video: WalkthroughLinks }) {
  const [playing, setPlaying] = useState(false);

  if (!video.playerUrl) {
    return (
      <a href={video.url} target="_blank" rel="noopener noreferrer" className={`group block ${frame}`}>
        <Poster note="A search, an audit and a report, start to finish." />
        <span className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 text-sm text-[#b9c1d6]">
          Opens in a new tab <ExternalLinkIcon size={14} />
        </span>
      </a>
    );
  }

  if (playing) {
    return (
      <div className={frame}>
        <iframe
          src={video.playerUrl}
          title="Auditely walkthrough video"
          allow="autoplay; fullscreen; picture-in-picture"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setPlaying(true)} aria-label="Play the walkthrough" className={`group block w-full cursor-pointer ${frame}`}>
      <Poster note="A search, an audit and a report, start to finish. It plays right here." />
    </button>
  );
}
