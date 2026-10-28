// app/_shared/lib/demo/__tests__/walkthrough.test.ts

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { RECORDED_WALKTHROUGH, clockOf } from '@/app/_shared/lib/demo/walkthrough';
import { MEDIA_FILES } from '@/app/_shared/lib/config/routes';

// The recording's length in seconds (ffprobe: 58.112)
const LENGTH = 58;

describe('the recorded walkthrough', () => {
  it('plays the files that ship in public/media', () => {
    expect(RECORDED_WALKTHROUGH).toMatchObject({ kind: 'file', src: MEDIA_FILES.WALKTHROUGH, poster: MEDIA_FILES.WALKTHROUGH_POSTER });
    for (const path of [MEDIA_FILES.WALKTHROUGH, MEDIA_FILES.WALKTHROUGH_POSTER]) expect(existsSync(join(process.cwd(), 'public', path)), path).toBe(true);
  });

  it('starts its chapters at the beginning, in order, inside the recording', () => {
    if (RECORDED_WALKTHROUGH.kind !== 'file') throw new Error('expected the recording');
    const starts = RECORDED_WALKTHROUGH.chapters.map((c) => c.at);
    expect(starts[0]).toBe(0);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    expect(Math.max(...starts)).toBeLessThan(LENGTH);
    for (const c of RECORDED_WALKTHROUGH.chapters) expect(c.title && c.detail).toBeTruthy();
  });
});

describe('clockOf', () => {
  it('reads seconds as a video player shows them', () => {
    expect(clockOf(0)).toBe('0:00');
    expect(clockOf(7)).toBe('0:07');
    expect(clockOf(27)).toBe('0:27');
    expect(clockOf(75)).toBe('1:15');
  });
});
