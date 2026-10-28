import { describe, it, expect } from 'vitest';
import { connectLookup, publicHost, type HostLookup } from '@/app/_shared/lib/utils/publicAddress';

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

  // NAT64 (64:ff9b::/96), IPv4-compatible (::/96) and 6to4 (2002::/16) addresses carry an
  // IPv4 inside, which can be a private one
  it('refuses an IPv6 address that carries an IPv4 inside', async () => {
    const none = lookup({});
    for (const address of ['64:ff9b::7f00:1', '64:ff9b::a9fe:a9fe', '::7f00:1', '::a00:5', '2002:7f00:1::1', '2002:a9fe:a9fe::']) {
      expect(await publicHost(`[${address}]`, none)).toBe('private');
    }
    expect(await publicHost('[2606:4700:4700::1111]', none)).toBe('public');
    expect(await publicHost('[::ffff:93.184.216.34]', none)).toBe('public');
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

describe('connectLookup', () => {
  // What net and tls hand the callback: an error, or the address(es) to connect to
  const answer = (host: string, all: boolean, map: Record<string, string[]>) =>
    new Promise<{ code?: string; addresses?: unknown }>((resolve) =>
      connectLookup(lookup(map))(host, { all }, (err, addresses, family) =>
        resolve(err ? { code: (err as { code?: string }).code } : { addresses: all ? addresses : [addresses, family] })
      )
    );

  it('refuses a name with any private address, so a connection never reaches one', async () => {
    expect(await answer('intranet.example', true, { 'intranet.example': ['93.184.216.34', '10.0.0.5'] })).toEqual({ code: 'ENOTPUBLIC' });
    expect(await answer('metadata.example', false, { 'metadata.example': ['169.254.169.254'] })).toEqual({ code: 'ENOTPUBLIC' });
  });

  it('hands a public name its addresses, in the form asked for', async () => {
    expect(await answer('example.com', true, { 'example.com': ['93.184.216.34', '2606:2800:220:1::'] })).toEqual({
      addresses: [
        { address: '93.184.216.34', family: 4 },
        { address: '2606:2800:220:1::', family: 6 },
      ],
    });
    expect(await answer('example.com', false, { 'example.com': ['93.184.216.34'] })).toEqual({ addresses: ['93.184.216.34', 4] });
  });

  it("passes on a name that isn't found", async () => {
    expect(await answer('nope.example', true, {})).toEqual({ code: 'ENOTFOUND' });
  });
});
