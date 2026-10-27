// app/_shared/lib/email/mailbox.ts

// An account's own mailbox server, which the account names: the server only
// connects to it after looking the name up and finding nothing but public
// addresses, and then connects to the address it checked, never the name, so
// a second lookup can't point it somewhere else. TLS still checks the
// certificate against the name. Server-only.

import { promises as dns } from 'node:dns';
import { BlockList, isIP } from 'node:net';
import { createTransport, type Transporter } from 'nodemailer';
import type { MailboxSettings } from '@/app/_shared/lib/email/mailboxPresets';

/** dns.lookup with `all`, which a test replaces */
export type MailLookup = (host: string) => Promise<{ address: string; family: number }[]>;
type Lookup = MailLookup;

const lookupAll: Lookup = (host) => dns.lookup(host, { all: true });

// Everything that isn't the public internet: this network, private ranges,
// loopback, link-local (cloud metadata), carrier NAT, multicast and reserved
const PRIVATE = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) PRIVATE.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) {
  PRIVATE.addSubnet(network, prefix, 'ipv6');
}

/** True when the address is not a public one (anything that isn't an address included) */
export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return PRIVATE.check(address, 'ipv4');
  // An ::ffff: address is checked as the IPv4 it maps, in either spelling
  if (family === 6) return PRIVATE.check(address, 'ipv6');
  return true;
}

const NAME_NEEDED = "Use your mail provider's SMTP server name, like smtp.gmail.com.";

/** The public address to connect to for this mail server name */
export async function resolveMailHost(
  host: string,
  lookup: Lookup = lookupAll
): Promise<{ ok: true; address: string } | { ok: false; error: string }> {
  const name = host.trim().toLowerCase().replace(/\.$/, '');
  if (isIP(name) || name === 'localhost' || /\.(localhost|local|internal)$/.test(name) || !name.includes('.')) {
    return { ok: false, error: NAME_NEEDED };
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(name);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ENOTFOUND' || code === 'ENODATA') return { ok: false, error: `${host} wasn't found. Check the server name.` };
    console.error('[mailbox] lookup failed:', host, code);
    return { ok: false, error: `Couldn't look up ${host}. Try again in a minute.` };
  }
  if (!addresses.length) return { ok: false, error: `${host} wasn't found. Check the server name.` };
  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    return { ok: false, error: `${host} doesn't point to a public mail server.` };
  }
  // IPv4 first, as nodemailer's own lookup chose: a host without IPv6 can't reach the rest
  const chosen = addresses.find(({ address }) => isIP(address) === 4) ?? addresses[0];
  return { ok: true, address: chosen.address };
}

/** A connection to the checked address, as the mailbox's own server name */
export function mailTransport(settings: MailboxSettings, address: string): Transporter {
  return createTransport({
    host: address,
    port: settings.port,
    // 465 is encrypted from the start; 587 must upgrade before the password is sent
    secure: settings.port === 465,
    requireTLS: true,
    auth: { user: settings.user, pass: settings.pass },
    tls: { servername: settings.host },
    // Together well inside the route's time limit
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
}

/** The mail server's code and its own answer; never the error itself, whose message can quote the login */
export const smtpFailure = (err: unknown) => {
  const { code, response } = err as { code?: string; response?: string };
  return { code, response };
};

/** Zoho's answer from the server that isn't the one for the account's plan */
export const isZohoWrongServer = (code: string | undefined, response: string | undefined) =>
  code === 'EAUTH' && !!response && /access restricted/i.test(response);

export const zohoServerSentence = (host: string) =>
  `${host} isn't the server for this mailbox. A free Zoho account uses smtp.zoho.com, a paid one smtppro.zoho.com.`;

/** Logs in to the mailbox without sending anything */
export async function verifyMailbox(settings: MailboxSettings, lookup?: Lookup): Promise<{ ok: true } | { ok: false; error: string }> {
  const resolved = await resolveMailHost(settings.host, lookup);
  if (!resolved.ok) return resolved;
  try {
    await mailTransport(settings, resolved.address).verify();
    return { ok: true };
  } catch (err) {
    const { code, response } = smtpFailure(err);
    console.error('[mailbox] check failed:', settings.host, code, response);
    if (isZohoWrongServer(code, response)) return { ok: false, error: zohoServerSentence(settings.host) };
    if (code === 'EAUTH') return { ok: false, error: 'The mailbox refused the login. Check the email address and app password.' };
    return { ok: false, error: `Couldn't reach ${settings.host} on port ${settings.port}. Check the server and port.` };
  }
}
