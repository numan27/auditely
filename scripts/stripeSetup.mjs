// scripts/stripeSetup.mjs

// Sets up Auditely's side of Stripe, in the mode STRIPE_SECRET_KEY is for (test or
// live): the Pro and Agency products and their four prices (scripts/stripeCatalog.mjs),
// the billing portal, and optionally the webhook. Run by hand, as docs/billing-setup.md
// says:
//
//   node --env-file=.env.local scripts/stripeSetup.mjs
//   node --env-file=.env.local scripts/stripeSetup.mjs --webhook <url> --secret-out <file>
//
// Safe to run again: it keeps what already matches and only creates what's missing.
// A price whose amount changed gets a new price that takes over the lookup key, so
// Checkout charges the new amount and existing subscriptions keep the old one. It
// never prints a key or a secret: the webhook's signing secret goes to --secret-out,
// readable only by you.

import { existsSync, writeFileSync } from 'node:fs';
import Stripe from 'stripe';
import { CATALOG, WEBHOOK_EVENTS_FOR_SETUP, portalFeatures } from './stripeCatalog.mjs';

const USAGE = 'Usage: node --env-file=.env.local scripts/stripeSetup.mjs [--webhook <https url> --secret-out <file>]';

function stop(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (flag === '--webhook') args.webhook = value;
    else if (flag === '--secret-out') args.secretOut = value;
    else stop(USAGE);
    if (!value || value.startsWith('--')) stop(USAGE);
  }
  if (!!args.webhook !== !!args.secretOut) stop(USAGE);
  if (args.webhook && !/^https:\/\/[^/\s]+/.test(args.webhook)) stop(`${USAGE}\nThe webhook URL must start with https://`);
  if (args.secretOut && existsSync(args.secretOut)) stop(`${args.secretOut} already exists. Choose a new file for the signing secret.`);
  return args;
}

async function ensureProduct(stripe, { productId, name }) {
  try {
    const product = await stripe.products.retrieve(productId);
    // Checkout refuses the prices of an archived product
    if (!product.active) await stripe.products.update(productId, { active: true });
    console.log(`Product ${productId}: ${product.active ? 'kept' : 'unarchived'}`);
  } catch (error) {
    if (error?.statusCode !== 404) throw error;
    await stripe.products.create({ id: productId, name });
    console.log(`Product ${productId}: created`);
  }
}

/** The active price under the lookup key when its amount and interval match, else a new one that takes the key */
async function ensurePrice(stripe, productId, { interval, unitAmount, lookupKey }) {
  const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const held = data[0];
  if (held && held.unit_amount === unitAmount && held.recurring?.interval === interval) {
    console.log(`Price ${lookupKey}: kept (${held.id})`);
    return held.id;
  }
  const price = await stripe.prices.create({
    product: productId,
    currency: 'usd',
    unit_amount: unitAmount,
    recurring: { interval },
    lookup_key: lookupKey,
    transfer_lookup_key: true,
    tax_behavior: 'exclusive',
  });
  console.log(`Price ${lookupKey}: created (${price.id})`);
  return price.id;
}

async function ensurePortal(stripe, products) {
  const features = portalFeatures(products);
  const existing = process.env.STRIPE_PORTAL_CONFIGURATION;
  const configuration = existing
    ? await stripe.billingPortal.configurations.update(existing, { features })
    : await stripe.billingPortal.configurations.create({ name: 'Auditely', features });
  console.log(`Billing portal: ${existing ? 'updated' : 'created'}`);
  console.log(`STRIPE_PORTAL_CONFIGURATION=${configuration.id}`);
}

async function ensureWebhook(stripe, url, secretOut) {
  const { data } = await stripe.webhookEndpoints.list({ limit: 100 });
  const held = data.find((endpoint) => endpoint.url === url);
  if (held) {
    // Stripe shows a signing secret only once, when it creates the endpoint
    await stripe.webhookEndpoints.update(held.id, { enabled_events: WEBHOOK_EVENTS_FOR_SETUP, disabled: false });
    console.log(
      `Webhook ${url}: kept (${held.id}), with its events updated. Nothing was written to ${secretOut}: its signing ` +
        'secret is in the Dashboard, Developers, Webhooks. For a new secret, delete the endpoint there and run this again.'
    );
    return;
  }
  const endpoint = await stripe.webhookEndpoints.create({ url, enabled_events: WEBHOOK_EVENTS_FOR_SETUP });
  writeFileSync(secretOut, endpoint.secret, { mode: 0o600, flag: 'wx' });
  console.log(`Webhook ${url}: created (${endpoint.id})`);
  console.log(`Webhook signing secret written to ${secretOut}`);
}

async function checkTax(stripe) {
  try {
    const settings = await stripe.tax.settings.retrieve();
    if (settings.status !== 'active') console.warn("Stripe Tax isn't active: Dashboard, Settings, Tax");
  } catch (error) {
    console.warn(`Couldn't check Stripe Tax (${error.message}). Check it in the Dashboard, Settings, Tax.`);
  }
}

const args = parseArgs(process.argv.slice(2));
const key = process.env.STRIPE_SECRET_KEY;
if (!key) stop(`STRIPE_SECRET_KEY isn't set: add it to .env.local.\n${USAGE}`);
const stripe = new Stripe(key);
console.log(`Setting up Stripe in ${key.includes('_live_') ? 'LIVE' : 'test'} mode`);

try {
  const products = [];
  for (const entry of CATALOG) {
    await ensureProduct(stripe, entry);
    const prices = [];
    for (const price of entry.prices) prices.push(await ensurePrice(stripe, entry.productId, price));
    products.push({ product: entry.productId, prices });
  }
  await ensurePortal(stripe, products);
  if (args.webhook) await ensureWebhook(stripe, args.webhook, args.secretOut);
  await checkTax(stripe);
} catch (error) {
  stop(`Stripe setup stopped: ${error?.message ?? error}`);
}
