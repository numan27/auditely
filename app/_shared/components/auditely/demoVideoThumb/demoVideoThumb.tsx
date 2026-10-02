// app/_shared/components/auditely/demoVideoThumb/demoVideoThumb.tsx

'use client';

import { DemoVideoTrigger } from '@/app/_shared/components/auditely/demoVideoTrigger/demoVideoTrigger';
import { PlayIcon } from '@/app/_shared/components/ui/icons/icons';

// A sketch of a lead card with its score, until there is a frame of the recording to show
const ROWS = ['w-3/5', 'w-2/5', 'w-1/2'];

/** The walkthrough's thumbnail beside the heading: a small row on a phone or tablet, a tile on a wider screen */
export function DemoVideoThumb() {
  return (
    <DemoVideoTrigger className="group flex shrink-0 cursor-pointer items-center gap-3 rounded-xl text-left lg:block lg:w-56">
      <span className="relative block aspect-video w-28 shrink-0 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] transition-colors group-hover:border-[var(--color-border-hover)] lg:w-full">
        <span aria-hidden className="absolute inset-0 flex flex-col justify-center gap-[9%] px-[9%] opacity-70">
          {ROWS.map((width) => (
            <span key={width} className="flex items-center gap-[6%]">
              <span className="aspect-square w-[11%] rounded-full bg-[var(--color-primary-200)]" />
              <span className={`h-1 rounded-full bg-[var(--color-bg-tertiary)] lg:h-1.5 ${width}`} />
            </span>
          ))}
        </span>
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-8 place-items-center rounded-full bg-[var(--color-primary-600)] text-white shadow-[var(--shadow-md)] transition-transform group-hover:scale-105 lg:size-11">
            <PlayIcon className="size-3.5 lg:size-[18px]" />
          </span>
        </span>
      </span>
      <span className="block lg:mt-2">
        <span className="block text-sm font-medium text-[var(--color-text-primary)]">Watch a live search and audit</span>
        <span className="block text-xs text-[var(--color-text-tertiary)]">45-second walkthrough</span>
      </span>
    </DemoVideoTrigger>
  );
}
