// app/_shared/components/auditely/brandStudio/logoFile.ts

// A chosen logo file read as the data URL the profile stores, or why it can't
// be used: the same checks the server makes (profileInput.ts), before it's sent.

import { LOGO_MAX_BYTES, LOGO_REFUSED, logoProblem } from '@/app/_shared/lib/brand/profileInput';

const LOGO_TYPES = ['image/png', 'image/jpeg'];

export type LogoRead = { ok: true; dataUrl: string } | { ok: false; error: string };

export function readLogoFile(file: File): Promise<LogoRead> {
  if (!LOGO_TYPES.includes(file.type) || file.size > LOGO_MAX_BYTES) return Promise.resolve({ ok: false, error: LOGO_REFUSED });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const problem = logoProblem(dataUrl);
      resolve(problem ? { ok: false, error: problem } : { ok: true, dataUrl });
    };
    reader.onerror = () => resolve({ ok: false, error: "Couldn't read that file. Choose it again." });
    reader.readAsDataURL(file);
  });
}
