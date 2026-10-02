// scripts/captureDemo.mjs

// Writes the public demo's sample data, app/_shared/lib/demo/demoData.json,
// from one saved search and one website of the Audit tab. Run by hand:
//
//   node --env-file=.env.local scripts/captureDemo.mjs                        lists what can be captured
//   node --env-file=.env.local scripts/captureDemo.mjs <search_id> <domain>   writes the file
//
// Emails and phone numbers are masked, outreach history is cleared and database
// ids are replaced, so nothing in the file leads back to a row. Read the file
// through once before committing it.

import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { CURRENT_ENGINE_VERSION } from '../app/_shared/lib/audit/types.ts';
import { DIRECT_AUDIT_SEARCH } from '../app/_shared/lib/config/directAudits.ts';
import { findUnmasked, maskDeep, maskEmail, maskPhone } from '../app/_shared/lib/demo/mask.ts';

// The sample is sent with the page, so it stays small
const LEADS = 10;
const OUT = new URL('../app/_shared/lib/demo/demoData.json', import.meta.url);

function stop(message) {
  console.error(message);
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!url || !key) stop('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed: run with --env-file=.env.local');
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// PostgREST embeds a one-to-one row as an object, or as an array on older schemas
const one = (value) => (Array.isArray(value) ? value[0] : (value ?? undefined));

/** A search's businesses in the app's order, each with its audit and AI report */
async function businessesOf(searchId) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*, audits (*, ai_reports (*))')
    .eq('search_id', searchId)
    .order('created_at', { ascending: true });
  if (error) stop(`Couldn't read the businesses: ${error.message}`);
  return data.map(({ audits, ...business }) => {
    const row = one(audits);
    if (!row) return business;
    const { ai_reports, ...audit } = row;
    return { ...business, audit, ai_report: one(ai_reports) };
  });
}

// Worth showing: a website, a current audit with its speed measured, and a summary
const isReady = (b) =>
  !!b.website && b.audit?.engine_version === CURRENT_ENGINE_VERSION && b.audit.performance_score !== null && !!b.ai_report;

// The audit could read the site itself: one that turns automated visitors away has no GEO, AEO or lead-capture results
const wasRead = (b) => b.audit.checks?.site?.ok !== false;
const isReadyLead = (b) => isReady(b) && wasRead(b);
const BLOCKED_NOTE = 'blocked the audit, so its report has no GEO, AEO or lead-capture results';

const isDirect = (search) => search.niche === DIRECT_AUDIT_SEARCH.niche && search.location === DIRECT_AUDIT_SEARCH.location;

async function allSearches() {
  const { data, error } = await supabase
    .from('searches')
    .select('id, niche, location, created_at')
    .order('created_at', { ascending: false });
  if (error) stop(`Couldn't read the searches: ${error.message}`);
  return data;
}

async function list(searches) {
  console.log('Saved searches (id | search | businesses ready to show):');
  for (const search of searches.filter((s) => !isDirect(s))) {
    const ready = (await businessesOf(search.id)).filter(isReadyLead).length;
    if (ready > 0) console.log(`  ${search.id} | ${search.niche} in ${search.location} | ${ready}`);
  }
  console.log('\nWebsites in the Audit tab ready to show:');
  for (const search of searches.filter(isDirect)) {
    for (const site of (await businessesOf(search.id)).filter(isReady)) {
      console.log(`  ${site.website}${wasRead(site) ? '' : ` (${BLOCKED_NOTE})`}`);
    }
  }
  console.log('\nThen: node --env-file=.env.local scripts/captureDemo.mjs <search_id> <domain>');
}

/** One business as the demo shows it: new ids, masked contacts, no outreach history */
function sample(source, key) {
  const business = structuredClone(source);
  business.id = `demo-b${key}`;
  business.search_id = 'demo-search';
  business.email = business.email && maskEmail(business.email);
  business.phone = business.phone && maskPhone(business.phone);
  business.hubspot_company_id = null;
  business.crm_sent_at = null;
  business.emailed_at = null;
  business.audit.id = `demo-a${key}`;
  business.audit.business_id = business.id;
  const site = business.audit.checks?.geo?.nap?.site;
  if (site?.phones) site.phones = site.phones.map(maskPhone);
  business.ai_report.id = `demo-r${key}`;
  business.ai_report.audit_id = business.audit.id;
  // Whatever else mentions a contact: finding details, page titles, the AI's text
  return maskDeep(business);
}

const [searchId, domain] = process.argv.slice(2);
const searches = await allSearches();
if (!searchId || !domain) {
  await list(searches);
  process.exit(0);
}

const search = searches.find((s) => s.id === searchId);
if (!search) stop(`No saved search has the id ${searchId}`);
const leads = (await businessesOf(searchId)).filter(isReadyLead).slice(0, LEADS);
if (leads.length < 2) stop('That search has fewer than 2 businesses ready to show (website the audit could read, current audit, summary)');

const direct = searches.filter(isDirect);
const sites = (await Promise.all(direct.map((s) => businessesOf(s.id)))).flat().filter(isReady);
const site = sites.find((b) => b.website.includes(domain));
if (!site) stop(`No audited website matching "${domain}" in the Audit tab`);

const data = {
  capturedAt: new Date().toISOString(),
  query: { niche: search.niche, location: search.location },
  leads: leads.map((business, i) => sample(business, String(i + 1))),
  sites: [sample(site, 's1')],
  // Every second lead starts as "Not audited yet"; edit the list by hand to taste
  replayIds: leads.map((_, i) => `demo-b${i + 1}`).filter((_, i) => i % 2 === 1),
};

// The guard is looser than the masking: it also stops on what only might be a contact detail
const readable = findUnmasked(data);
if (readable.length > 0) {
  const shown = readable.slice(0, 10).map((hit) => `  ${hit.path}: ${hit.text.slice(0, 100)}`);
  stop(
    `Not written: ${readable.length} texts could still be contact details.\n${shown.join('\n')}\n` +
      'Choose another search or website, or teach app/_shared/lib/demo/mask.ts the format (with a test).'
  );
}

const json = `${JSON.stringify(data, null, 2)}\n`;
writeFileSync(OUT, json);
console.log(`Wrote ${data.leads.length} leads and 1 website (${Math.round(json.length / 1024)} kB) to ${OUT.pathname}`);
if (!wasRead(site)) console.log(`Note: ${site.website} ${BLOCKED_NOTE}.`);
console.log('Read it through once before committing it.');
