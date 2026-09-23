// app/_shared/lib/audit/tlsCheck.ts

// Direct TLS handshake on port 443. Catches expired, self-signed and
// wrong-host certificates that "is the URL https?" checks miss.

import tls from 'node:tls';
import type { SslCheck } from '@/app/_shared/lib/audit/types';

const TLS_TIMEOUT_MS = 8000;
const DAY_MS = 86_400_000;

export interface TlsProbe {
  authorized: boolean;
  authorizationError: string | null;
  validTo: string | null; // e.g. 'Oct 27 22:17:21 2026 GMT'
  issuer: string | null;
}

/** Turns a completed handshake into the stored SSL check. */
export function interpretTls(probe: TlsProbe, now: number): SslCheck {
  const expiry = probe.validTo ? Date.parse(probe.validTo) : NaN;
  const daysToExpiry = Number.isFinite(expiry) ? Math.floor((expiry - now) / DAY_MS) : null;
  return {
    valid: probe.authorized && (daysToExpiry === null || daysToExpiry >= 0),
    daysToExpiry,
    issuer: probe.issuer,
    ...(probe.authorizationError ? { error: probe.authorizationError } : {}),
  };
}

/** Resolves null when the handshake can't complete (timeout, refused, DNS). */
export function probeTls(hostname: string): Promise<TlsProbe | null> {
  return new Promise((resolve) => {
    const socket = tls.connect({
      host: hostname,
      port: 443,
      servername: hostname,
      rejectUnauthorized: false, // we want to inspect bad certs, not throw
      timeout: TLS_TIMEOUT_MS,
    });
    const finish = (probe: TlsProbe | null) => {
      socket.destroy();
      resolve(probe);
    };

    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate();
      const authError = socket.authorizationError;
      const issuerO = cert?.issuer?.O;
      const issuerCN = cert?.issuer?.CN;
      const issuer =
        issuerO ? (Array.isArray(issuerO) ? issuerO[0] : issuerO) : issuerCN ? (Array.isArray(issuerCN) ? issuerCN[0] : issuerCN) : null;
      finish({
        authorized: socket.authorized,
        authorizationError: authError
          ? Array.isArray(authError)
            ? authError[0]
            : String(authError)
          : null,
        validTo: cert?.valid_to ?? null,
        issuer,
      });
    });
    socket.once('timeout', () => finish(null));
    socket.once('error', () => finish(null));
  });
}

export async function checkTls(hostname: string, now = Date.now()): Promise<SslCheck | null> {
  const probe = await probeTls(hostname);
  return probe ? interpretTls(probe, now) : null;
}
