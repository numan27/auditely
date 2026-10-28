'use client';

// app/_shared/components/landing/walkthroughPlayer.tsx

// The recorded walkthrough, playing in place: muted on a loop while it's on
// screen, with buttons to pause it and turn the sound on, and chapters to jump
// to. A visitor who asks for less motion sees its first frame and a play button
// instead. The hero's "Watch the demo" link (soundAsk) starts it over with the
// sound on, when the browser allows.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PauseIcon, PlayIcon, SoundOffIcon, SoundOnIcon } from '@/app/_shared/components/ui/icons/icons';
import { clockOf, type WalkthroughChapter } from '@/app/_shared/lib/demo/walkthrough';

const REDUCED = '(prefers-reduced-motion: reduce)';
const watchMotion = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
/** Whether the visitor asks for less motion; never on the server */
const useReducedMotion = () => useSyncExternalStore(watchMotion, () => window.matchMedia(REDUCED).matches, () => false);

/** Plays from `at`, with the sound on if the browser lets it start that way */
function start(video: HTMLVideoElement, at: number, withSound: boolean) {
  video.currentTime = at;
  video.muted = !withSound;
  video.play().catch(() => {
    // Sound needs a press on the page first: carry on muted
    video.muted = true;
    video.play().catch(() => {});
  });
}

const control =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#0f1424]/75 px-3.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-[#0f1424]/90';

interface WalkthroughPlayerProps {
  src: string;
  poster: string;
  chapters: WalkthroughChapter[];
  /** Goes up each time the hero's link asks for the walkthrough */
  soundAsk: number;
}

export function WalkthroughPlayer({ src, poster, chapters, soundAsk }: WalkthroughPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  // The visitor paused it: scrolling back to it doesn't start it again
  const held = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [now, setNow] = useState(0);
  const [length, setLength] = useState(0);
  const reduced = useReducedMotion();

  // Plays while at least half of it is on screen, unless the visitor asks for less motion
  useEffect(() => {
    const video = ref.current;
    if (!video || reduced) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) video.pause();
        else if (!held.current) video.play().catch(() => {});
      },
      { threshold: 0.5 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [reduced]);

  useEffect(() => {
    if (soundAsk > 0 && ref.current) {
      held.current = false;
      start(ref.current, 0, true);
    }
  }, [soundAsk]);

  const togglePlay = () => {
    const video = ref.current;
    if (!video) return;
    held.current = !video.paused;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const toggleSound = () => {
    const video = ref.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted && video.paused) {
      held.current = false;
      video.play().catch(() => {});
    }
  };

  const jump = (at: number) => {
    const video = ref.current;
    if (!video) return;
    held.current = false;
    start(video, at, !video.muted);
  };

  const current = chapters.reduce((on, c, i) => (c.at <= now ? i : on), 0);

  return (
    <div className="mt-9 grid items-start gap-6 min-[1061px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="relative overflow-hidden rounded-[20px] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-[var(--shadow-lg)]">
        <video
          ref={ref}
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          preload="none"
          aria-label="Auditely walkthrough: a search, an audit and the first email"
          className="block aspect-[968/864] w-full"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
          onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setLength(e.currentTarget.duration)}
        />
        {reduced && !playing && now === 0 && (
          <button
            type="button"
            onClick={() => ref.current && start(ref.current, 0, true)}
            aria-label="Play the walkthrough with sound"
            className="absolute inset-0 grid place-items-center bg-[#0f1424]/25"
          >
            <span className="grid h-[76px] w-[76px] place-items-center rounded-full bg-white text-[#2f4fe0] shadow-[0_10px_40px_rgba(112,137,255,.45)]">
              <PlayIcon size={28} />
            </span>
          </button>
        )}
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3">
          <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause the walkthrough' : 'Play the walkthrough'} className={`${control} w-11 px-0`}>
            {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          </button>
          <button type="button" onClick={toggleSound} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} className={control}>
            {muted ? <SoundOffIcon size={18} /> : <SoundOnIcon size={18} />}
            {muted && <span className="hidden min-[601px]:inline">Turn sound on</span>}
          </button>
        </div>
        <span className="absolute inset-x-0 bottom-0 h-1 bg-[#0f1424]/10" aria-hidden>
          <span className="block h-full bg-[var(--color-primary-600)]" style={{ width: length ? `${Math.min(100, (now / length) * 100)}%` : 0 }} />
        </span>
      </div>

      <ol aria-label="In this walkthrough" className="grid gap-2">
        {chapters.map((c, i) => (
          <li key={c.at}>
            <button
              type="button"
              data-chapter={i}
              aria-current={i === current ? 'true' : undefined}
              onClick={() => jump(c.at)}
              className={`grid w-full grid-cols-[48px_minmax(0,1fr)] gap-x-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                i === current
                  ? 'border-[var(--color-primary-600)] bg-[var(--color-primary-50)] dark:bg-[var(--color-primary-600)]/15'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-hover)]'
              }`}
            >
              <span className="font-mono text-[13px] leading-6 text-[var(--color-text-secondary)]">{clockOf(c.at)}</span>
              <span className="text-[15px] font-semibold leading-6 text-[var(--color-text-primary)]">{c.title}</span>
              <span className="col-start-2 text-sm leading-snug text-[var(--color-text-secondary)]">{c.detail}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
