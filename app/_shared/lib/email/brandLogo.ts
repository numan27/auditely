// app/_shared/lib/email/brandLogo.ts

// The DevArtVentures logo for the owner's outreach email header (brand.ts
// emailLogo). It travels inside the email (an inline attachment), so it shows
// without the lead's mail client loading anything from the web. Server-only.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { images } from '@/app/_shared/assets/images';

/** null when the file can't be read: the email then goes out without the logo */
export async function brandLogo(): Promise<Buffer | null> {
  try {
    // The build can't follow this path (it would ship the whole project to be safe);
    // next.config.ts's outputFileTracingIncludes ships the one file instead
    return await readFile(path.join(/* turbopackIgnore: true */ process.cwd(), images.devartventuresLogo));
  } catch (err) {
    console.error('[send-email] logo not found:', err instanceof Error ? err.message : err);
    return null;
  }
}
