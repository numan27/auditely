// Copy buttons: whether the text reached the clipboard, so the button can say
// "Copied" or that it couldn't (permission refused, page not focused, no
// clipboard on a page that isn't secure).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyText } from '@/app/_shared/lib/utils/browserExport';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('copyText', () => {
  it('copies the text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyText('sam@smiledental.com')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('sam@smiledental.com');
  });

  it('says so when the browser refuses', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new DOMException('Document is not focused', 'NotAllowedError')) } });
    expect(await copyText('x')).toBe(false);
  });

  it('says so when there is no clipboard', async () => {
    vi.stubGlobal('navigator', {});
    expect(await copyText('x')).toBe(false);
  });
});
