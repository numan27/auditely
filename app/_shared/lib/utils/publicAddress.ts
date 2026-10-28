// app/_shared/lib/utils/publicAddress.ts

// Whether a name or address is on the public internet. Audits, link checks and
// an account's own mailbox server only ever reach public addresses, so nobody
// can point them at this server's own network or its cloud metadata. Server-only.

import { promises as dns } from 'node:dns';
import { BlockList, isIP, type LookupFunction } from 'node:net';

/** dns.lookup with `all`, which a test replaces */
export type HostLookup = (host: string) => Promise<{ address: string; family: number }[]>;

export const lookupAll: HostLookup = (host) => dns.lookup(host, { all: true });

// Everything that isn't the public internet: this network, private ranges,
// loopback, link-local (cloud metadata), carrier NAT, multicast and reserved. NAT64
// (64:ff9b::/96), IPv4-compatible (::/96) and 6to4 (2002::/16) addresses carry an IPv4
// inside, which can be a private one; no website needs them, so they're refused whole
const PRIVATE = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) PRIVATE.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [['::', 96], ['64:ff9b::', 96], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) {
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

export type HostStatus = 'public' | 'private' | 'notFound' | 'lookupFailed';

/** Whether every address a name (or an address literal) has is public */
export async function publicHost(host: string, lookup: HostLookup = lookupAll): Promise<HostStatus> {
  // A URL's hostname keeps an IPv6 literal's brackets
  const name = host.trim().replace(/^\[(.*)\]$/, '$1').replace(/\.$/, '').toLowerCase();
  if (!name) return 'notFound';
  if (isIP(name)) return isPrivateAddress(name) ? 'private' : 'public';
  let addresses: { address: string }[];
  try {
    addresses = await lookup(name);
  } catch (err) {
    const code = (err as { code?: string }).code;
    return code === 'ENOTFOUND' || code === 'ENODATA' ? 'notFound' : 'lookupFailed';
  }
  if (!addresses.length) return 'notFound';
  return addresses.some(({ address }) => isPrivateAddress(address)) ? 'private' : 'public';
}

/** The code a connection's lookup fails with for a name that has a private address */
export const NOT_PUBLIC_CODE = 'ENOTPUBLIC';

/**
 * The lookup a net or tls connection makes for itself, refusing a name with any
 * private address. The connection then goes to an address this checked, so a
 * name can't answer public to an earlier check and private here.
 */
export function connectLookup(lookup: HostLookup = lookupAll): LookupFunction {
  return (host, options, callback) => {
    lookup(host).then(
      (addresses) => {
        if (addresses.some(({ address }) => isPrivateAddress(address))) {
          callback(Object.assign(new Error(`${host} isn't a public address`), { code: NOT_PUBLIC_CODE }), '');
          return;
        }
        const usable = options.family === 4 || options.family === 6 ? addresses.filter((a) => a.family === options.family) : addresses;
        if (!usable.length) callback(Object.assign(new Error(`${host} wasn't found`), { code: 'ENOTFOUND' }), '');
        else if (options.all) callback(null, usable);
        else callback(null, usable[0].address, usable[0].family);
      },
      (err: NodeJS.ErrnoException) => callback(err, '')
    );
  };
}
