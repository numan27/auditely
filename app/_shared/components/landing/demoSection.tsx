'use client';

// app/_shared/components/landing/demoSection.tsx

// "01 · Live demo": the walkthrough first, when there is one, and the demo's real
// sample search a tab away. The search ranks every lead weakest site first;
// picking one shows its scores, what Auditely wrote and its PDF. The hero's
// "Watch the demo" link (WALKTHROUGH_HASH) brings back the walkthrough and starts
// it over with the sound on.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import buttonStyles from '@/app/_shared/components/ui/button/button.module.scss';
import { PlayIcon, SearchIcon, StarIcon } from '@/app/_shared/components/ui/icons/icons';
import { ScoreRing, TONE_CHIP, toneOf } from '@/app/_shared/components/landing/scoreRing';
import { DemoWalkthrough } from '@/app/_shared/components/landing/demoWalkthrough';
import {
  WALKTHROUGH_HASH,
  cardClasses,
  eyebrowClasses,
  headingClasses,
  sectionClasses,
  subClasses,
  wrapClasses,
} from '@/app/_shared/components/landing/landingStyles';
import type { LandingLead } from '@/app/_shared/lib/demo/landingDemo';
import type { Walkthrough } from '@/app/_shared/lib/demo/walkthrough';
import { ROUTES } from '@/app/_shared/lib/config/routes';

type Tab = 'search' | 'video';

const segClasses = (on: boolean) =>
  `inline-flex h-10 items-center gap-2 rounded-[10px] px-4 text-sm font-semibold transition-colors ${
    on ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
  }`;
const ghost = [buttonStyles.button, buttonStyles['button--outline'], 'min-h-11 px-4 text-[15px]'].join(' ');
const primary = [buttonStyles.button, buttonStyles['button--primary'], 'min-h-11 px-4 text-[15px]'].join(' ');
const ROW = 'grid grid-cols-[24px_minmax(0,1fr)_92px] items-center gap-3 px-4 min-[641px]:grid-cols-[28px_minmax(0,1fr)_96px_132px_112px] min-[641px]:gap-3.5';

function SearchBar({ search, total }: { search: { niche: string; location: string }; total: number }) {
  const field = (label: string, value: string) => (
    <div className="min-w-[160px] flex-1">
      <p className="text-[13px] font-semibold text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1.5 flex h-12 items-center rounded-xl border border-[var(--color-border-hover)] px-3.5 text-base text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
  return (
    <div className={`${cardClasses} flex flex-wrap items-end gap-3 p-4`}>
      {field('Business type', search.niche)}
      {field('City', search.location)}
      <div className="flex flex-wrap items-center gap-3.5">
        <p className="text-sm text-[var(--color-text-secondary)]">
          <strong className="text-[var(--color-text-primary)]">{total}</strong> found · <strong className="text-[var(--color-text-primary)]">{total}</strong> audited
        </p>
        <Link href={ROUTES.DEMO} className={`${ghost} min-h-12`}>
          Open the full demo
        </Link>
      </div>
    </div>
  );
}

function LeadRow({ lead, on, onPick }: { lead: LandingLead; on: boolean; onPick: () => void }) {
  return (
    <li className="border-t border-[var(--color-border)]">
      <button
        type="button"
        aria-pressed={on}
        aria-controls="demo-lead"
        onClick={onPick}
        className={`${ROW} min-h-14 w-full py-3 text-left transition-colors ${on ? 'bg-[var(--color-primary-50)] dark:bg-[var(--color-primary-600)]/15' : 'hover:bg-[var(--color-bg-secondary)]'}`}
      >
        <span className="font-mono text-[13px] text-[var(--color-text-secondary)]">{lead.rank}</span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-[var(--color-text-primary)]">{lead.name}</span>
          <span className="block truncate font-mono text-xs text-[var(--color-text-secondary)]">{lead.host}</span>
        </span>
        <span className="hidden items-center gap-1 text-sm text-[var(--color-text-primary)] min-[641px]:flex">
          {lead.rating !== null && (
            <>
              <StarIcon size={13} className="fill-amber-400 text-amber-400" />
              {lead.rating}
              <span className="text-xs text-[var(--color-text-secondary)]">({lead.reviews?.toLocaleString('en-US')})</span>
            </>
          )}
        </span>
        <span className="hidden min-[641px]:block">
          {lead.weakest && (
            <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CHIP[toneOf(lead.weakest.score)]}`}>
              {lead.weakest.label} {lead.weakest.score}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2.5">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-border)]" aria-hidden>
            <span className="block h-full rounded-full bg-[var(--color-primary-600)]" style={{ width: `${lead.average ?? 0}%` }} />
          </span>
          <span className="w-6 text-right text-sm font-bold tabular-nums text-[var(--color-text-primary)]">{lead.average ?? '—'}</span>
        </span>
      </button>
    </li>
  );
}

function LeadDetail({ lead, total }: { lead: LandingLead; total: number }) {
  return (
    <aside id="demo-lead" aria-label={lead.name} className={`${cardClasses} p-6`}>
      <p className={eyebrowClasses}>
        #{lead.rank} of {total}, weakest first
      </p>
      <h3 className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-tight text-[var(--color-text-primary)]">{lead.name}</h3>
      <p className="mt-1 font-mono text-[13px] text-[var(--color-text-secondary)]">{lead.host}</p>
      <ul className="mt-5 grid grid-cols-2 gap-2">
        {lead.scores.map((s) => (
          <li key={s.label} className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] p-2">
            <ScoreRing score={s.score} size={34} />
            <span className="min-w-0 text-xs font-semibold leading-snug text-[var(--color-text-primary)]">{s.label}</span>
          </li>
        ))}
      </ul>
      <h4 className="mt-5 text-sm font-semibold text-[var(--color-text-primary)]">What Auditely wrote</h4>
      <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--color-text-primary)]">{lead.summary}</p>
      <p className="mt-4 rounded-xl bg-[var(--color-bg-secondary)] px-3.5 py-3 text-sm text-[var(--color-text-secondary)]">
        First email: <strong className="text-[var(--color-text-primary)]">{lead.subject}</strong>
      </p>
      <a href={lead.reportUrl} className={`${primary} mt-5`}>
        Download the report
      </a>
    </aside>
  );
}

interface DemoSectionProps {
  leads: LandingLead[];
  search: { niche: string; location: string };
  video: Walkthrough | null;
}

export function DemoSection({ leads, search, video }: DemoSectionProps) {
  const [picked, setPicked] = useState<Tab | null>(null);
  const [selected, setSelected] = useState(0);
  // How many times the hero's link has asked for the walkthrough
  const [soundAsk, setSoundAsk] = useState(0);
  const tab: Tab = video ? (picked ?? 'video') : 'search';
  const lead = leads[selected] ?? leads[0];

  // "Watch the demo" brings back the walkthrough, even after a tab was picked, and
  // starts it over with sound; the address then reads #demo, so the next press is heard too
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash !== WALKTHROUGH_HASH) return;
      setPicked('video');
      setSoundAsk((n) => n + 1);
      window.history.replaceState(null, '', '#demo');
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const pick = (next: Tab) => {
    setPicked(next);
    // So the hero's link changes the address again, and is heard, next time
    if (window.location.hash === WALKTHROUGH_HASH) window.history.replaceState(null, '', '#demo');
  };

  return (
    <section id="demo" className={`relative scroll-mt-[72px] bg-[var(--color-bg-primary)] ${sectionClasses}`}>
      {/* Where the hero's "Watch the demo" link lands; the tab follows the address */}
      {video && <span id="demo-video" className="absolute top-0 block scroll-mt-[72px]" aria-hidden />}
      <div className={wrapClasses}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className={eyebrowClasses}>01 · Live demo</p>
            <h2 className={headingClasses}>A real search, start to finish.</h2>
            {tab === 'video' ? (
              <p className={subClasses}>
                A search, an audit and the first email, start to finish, in about a minute. Turn the sound on to hear how it
                works, or open the sample search to try it yourself.
              </p>
            ) : (
              <p className={subClasses}>
                A search for “{search.niche.toLowerCase()}” in {search.location}: {leads.length} businesses found, every website
                audited, weakest site first. Pick one to see what Auditely wrote.
              </p>
            )}
          </div>
          {video && (
            <div role="group" aria-label="Demo" className="inline-flex gap-1 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-1">
              <button type="button" aria-pressed={tab === 'video'} onClick={() => pick('video')} className={segClasses(tab === 'video')}>
                <PlayIcon size={16} />
                Walkthrough · 1 min
              </button>
              <button type="button" aria-pressed={tab === 'search'} onClick={() => pick('search')} className={segClasses(tab === 'search')}>
                <SearchIcon size={16} />
                Sample search
              </button>
            </div>
          )}
        </div>

        {tab === 'video' && video ? (
          <DemoWalkthrough video={video} soundAsk={soundAsk} />
        ) : (
          <div className="mt-9">
            <SearchBar search={search} total={leads.length} />
            <div className="mt-5 grid items-start gap-5 min-[1061px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <figure className="m-0">
                <div className={`${cardClasses} overflow-hidden`}>
                  <div className={`${ROW} hidden py-3.5 font-mono text-xs text-[var(--color-text-secondary)] min-[641px]:grid`} aria-hidden>
                    <span>#</span>
                    <span>Business</span>
                    <span>Rating</span>
                    <span>Weakest check</span>
                    <span>Average</span>
                  </div>
                  <ol aria-label={`${search.niche} in ${search.location}, weakest site first`}>
                    {leads.map((l, i) => (
                      <LeadRow key={l.id} lead={l} on={l.id === lead.id} onPick={() => setSelected(i)} />
                    ))}
                  </ol>
                </div>
                <figcaption className="mt-3 text-sm text-[var(--color-text-tertiary)]">Business data from Google Maps</figcaption>
              </figure>
              <LeadDetail lead={lead} total={leads.length} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
