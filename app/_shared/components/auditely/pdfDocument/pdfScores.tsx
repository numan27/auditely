// app/_shared/components/auditely/pdfDocument/pdfScores.tsx

// The report's scores: a tile for each, and the legend that explains them.

import { Path, Svg, Text, View } from '@react-pdf/renderer';
import { scoreColor, type PdfStyles } from '@/app/_shared/components/auditely/pdfDocument/pdfStyles';
import { SectionLabel, type SectionHead } from '@/app/_shared/components/auditely/pdfDocument/pdfSections';

const SCORE_DEFINITIONS: [string, string][] = [
  ['Performance', 'page speed on desktop'],
  ['Mobile', 'page speed on phones'],
  ['SEO', 'how well Google can read and index the site'],
  ['SSL', 'secure (https) connection'],
  ['GEO', 'how clearly AI search tools like ChatGPT can identify the business'],
  ['AEO', 'how ready the content is to be quoted as a direct answer'],
  ['Leads', 'how easily visitors can call, message or book'],
];

// null = not measured → "—"
function ScoreTile({ s, label, score }: { s: PdfStyles; label: string; score: number | null }) {
  return (
    <View style={s.scoreBox}>
      <Text style={[s.scoreValue, scoreColor(score)]}>{score ?? '—'}</Text>
      <Text style={s.scoreLabel}>{label}</Text>
    </View>
  );
}

// The tick is drawn — built-in Helvetica has no "✓" glyph (it rendered blank)
function SslTile({ s, valid }: { s: PdfStyles; valid: boolean | null }) {
  const color = valid === null ? s.scoreNeutral : valid ? s.scoreGreen : s.scoreRed;
  return (
    <View style={s.scoreBox}>
      {valid ? (
        <Svg width={21} height={21} viewBox="0 0 24 24" style={{ marginBottom: 3 }}>
          <Path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke={s.scoreGreen.color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      ) : (
        <Text style={[s.scoreValue, color]}>{valid === null ? '—' : 'X'}</Text>
      )}
      <Text style={s.scoreLabel}>SSL</Text>
    </View>
  );
}

function LegendItem({ s, dot, text }: { s: PdfStyles; dot: PdfStyles['dotGreen']; text: string }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.legendDot, dot]} />
      <Text style={s.legendText}>{text}</Text>
    </View>
  );
}

function ScoreLegend({ s }: { s: PdfStyles }) {
  return (
    <View>
      <View style={s.legendRow}>
        <Text style={s.legendText}>Scores are out of 100:</Text>
        <LegendItem s={s} dot={s.dotGreen} text="80–100 good" />
        <LegendItem s={s} dot={s.dotAmber} text="50–79 needs work" />
        <LegendItem s={s} dot={s.dotRed} text="0–49 poor" />
      </View>
      <View style={s.definitions}>
        {SCORE_DEFINITIONS.map(([term, meaning]) => (
          <Text key={term} style={s.definition}>
            <Text style={s.definitionTerm}>{term}</Text> — {meaning}
          </Text>
        ))}
      </View>
    </View>
  );
}

export interface PdfScores {
  performance: number | null;
  seo: number | null;
  mobile: number | null;
  ssl: boolean | null;
  geo: number | null;
  aeo: number | null;
  leads: number | null;
}

export function ScoresSection({ s, head, scores }: { s: PdfStyles; head: SectionHead; scores: PdfScores }) {
  return (
    <View style={s.section}>
      <SectionLabel s={s} head={head} />
      <View style={s.scoresRow}>
        <ScoreTile s={s} label="Performance" score={scores.performance} />
        <ScoreTile s={s} label="SEO" score={scores.seo} />
        <ScoreTile s={s} label="Mobile" score={scores.mobile} />
        <SslTile s={s} valid={scores.ssl} />
        <ScoreTile s={s} label="GEO" score={scores.geo} />
        <ScoreTile s={s} label="AEO" score={scores.aeo} />
        <ScoreTile s={s} label="Leads" score={scores.leads} />
      </View>
      <ScoreLegend s={s} />
    </View>
  );
}
