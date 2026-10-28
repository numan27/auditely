import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import tls from 'node:tls';
import type { LookupFunction } from 'node:net';
import { checkTls, interpretTls, probeTls } from '@/app/_shared/lib/audit/tlsCheck';

const NOW = Date.parse('2026-09-23T00:00:00Z');

describe('interpretTls', () => {
  it('marks a trusted certificate valid with days to expiry', () => {
    expect(
      interpretTls({ authorized: true, authorizationError: null, validTo: 'Nov 2 00:00:00 2026 GMT', issuer: "Let's Encrypt" }, NOW)
    ).toEqual({ valid: true, daysToExpiry: 40, issuer: "Let's Encrypt" });
  });

  it('marks an expired certificate invalid', () => {
    const result = interpretTls(
      { authorized: false, authorizationError: 'CERT_HAS_EXPIRED', validTo: 'Apr 12 23:59:59 2015 GMT', issuer: 'COMODO CA Limited' },
      NOW
    );
    expect(result.valid).toBe(false);
    expect(result.daysToExpiry).toBeLessThan(0);
    expect(result.error).toBe('CERT_HAS_EXPIRED');
  });

  it('marks a wrong-host certificate invalid even when not expired', () => {
    const result = interpretTls(
      { authorized: false, authorizationError: 'ERR_TLS_CERT_ALTNAME_INVALID', validTo: 'Oct 26 20:03:01 2026 GMT', issuer: "Let's Encrypt" },
      NOW
    );
    expect(result).toMatchObject({ valid: false, error: 'ERR_TLS_CERT_ALTNAME_INVALID' });
  });

  it('leaves daysToExpiry null when the date is unreadable', () => {
    expect(interpretTls({ authorized: true, authorizationError: null, validTo: 'garbage', issuer: null }, NOW)).toEqual({
      valid: true,
      daysToExpiry: null,
      issuer: null,
    });
  });
});

describe('probeTls on private addresses', () => {
  // A handshake that never gets anywhere, so nothing leaves this machine
  const deadSocket = () => {
    const socket = Object.assign(new EventEmitter(), { destroy: () => {} });
    setTimeout(() => socket.emit('error', new Error('no network in tests')));
    return socket as unknown as tls.TLSSocket;
  };
  afterEach(() => vi.restoreAllMocks());

  it('never connects to a private address literal', async () => {
    const connect = vi.spyOn(tls, 'connect').mockImplementation(deadSocket);
    expect(await probeTls('10.0.0.5')).toBeNull();
    expect(await probeTls('[::1]')).toBeNull();
    expect(connect).not.toHaveBeenCalled();
  });

  it('connects to a name only through a lookup that refuses its private addresses', async () => {
    const connect = vi.spyOn(tls, 'connect').mockImplementation(deadSocket);
    const metadata = async () => [{ address: '169.254.169.254', family: 4 }];
    expect(await probeTls('rebind.example', metadata)).toBeNull();
    const { lookup } = connect.mock.calls[0][0] as { lookup?: LookupFunction };
    expect(lookup).toBeTypeOf('function');
    const code = await new Promise((resolve) => lookup!('rebind.example', { all: true }, (err) => resolve(err?.code)));
    expect(code).toBe('ENOTPUBLIC');
  });
});

describe.runIf(process.env.RUN_NETWORK_TESTS === '1')('checkTls (network)', () => {
  it('accepts a valid certificate', async () => {
    expect((await checkTls('example.com'))?.valid).toBe(true);
  }, 15_000);

  it('rejects expired, wrong-host and self-signed certificates', async () => {
    expect(await checkTls('expired.badssl.com')).toMatchObject({ valid: false, error: 'CERT_HAS_EXPIRED' });
    expect(await checkTls('wrong.host.badssl.com')).toMatchObject({ valid: false, error: 'ERR_TLS_CERT_ALTNAME_INVALID' });
    expect(await checkTls('self-signed.badssl.com')).toMatchObject({ valid: false, error: 'DEPTH_ZERO_SELF_SIGNED_CERT' });
  }, 30_000);

  it('returns null when the host does not resolve', async () => {
    expect(await checkTls('nonexistent-zz9-auditely.example')).toBeNull();
  }, 15_000);
});
