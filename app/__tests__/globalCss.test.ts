// The global stylesheet leaves Tailwind's own utilities alone: a copy of one in
// @layer utilities comes after Tailwind's, so it beats every variant of it. A
// copied .sr-only kept the header's "Feedback" label hidden at every width.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('app/globals.css', () => {
  it("doesn't redefine sr-only, so lg:not-sr-only can show a label again", () => {
    expect(css).not.toMatch(/\.sr-only\s*\{/);
  });
});
