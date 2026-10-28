import { describe, it, expect } from 'vitest';
import { publicHost, type HostLookup } from '@/app/_shared/lib/utils/publicAddress';

const lookup = (map: Record<string, string[]>): HostLookup => async (host) => {
  if (!map[host]) throw Object.assign(new Error('nx'), { code: 'ENOTFOUND' });
  return map[host].map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
};

describe('publicHost', () => {
  it('calls a name with any private address private', async () => {
    expect(await publicHost('intranet.example', lookup({ 'intranet.example': ['93.184.216.34', '10.0.0.5'] }))).toBe('private');
    expect(await publicHost('example.com', lookup({ 'example.com': ['93.184.216.34'] }))).toBe('public');
    expect(await publicHost('nope.example', lookup({}))).toBe('notFound');
  });

  it('checks an address literal without looking it up', async () => {
    const none = lookup({});
    expect(await publicHost('169.254.169.254', none)).toBe('private');
    expect(await publicHost('[::1]', none)).toBe('private');
    expect(await publicHost('93.184.216.34', none)).toBe('public');
  });

  it('tells a missing name from a lookup that failed', async () => {
    expect(await publicHost('empty.example', lookup({ 'empty.example': [] }))).toBe('notFound');
    const failing: HostLookup = async () => {
      throw Object.assign(new Error('timeout'), { code: 'ETIMEOUT' });
    };
    expect(await publicHost('example.com', failing)).toBe('lookupFailed');
    expect(await publicHost('', lookup({}))).toBe('notFound');
  });

  it('reads a name the same with a trailing dot or capitals', async () => {
    expect(await publicHost('Example.COM.', lookup({ 'example.com': ['93.184.216.34'] }))).toBe('public');
  });
});
