// app/api/free-audit/route.ts

// The landing page's free audit, for a visitor without an account. In order:
// it's on and set up; a visitor who had theirs gets the same one back (their
// signed cookie); the address is a website; BotID passes; the site is on the
// public internet; this visitor's network hasn't had one in the window and
// the day isn't full. Only then does the audit run. An audit that fails is
// given back, so it doesn't use the visitor's free one.
//
// The cookie goes out with the headers, before the audit runs, and the answer
// follows in the body once it's done. A visitor who leaves mid-audit still has
// their cookie, and after() finishes and saves the audit without them. A claim
// that's given back is gone, so its cookie finds nothing.

import { NextRequest, NextResponse, after } from 'next/server';
import { checkBotId } from 'botid/server';
import { AuditUnavailableError, runAudit } from '@/app/_shared/lib/audit/runAudit';
import { pageSpeedStore } from '@/app/_shared/lib/audit/pageSpeedStore';
import type { AuditRow } from '@/app/_shared/lib/audit/types';
import { DIRECT_AUDIT_SEARCH } from '@/app/_shared/lib/config/directAudits';
import {
  FREE_AUDIT_COOKIE,
  FREE_AUDIT_COPY,
  dayStart,
  freeAuditCookieOptions,
  freeAuditSetup,
  readFreeAuditCookie,
  signFreeAuditCookie,
  visitorHash,
  visitorIp,
  windowStart,
  type FreeAuditReason,
  type FreeAuditResponse,
  type FreeAuditView,
} from '@/app/_shared/lib/freeAudit/freeAuditRules';
import {
  claimFreeAudit,
  findFreeAudit,
  releaseFreeAudit,
  saveFreeAudit,
  type FreeAuditClaim,
  type FreeReport,
} from '@/app/_shared/lib/freeAudit/freeAuditStore';
import { writeFreeReport } from '@/app/_shared/lib/freeAudit/freeReport';
import { publicHost } from '@/app/_shared/lib/utils/publicAddress';
import { normalizeWebsiteUrl } from '@/app/_shared/lib/utils/websiteUrl';

// PageSpeed can take up to four minutes
export const maxDuration = 300;

const OUR_SIDE = 'something went wrong on our side';

function refuse(status: number, reason: FreeAuditReason, error: string) {
  return NextResponse.json<FreeAuditResponse>({ ok: false, reason, error }, { status });
}

// What the page shows: never the stored outreach email
function view(website: string, createdAt: string, audit: AuditRow, report: FreeReport | null): FreeAuditView {
  return {
    website,
    host: new URL(website).hostname.replace(/^www\./, ''),
    createdAt,
    audit,
    report: report ? { summary: report.summary, improvements: report.improvements } : null,
  };
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export async function POST(request: NextRequest) {
  const setup = freeAuditSetup();
  if (setup.state === 'off') return refuse(503, 'off', FREE_AUDIT_COPY.off);
  if (setup.state === 'unavailable') {
    console.error(`[free-audit] Not set up: ${setup.missing.join(', ')}`);
    return refuse(503, 'unavailable', FREE_AUDIT_COPY.unavailable);
  }
  const { config } = setup;

  // Had theirs already: the same audit again, whatever they asked for
  const ownId = await readFreeAuditCookie(request.cookies.get(FREE_AUDIT_COOKIE)?.value, config.secret);
  const own = ownId ? await findFreeAudit(ownId) : null;
  if (own) {
    return NextResponse.json<FreeAuditResponse>({
      ok: true,
      result: view(own.website, own.createdAt, own.audit, own.report),
      again: true,
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = normalizeWebsiteUrl(typeof body?.website === 'string' ? body.website : '');
  if (!parsed.ok) return refuse(400, 'invalid', parsed.error);
  const { url: website, host } = parsed;

  const verification = await checkBotId();
  if (verification.isBot) return refuse(403, 'bot', FREE_AUDIT_COPY.bot);

  const reach = await publicHost(new URL(website).hostname);
  if (reach === 'private') return refuse(400, 'notPublic', FREE_AUDIT_COPY.notPublic);
  if (reach === 'notFound') return refuse(400, 'failed', FREE_AUDIT_COPY.notFound(host));
  if (reach === 'lookupFailed') return refuse(503, 'failed', FREE_AUDIT_COPY.lookupFailed(host));

  const now = new Date();
  let claim: FreeAuditClaim;
  try {
    claim = await claimFreeAudit({
      ipHash: visitorHash(visitorIp(request.headers), config.salt),
      website,
      since: windowStart(now, config.windowDays),
      dayStart: dayStart(now),
      dailyCap: config.dailyCap,
    });
  } catch (err) {
    console.error(`[free-audit] Couldn't claim: ${message(err)}`);
    return refuse(503, 'unavailable', FREE_AUDIT_COPY.unavailable);
  }
  if (!claim.ok) return refuse(429, claim.reason, FREE_AUDIT_COPY[claim.reason]);

  const work = finishFreeAudit(claim.id, website, host, now).catch((err) => {
    console.error(`[free-audit] Couldn't finish ${claim.id}: ${message(err)}`);
    return failed(host, OUR_SIDE);
  });
  after(() => work);

  const res = new NextResponse(streamJson(work), { headers: { 'content-type': 'application/json' } });
  res.cookies.set(FREE_AUDIT_COOKIE, await signFreeAuditCookie(claim.id, config.secret), freeAuditCookieOptions(config.windowDays));
  return res;
}

const failed = (host: string, why: string): FreeAuditResponse => ({ ok: false, reason: 'failed', error: FREE_AUDIT_COPY.failed(host, why) });

/** Runs and saves the claimed audit, or gives the claim back */
async function finishFreeAudit(claimId: string, website: string, host: string, now: Date): Promise<FreeAuditResponse> {
  let row: AuditRow;
  try {
    // No email search: the visitor is auditing a site, not finding a lead
    ({ row } = await runAudit(
      { website, name: host, address: '', phone: null, niche: DIRECT_AUDIT_SEARCH.niche, refreshPageSpeed: false },
      { pageSpeedStore }
    ));
  } catch (err) {
    await releaseFreeAudit(claimId);
    if (err instanceof AuditUnavailableError) return failed(host, err.message);
    console.error(`[free-audit] Audit of ${host} failed: ${message(err)}`);
    return failed(host, OUR_SIDE);
  }

  const report = await writeFreeReport(row, website);
  try {
    await saveFreeAudit(claimId, row, report);
  } catch (err) {
    await releaseFreeAudit(claimId);
    console.error(`[free-audit] Couldn't save ${claimId}: ${message(err)}`);
    return failed(host, OUR_SIDE);
  }
  return { ok: true, result: view(website, now.toISOString(), row, report), again: false };
}

/** A space at once, so the headers and cookie go out, then the answer once it's ready */
function streamJson(answer: Promise<FreeAuditResponse>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(' '));
      const body = await answer;
      try {
        controller.enqueue(encoder.encode(JSON.stringify(body)));
        controller.close();
      } catch {
        // The visitor left; the audit was still saved
      }
    },
  });
}
