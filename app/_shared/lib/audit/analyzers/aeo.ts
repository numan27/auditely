// app/_shared/lib/audit/analyzers/aeo.ts

// AEO (Answer Engine Optimization): is the page structured so ChatGPT,
// Perplexity and Google's AI answers can lift clear Q&A from it? Rubric: see spec.

import type { CheerioAPI } from 'cheerio';
import type { AeoChecks, Finding } from '@/app/_shared/lib/audit/types';
import type { StructuredData } from '@/app/_shared/lib/audit/analyzers/structuredData';

const QUESTION_START = /^(what|how|why|when|where|who|which|can|do|does|is|are|should|will)\b/i;
const FAQ_HEADING = /\bfaqs?\b|frequently asked/i;

interface Heading {
  level: number;
  text: string;
}

function readHeadings($: CheerioAPI): Heading[] {
  return $('h1, h2, h3, h4, h5, h6')
    .map((_, el) => ({
      level: Number(el.tagName.slice(1)),
      text: $(el).text().replace(/\s+/g, ' ').trim(),
    }))
    .get();
}

export function analyzeAeo($: CheerioAPI, structured: StructuredData): { score: number; checks: AeoChecks } {
  const headings = readHeadings($);
  const h1Count = headings.filter((h) => h.level === 1).length;
  const h2Count = headings.filter((h) => h.level === 2).length;
  const skipsLevel = headings.some((h, i) => i > 0 && h.level > headings[i - 1].level + 1);
  const questionHeadings = headings.filter(
    (h) => h.level >= 2 && h.level <= 4 && (h.text.endsWith('?') || QUESTION_START.test(h.text))
  ).length;
  const hasFaqSchema = structured.types.some((t) => t === 'FAQPage' || t === 'QAPage');
  const hasFaqSection = $('details summary').length > 0 || headings.some((h) => FAQ_HEADING.test(h.text));

  const findings: Finding[] = [];
  let score = 0;
  const check = (id: string, ok: boolean, points: number, pass: string, fail: string) => {
    if (ok) score += points;
    findings.push({ id, status: ok ? 'pass' : 'fail', label: ok ? pass : fail });
  };

  check('aeo.h1', h1Count === 1, 20, 'One H1 heading', h1Count === 0 ? 'No H1 heading' : `${h1Count} H1 headings (should be 1)`);
  check(
    'aeo.h2',
    h2Count >= 3,
    15,
    `${h2Count} H2 sections`,
    `Only ${h2Count} H2 section${h2Count === 1 ? '' : 's'} (aim for 3+)`
  );
  check(
    'aeo.hierarchy',
    headings.length > 0 && !skipsLevel,
    10,
    'Heading levels are in order',
    headings.length === 0 ? 'No headings on the page' : 'Heading levels skip (e.g. H1 → H3)'
  );
  check(
    'aeo.questions',
    questionHeadings >= 2,
    20,
    `${questionHeadings} question-style headings`,
    questionHeadings === 0 ? 'No question-style headings' : 'Only 1 question-style heading (aim for 2+)'
  );
  check('aeo.faqSchema', hasFaqSchema, 20, 'FAQ schema (FAQPage) found', 'No FAQPage schema');
  check('aeo.faqSection', hasFaqSection, 15, 'Visible FAQ / Q&A section', 'No FAQ / Q&A section');

  return { score, checks: { findings, h1Count, h2Count, questionHeadings, hasFaqSchema } };
}
