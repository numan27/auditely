// app/_shared/lib/demo/walkthrough.ts

// The landing page's walkthrough. The recording ships with the site (public/media)
// and plays in place, muted until the visitor turns the sound on; its phone
// numbers, email addresses and sign-off are blurred. A link (DEMO_VIDEO_URL) is
// the other shape the demo section knows: Loom's player, or a new tab.

import { MEDIA_FILES } from '@/app/_shared/lib/config/routes';

export interface WalkthroughChapter {
  /** Where it starts in the recording, in seconds */
  at: number;
  title: string;
  detail: string;
}

export type Walkthrough =
  | { kind: 'file'; src: string; poster: string; chapters: WalkthroughChapter[] }
  | { kind: 'link'; url: string; playerUrl: string | null };

export const RECORDED_WALKTHROUGH: Walkthrough = {
  kind: 'file',
  src: MEDIA_FILES.WALKTHROUGH,
  poster: MEDIA_FILES.WALKTHROUGH_POSTER,
  chapters: [
    { at: 0, title: 'Search', detail: 'A business type and a city: private schools in Houston.' },
    { at: 16, title: 'Leads', detail: 'Every business found, with its website, phone and rating.' },
    { at: 28, title: 'Audit', detail: 'One site checked: six scores and the biggest issues.' },
    { at: 40, title: 'First email', detail: 'A plain-English summary, what to fix first, and the email to send.' },
    { at: 50, title: 'Any website', detail: 'Paste one address to audit a single site.' },
  ],
};

/** 27 → "0:27": a time as a video player shows it */
export function clockOf(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
