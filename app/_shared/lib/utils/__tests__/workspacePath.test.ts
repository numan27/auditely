import { describe, it, expect } from 'vitest';
import { parseWorkspacePath, requestPath, searchPath, workspacePath } from '@/app/_shared/lib/utils/workspacePath';

const ID = '3a7e9c10-2b4d-4e6f-8a1b-9c0d2e4f6a8b';

describe('parseWorkspacePath', () => {
  it('reads each view from its address', () => {
    expect(parseWorkspacePath('/')).toEqual({ mode: 'leads', searchId: null });
    expect(parseWorkspacePath(`/search/${ID}`)).toEqual({ mode: 'leads', searchId: ID });
    expect(parseWorkspacePath('/audit')).toEqual({ mode: 'audit' });
    expect(parseWorkspacePath('/requests')).toEqual({ mode: 'requests', requestId: null });
    expect(parseWorkspacePath(`/requests/${ID}`)).toEqual({ mode: 'requests', requestId: ID });
  });

  it('takes a trailing slash and upper-case ids', () => {
    expect(parseWorkspacePath('/audit/')).toEqual({ mode: 'audit' });
    expect(parseWorkspacePath(`/requests/${ID.toUpperCase()}`)).toEqual({ mode: 'requests', requestId: ID });
  });

  it("is null for addresses that aren't the workspace's", () => {
    for (const path of ['/searches', '/demo', '/login', '/search', '/search/nope', '/requests/nope', `/audit/${ID}`, `/requests/${ID}/x`]) {
      expect(parseWorkspacePath(path)).toBeNull();
    }
  });
});

describe('workspacePath', () => {
  it('writes the address each view is read back from', () => {
    const views = [
      { mode: 'leads', searchId: null },
      { mode: 'leads', searchId: ID },
      { mode: 'audit' },
      { mode: 'requests', requestId: null },
      { mode: 'requests', requestId: ID },
    ] as const;
    for (const view of views) expect(parseWorkspacePath(workspacePath(view))).toEqual(view);
    expect(searchPath(ID)).toBe(`/search/${ID}`);
    expect(requestPath(ID)).toBe(`/requests/${ID}`);
  });
});
