import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { analyzeAeo } from '@/app/_shared/lib/audit/analyzers/aeo';
import type { StructuredData } from '@/app/_shared/lib/audit/analyzers/structuredData';

const NO_SCHEMA: StructuredData = { blocks: 0, types: [], entity: null };
const FAQ_SCHEMA: StructuredData = { blocks: 1, types: ['FAQPage'], entity: null };
const run = (body: string, sd = NO_SCHEMA) => analyzeAeo(cheerio.load(`<body>${body}</body>`), sd);

describe('analyzeAeo', () => {
  it('scores a well-structured Q&A page 100', () => {
    const { score, checks } = run(
      `<h1>Smile Dental</h1>
       <h2>Our Services</h2>
       <h2>How much does a crown cost?</h2>
       <h2>Is teeth whitening safe</h2>
       <h3>FAQ</h3>
       <details><summary>Do you see kids?</summary>Yes</details>`,
      FAQ_SCHEMA
    );
    expect(score).toBe(100);
    expect(checks).toMatchObject({ h1Count: 1, h2Count: 3, questionHeadings: 2, hasFaqSchema: true });
  });

  it('fails multiple H1s', () => {
    const { checks } = run('<h1>A</h1><h1>B</h1><h1>C</h1>');
    expect(checks.findings.find((f) => f.id === 'aeo.h1')).toMatchObject({
      status: 'fail',
      label: '3 H1 headings (should be 1)',
    });
  });

  it('fails skipped heading levels', () => {
    const { checks } = run('<h1>Title</h1><h3>Jumped</h3>');
    expect(checks.findings.find((f) => f.id === 'aeo.hierarchy')?.status).toBe('fail');
  });

  it('fails the hierarchy check when a page has no headings', () => {
    const { score, checks } = run('<p>Just text</p>');
    expect(score).toBe(0);
    expect(checks.findings.find((f) => f.id === 'aeo.hierarchy')?.label).toBe('No headings on the page');
  });

  it('only counts H2–H4 question headings', () => {
    const { checks } = run('<h1>X</h1><h2>Our Services</h2><h5>What about H5?</h5><h4>Why choose us?</h4>');
    expect(checks.questionHeadings).toBe(1);
  });
});
