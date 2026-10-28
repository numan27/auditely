// app/_shared/components/seo/shareCard.tsx

// The share image's picture (app/opengraph-image.tsx): the landing page's
// headline and lead beside the demo sample's six scores, under its search
// rather than the business's name. Drawn by next/og, which lays out with flexbox
// only and reads no CSS variables, so the theme's colours are written out here.

import type { LandingScore } from '@/app/_shared/lib/demo/landingDemo';
import { scoreTone, type ScoreTone } from '@/app/_shared/lib/audit/reportData';

const INK = '#111726';
const MUTED = '#4b5467';
const FAINT = '#6b7489';
const BLUE = '#2f4fe0';
const LINE = '#e1e4ec';
const TRACK = '#edeff5';

const FILL: Record<ScoreTone, string> = { good: '#10b981', ok: '#f59e0b', poor: '#ef4444', none: 'transparent' };

const DISPLAY = 'Bricolage Grotesque';
const TEXT = 'Geist';

function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="7" fill={BLUE} />
      <path d="M6.5 16a5.5 5.5 0 1 1 11 0" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M12 16l3.2-4.2" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function ScoreRow({ label, score }: LandingScore) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 18 }}>
      <div style={{ display: 'flex', width: 140, fontSize: 21, color: INK }}>{label}</div>
      <div style={{ display: 'flex', flex: 1, height: 10, borderRadius: 5, background: TRACK }}>
        <div style={{ display: 'flex', width: `${score ?? 0}%`, height: 10, borderRadius: 5, background: FILL[scoreTone(score)] }} />
      </div>
      <div style={{ display: 'flex', width: 40, justifyContent: 'flex-end', fontSize: 22, fontWeight: 600, color: INK }}>
        {score ?? '—'}
      </div>
    </div>
  );
}

interface ShareCardProps {
  search: { niche: string; location: string };
  scores: LandingScore[];
  /** The address to visit, without https:// */
  site: string;
}

export function ShareCard({ search, scores, site }: ShareCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        padding: '60px 64px',
        gap: 48,
        background: '#f4f5f9',
        fontFamily: TEXT,
        color: INK,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Mark size={46} />
          <div style={{ display: 'flex', fontFamily: DISPLAY, fontSize: 38, fontWeight: 700, letterSpacing: -0.5 }}>Auditely</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* One line each: next/og can't run a coloured span on inside a line of text */}
          <div style={{ display: 'flex', flexDirection: 'column', fontFamily: DISPLAY, fontSize: 76, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2.5 }}>
            <span>Find clients</span>
            <span>whose websites</span>
            <span style={{ color: BLUE }}>need you.</span>
          </div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 27, lineHeight: 1.4, color: MUTED }}>
            Audit any website in about a minute, with the first email written for you.
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 24, fontWeight: 600, color: BLUE }}>{site}</div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignSelf: 'center',
          width: 410,
          padding: '30px 32px 34px',
          borderRadius: 28,
          border: `1px solid ${LINE}`,
          background: '#ffffff',
          boxShadow: '0 24px 60px rgba(17, 23, 38, 0.12)',
        }}
      >
        <div style={{ display: 'flex', fontSize: 16, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: FAINT }}>
          Sample audit
        </div>
        <div style={{ display: 'flex', marginTop: 10, fontFamily: DISPLAY, fontSize: 32, fontWeight: 700, letterSpacing: -0.5 }}>{search.niche}</div>
        <div style={{ display: 'flex', marginTop: 2, fontSize: 21, color: MUTED }}>{search.location}</div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10, paddingTop: 6, borderTop: `1px solid ${LINE}` }}>
          {scores.map((s) => (
            <ScoreRow key={s.label} {...s} />
          ))}
        </div>
      </div>
    </div>
  );
}
