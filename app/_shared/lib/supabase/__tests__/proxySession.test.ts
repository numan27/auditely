import { describe, it, expect } from 'vitest';
import { NextResponse } from 'next/server';
import { withSessionCookies } from '@/app/_shared/lib/supabase/proxySession';

describe('withSessionCookies', () => {
  it('carries the session cookies and their no-store headers onto the target', () => {
    const from = NextResponse.next();
    from.cookies.set('sb-token', 'abc');
    from.headers.set('cache-control', 'private, no-cache, no-store, must-revalidate, max-age=0');
    from.headers.set('expires', '0');
    from.headers.set('pragma', 'no-cache');

    const target = withSessionCookies(NextResponse.redirect('http://localhost/'), from);
    expect(target.cookies.get('sb-token')?.value).toBe('abc');
    expect(target.headers.get('cache-control')).toBe('private, no-cache, no-store, must-revalidate, max-age=0');
    expect(target.headers.get('expires')).toBe('0');
    expect(target.headers.get('pragma')).toBe('no-cache');
  });
});
